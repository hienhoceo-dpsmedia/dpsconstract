import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  contracts,
  contractCycles,
  contractRevisions,
  contractFeedbackHistory,
} from '../../db/schema.js';
import { executeWorkflowTransition } from '../workflow/transition.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface SubmitDraftParams {
  contractId: string;
  actor: UserActor;
  fileId?: string;
  docsUrl?: string;
  contentHash?: string;
  note?: string;
  clock?: () => Date;
  idempotencyKey?: string;
}

export interface FeedbackDraftParams {
  contractId: string;
  actor: UserActor;
  note: string;
  clock?: () => Date;
  idempotencyKey?: string;
}

export interface ApproveSoftCopyParams {
  contractId: string;
  actor: UserActor;
  clock?: () => Date;
  idempotencyKey?: string;
}

export async function submitDraftRevision(params: SubmitDraftParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    if (!params.fileId && !params.docsUrl) {
      throw new AppError(400, 'MISSING_CONTENT', 'Nộp bản thảo yêu cầu đính kèm file DOCX hoặc link Google Docs.');
    }

    const cycleId = contract.currentCycleId;
    if (!cycleId) {
      throw new AppError(400, 'CYCLE_NOT_FOUND', 'Không tìm thấy chu trình (cycle) của hợp đồng.');
    }

    const [revCount] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(contractRevisions)
      .where(eq(contractRevisions.cycleId, cycleId));

    const revisionNumber = Number(revCount?.total || 0) + 1;
    const revisionId = crypto.randomUUID();

    // 1. Insert revision
    await tx.insert(contractRevisions).values({
      id: revisionId,
      contractId: contract.id,
      cycleId,
      revisionNumber,
      fileId: params.fileId || null,
      docsUrl: params.docsUrl || null,
      contentHash: params.contentHash || null,
      submittedBy: params.actor.userId,
      submittedAt: now,
    });

    // 2. Update contract pointers
    await tx
      .update(contracts)
      .set({
        currentRevisionId: revisionId,
        ...(params.docsUrl ? { googleDocsLink: params.docsUrl } : {}),
      })
      .where(eq(contracts.id, contract.id));

    // 3. Update cycle pointer
    await tx
      .update(contractCycles)
      .set({ currentRevisionId: revisionId })
      .where(eq(contractCycles.id, cycleId));

    // 4. Advance workflow
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'submit_draft',
      actor: params.actor,
      payload: {
        note: params.note || `Nộp bản thảo sửa đổi v${revisionNumber}`,
        hasFileOrLink: true,
      },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return {
      revisionId,
      revisionNumber,
      transitionResult,
    };
  });
}

export async function recordDraftFeedback(params: FeedbackDraftParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp nội dung ghi chú yêu cầu sửa đổi.');
  }

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    // 1. Insert Feedback History
    await tx.insert(contractFeedbackHistory).values({
      id: crypto.randomUUID(),
      contractId: contract.id,
      cycleId: contract.currentCycleId,
      revisionId: contract.currentRevisionId,
      actorId: params.actor.userId,
      note: params.note,
      createdAt: now,
    });

    // 2. Advance workflow transition to 'Chờ soạn thảo'
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'feedback_draft',
      actor: params.actor,
      payload: { note: params.note },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}

export async function approveSoftCopyDraft(params: ApproveSoftCopyParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    // Mark revision and cycle approved
    if (contract.currentRevisionId) {
      await tx
        .update(contractRevisions)
        .set({
          approvedBy: params.actor.userId,
          approvedAt: now,
        })
        .where(eq(contractRevisions.id, contract.currentRevisionId));
    }

    if (contract.currentCycleId) {
      await tx
        .update(contractCycles)
        .set({ approvedAt: now })
        .where(eq(contractCycles.id, contract.currentCycleId));
    }

    // Advance workflow
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'approve_soft_copy',
      actor: params.actor,
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}
