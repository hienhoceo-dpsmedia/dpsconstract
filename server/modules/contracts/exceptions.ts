import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, contractCycles, shipments } from '../../db/schema.js';
import { executeWorkflowTransition } from '../workflow/transition.js';
import type { Actor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface ExceptionActionParams {
  contractId: string;
  note: string;
  actor: Actor;
  clock?: () => Date;
  idempotencyKey?: string;
}

export async function rejectContract(params: ExceptionActionParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp lý do từ chối ký.');
  }

  return await executeWorkflowTransition({
    contractId: params.contractId,
    action: 'reject',
    actor: params.actor,
    payload: { note: params.note },
    clock: params.clock,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function reportIssueContract(params: ExceptionActionParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp mô tả sự cố vận chuyển.');
  }

  const db = getDb();

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    if (contract.currentShipmentId) {
      await tx
        .update(shipments)
        .set({ status: 'issue' })
        .where(eq(shipments.id, contract.currentShipmentId));
    }

    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'report_issue',
      actor: params.actor,
      payload: { note: params.note },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}

export async function redraftContract(params: ExceptionActionParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp ghi chú yêu cầu soạn thảo lại.');
  }

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

    const [cycleCount] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(contractCycles)
      .where(eq(contractCycles.contractId, contract.id));

    const newCycleNumber = Number(cycleCount?.total || 0) + 1;
    const newCycleId = crypto.randomUUID();

    // 1. Create new cycle preserving previous cycle history
    await tx.insert(contractCycles).values({
      id: newCycleId,
      contractId: contract.id,
      cycleNumber: newCycleNumber,
      type: 'redraft',
      startedAt: now,
    });

    // 2. Link contract to new cycle
    await tx
      .update(contracts)
      .set({
        currentCycleId: newCycleId,
        currentRevisionId: null,
      })
      .where(eq(contracts.id, contract.id));

    // 3. Advance workflow transition to 'Chờ duyệt bản mềm'
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'redraft',
      actor: params.actor,
      payload: { note: params.note },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return {
      newCycleId,
      cycleNumber: newCycleNumber,
      transitionResult,
    };
  });
}

export async function reshipContract(params: ExceptionActionParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp lý do giao lại bưu cục.');
  }

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

    // Supersede current shipment
    if (contract.currentShipmentId) {
      await tx
        .update(shipments)
        .set({
          status: 'failed',
          supersededAt: now,
        })
        .where(eq(shipments.id, contract.currentShipmentId));
    }

    // Advance workflow to 'Chờ tạo vận đơn'
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'reship',
      actor: params.actor,
      payload: { note: params.note },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}

export async function cancelContract(params: ExceptionActionParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp lý do hủy hợp đồng.');
  }

  return await executeWorkflowTransition({
    contractId: params.contractId,
    action: 'cancel',
    actor: params.actor,
    payload: { note: params.note },
    clock: params.clock,
    idempotencyKey: params.idempotencyKey,
  });
}

