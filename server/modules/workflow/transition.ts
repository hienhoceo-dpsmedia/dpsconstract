import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  contracts,
  contractAuditLogs,
  contractFiles,
  idempotencyRequests,
  outboxJobs,
} from '../../db/schema.js';
import type { ContractStatus } from '../../../src/shared/contracts.js';
import type { Actor, WorkflowAction } from '../../domain/types.js';
import { ACTION_TARGET_MAP } from './actions.js';
import { validateActionGuard, WorkflowGuardError } from './guards.js';
import { getMilestoneForAction } from './milestones.js';
import { AppError } from '../../http/errors.js';

export interface WorkflowTransitionParams {
  contractId: string;
  action: WorkflowAction;
  actor: Actor;
  payload?: {
    note?: string;
    waybillCode?: string;
    hasFileOrLink?: boolean;
    hasScanFile?: boolean;
    metadata?: Record<string, unknown>;
  };
  expectedVersion?: number;
  idempotencyKey?: string;
  clock?: () => Date;
  requestId?: string;
  tx?: any;
}

export interface WorkflowTransitionResult {
  success: boolean;
  contractId: string;
  previousStatus: ContractStatus;
  currentStatus: ContractStatus;
  version: number;
  auditLogId: string;
  isIdempotentReplay?: boolean;
}

