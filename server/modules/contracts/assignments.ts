import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, workItems, contractAuditLogs, users } from '../../db/schema.js';
import type { UserActor } from '../../domain/types.js';
import type { Role } from '../../../src/shared/contracts.js';
import { AppError } from '../../http/errors.js';

export interface AssignPersonnelParams {
  contractId: string;
  role: 'legal' | 'clerk';
  assigneeId: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function assignContractPersonnel(params: AssignPersonnelParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    // 1. Validate contract exists
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    // 2. Validate assignee user exists and matches role
    const [assignee] = await tx
      .select()
      .from(users)
      .where(eq(users.id, params.assigneeId));

    if (!assignee) {
      throw new AppError(404, 'ASSIGNEE_NOT_FOUND', 'Không tìm thấy tài khoản nhân sự được gán.');
    }

    if (assignee.role !== params.role && assignee.role !== 'admin') {
      throw new AppError(
        400,
        'ROLE_MISMATCH',
        `Tài khoản "${assignee.email}" có vai trò "${assignee.role}", không phù hợp cho vị trí "${params.role}".`
      );
    }

    // 3. Update contract pointer
    const updateContractValues =
      params.role === 'legal'
        ? { legalAssigneeId: assignee.id }
        : { clerkAssigneeId: assignee.id };

    await tx.update(contracts).set(updateContractValues).where(eq(contracts.id, contract.id));

    // 4. Update or create Work Item
    const [existingWorkItem] = await tx
      .select()
      .from(workItems)
      .where(and(eq(workItems.contractId, contract.id), eq(workItems.kind, params.role)));

    if (existingWorkItem) {
      await tx
        .update(workItems)
        .set({ assigneeId: assignee.id })
        .where(eq(workItems.id, existingWorkItem.id));
    }

    // 5. Audit Log
    await tx.insert(contractAuditLogs).values({
      id: crypto.randomUUID(),
      contractId: contract.id,
      cycleId: contract.currentCycleId,
      action: 'assign_personnel',
      fromStatus: contract.status,
      toStatus: contract.status,
      actorKind: 'user',
      actorId: params.actor.userId,
      actorEmail: params.actor.email,
      reason: `Gán phụ trách ${params.role.toUpperCase()} cho: ${assignee.email}`,
      createdAt: now,
    });

    return {
      success: true,
      role: params.role,
      assignee: {
        id: assignee.id,
        email: assignee.email,
        name: assignee.name,
      },
    };
  });
}

