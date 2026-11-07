import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, shipments } from '../../db/schema.js';
import { executeWorkflowTransition } from '../workflow/transition.js';
import type { Actor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface PhysicalTransitionParams {
  contractId: string;
  actor: Actor;
  clock?: () => Date;
  idempotencyKey?: string;
}

export interface AssignWaybillParams extends PhysicalTransitionParams {
  waybillCode: string;
}

export async function confirmPrintContract(params: PhysicalTransitionParams) {
  return await executeWorkflowTransition({
    contractId: params.contractId,
    action: 'print',
    actor: params.actor,
    clock: params.clock,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function confirmSignContract(params: PhysicalTransitionParams) {
  return await executeWorkflowTransition({
    contractId: params.contractId,
    action: 'sign',
    actor: params.actor,
    clock: params.clock,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function assignWaybillContract(params: AssignWaybillParams) {
  const code = (params.waybillCode || '').trim().toUpperCase();
  if (!code) {
    throw new AppError(400, 'MISSING_WAYBILL_CODE', 'Vui lòng cung cấp mã vận đơn hợp lệ.');
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

    const shipmentId = crypto.randomUUID();

    // 1. Create shipment record
    await tx.insert(shipments).values({
      id: shipmentId,
      contractId: contract.id,
      cycleId: contract.currentCycleId,
      attemptNumber: 1,
      provider: 'viettelpost',
      waybillCode: code,
      status: 'created',
      manualCreated: true,
      createdAt: now,
    });

    // 2. Link currentShipmentId
    await tx
      .update(contracts)
      .set({ currentShipmentId: shipmentId })
      .where(eq(contracts.id, contract.id));

    // 3. Execute workflow transition
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'assign_waybill',
      actor: params.actor,
      payload: { waybillCode: code },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return {
      shipmentId,
      waybillCode: code,
      transitionResult,
    };
  });
}

export async function confirmPickupContract(params: PhysicalTransitionParams) {
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
        .set({ status: 'picked_up' })
        .where(eq(shipments.id, contract.currentShipmentId));
    }

    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'confirm_pickup',
      actor: params.actor,
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}

export async function confirmDeliveryContract(params: PhysicalTransitionParams) {
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
        .set({ status: 'delivered' })
        .where(eq(shipments.id, contract.currentShipmentId));
    }

    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'confirm_delivery',
      actor: params.actor,
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return { transitionResult };
  });
}