export async function executeWorkflowTransition(
  params: WorkflowTransitionParams
): Promise<WorkflowTransitionResult> {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();
  const reqId = params.requestId || crypto.randomUUID();

  const actorKey =
    params.actor.kind === 'user' ? params.actor.userId : `service:${params.actor.service}`;

  // Check idempotency if key provided
  if (params.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(idempotencyRequests)
      .where(
        and(
          eq(idempotencyRequests.actorKey, actorKey),
          eq(idempotencyRequests.key, params.idempotencyKey)
        )
      );

    if (existing && existing.state === 'completed' && existing.responseBody) {
      const cached = existing.responseBody as unknown as WorkflowTransitionResult;
      return {
        ...cached,
        isIdempotentReplay: true,
      };
    }
  }

  const runInTransaction = async (tx: any) => {
    // 1. Lock and fetch contract row
    const [contractRow] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contractRow) {
      throw new AppError(404, 'NOT_FOUND', `Không tìm thấy hợp đồng với mã "${params.contractId}".`);
    }

    // 2. Check optimistic locking version
    if (params.expectedVersion !== undefined && contractRow.version !== params.expectedVersion) {
      throw new AppError(
        409,
        'VERSION_MISMATCH',
        `Xung đột phiên bản: Hợp đồng hiện tại đang ở phiên bản ${contractRow.version}, không khớp với phiên bản yêu cầu ${params.expectedVersion}. Vui lòng tải lại dữ liệu mới nhất.`
      );
    }

    // 3. Inspect scan files if relevant
    let hasScan = params.payload?.hasScanFile;
    if (hasScan === undefined) {
      const [scanCount] = await tx
        .select({ total: sql<number>`count(*)` })
        .from(contractFiles)
        .where(
          and(
            eq(contractFiles.contractId, contractRow.id),
            eq(contractFiles.type, 'scan'),
            eq(contractFiles.availability, 'present')
          )
        );
      hasScan = Number(scanCount?.total || 0) > 0;
    }

    // 4. Validate action guards
    try {
      validateActionGuard(
        {
          id: contractRow.id,
          status: contractRow.status as ContractStatus,
          processingMethod: contractRow.processingMethod as 'physical' | 'digital',
          hasScanFile: hasScan,
          assignedLegalId: contractRow.legalAssigneeId,
          assignedClerkId: contractRow.clerkAssigneeId,
        },
        params.action,
        params.actor,
        {
          ...params.payload,
          hasScanFile: hasScan,
        }
      );
    } catch (err: unknown) {
      if (err instanceof WorkflowGuardError) {
        throw new AppError(400, err.code, err.message);
      }
      throw err;
    }

    // 5. Determine target status
    const targetStatus = ACTION_TARGET_MAP[params.action]({
      processingMethod: contractRow.processingMethod as 'physical' | 'digital',
    });
    const newStatus = (targetStatus || contractRow.status) as ContractStatus;
    const isStatusChanged = newStatus !== contractRow.status;

    // 6. Compute milestones
    const milestones = getMilestoneForAction(params.action, now);
    const newVersion = contractRow.version + 1;

    // 7. Update contract in database
    const updateValues: Record<string, unknown> = {
      status: newStatus,
      version: newVersion,
      lastActivityAt: now,
      ...(isStatusChanged ? { statusEnteredAt: now } : {}),
      ...(milestones.soft_approved_at ? { softApprovedAt: milestones.soft_approved_at } : {}),
      ...(milestones.printed_at ? { printedAt: milestones.printed_at } : {}),
      ...(milestones.signed_at ? { signedAt: milestones.signed_at } : {}),
      ...(milestones.waybill_created_at ? { waybillCreatedAt: milestones.waybill_created_at } : {}),
      ...(milestones.picked_up_at ? { pickedUpAt: milestones.picked_up_at } : {}),
      ...(milestones.delivered_at ? { deliveredAt: milestones.delivered_at } : {}),
      ...(milestones.received_back_at ? { receivedBackAt: milestones.received_back_at } : {}),
      ...(milestones.archived_at ? { archivedAt: milestones.archived_at } : {}),
    };

    await tx.update(contracts).set(updateValues).where(eq(contracts.id, contractRow.id));

    // 8. Insert append-only audit log
    const auditLogId = crypto.randomUUID();
    const actorEmail = params.actor.kind === 'user' ? params.actor.email : null;
    const actorName =
      params.actor.kind === 'user'
        ? params.actor.email.split('@')[0]
        : `Service (${params.actor.service})`;

    await tx.insert(contractAuditLogs).values({
      id: auditLogId,
      contractId: contractRow.id,
      cycleId: contractRow.currentCycleId,
      action: params.action,
      fromStatus: contractRow.status,
      toStatus: newStatus,
      actorKind: params.actor.kind,
      actorId: params.actor.kind === 'user' ? params.actor.userId : params.actor.service,
      actorName,
      actorEmail,
      requestId: reqId,
      reason: params.payload?.note || null,
      metadata: params.payload?.metadata || null,
      createdAt: now,
    });

    // 9. Queue outbox job if status transitioned
    if (isStatusChanged) {
      await tx.insert(outboxJobs).values({
        id: crypto.randomUUID(),
        eventType: 'contract.status_transitioned',
        aggregateId: contractRow.id,
        dedupeKey: `${contractRow.id}:${newStatus}:${newVersion}`,
        payload: {
          contractId: contractRow.id,
          contractNumber: contractRow.contractNumber,
          previousStatus: contractRow.status,
          currentStatus: newStatus,
          action: params.action,
          version: newVersion,
          actor: params.actor,
          timestamp: now.toISOString(),
        },
        state: 'queued',
        attempts: 0,
        nextRunAt: now,
      });
    }

    const result: WorkflowTransitionResult = {
      success: true,
      contractId: contractRow.id,
      previousStatus: contractRow.status as ContractStatus,
      currentStatus: newStatus,
      version: newVersion,
      auditLogId,
    };

    // 10. Record idempotency request
    if (params.idempotencyKey) {
      const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000); // 24h retention
      await tx
        .insert(idempotencyRequests)
        .values({
          actorKey,
          key: params.idempotencyKey,
          route: `workflow:${params.action}`,
          requestHash: crypto.randomUUID(),
          state: 'completed',
          responseStatus: 200,
          responseBody: result,
          expiresAt,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [idempotencyRequests.actorKey, idempotencyRequests.key],
          set: {
            state: 'completed',
            responseStatus: 200,
            responseBody: result,
          },
        });
    }

    return result;
  };

  if (params.tx) {
    return await runInTransaction(params.tx);
  }
  return await db.transaction(runInTransaction);
}
