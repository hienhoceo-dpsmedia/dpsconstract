import { eq, sum } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { payrollAdjustments, payrollEntries, users } from '../../db/schema.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface CreateAdjustmentParams {
  entryId: string;
  deltaVnd: number;
  reason: string;
  idempotencyKey: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function createPayrollAdjustment(params: CreateAdjustmentParams) {
  if (!params.reason || params.reason.trim() === '') {
    throw new AppError(400, 'MISSING_REASON', 'Vui lòng cung cấp lý do điều chỉnh lương.');
  }

  if (!params.idempotencyKey || params.idempotencyKey.trim() === '') {
    throw new AppError(400, 'MISSING_IDEMPOTENCY_KEY', 'Khóa idempotency là bắt buộc.');
  }

  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    // 1. Verify payroll entry exists
    const [entry] = await tx
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.id, params.entryId));

    if (!entry) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'Không tìm thấy bản ghi lương tương ứng.');
    }

    // 2. Check duplicate idempotency key
    const [existing] = await tx
      .select()
      .from(payrollAdjustments)
      .where(eq(payrollAdjustments.idempotencyKey, params.idempotencyKey));

    if (existing) {
      return {
        adjustmentId: existing.id,
        isIdempotentReplay: true,
        deltaVnd: existing.deltaVnd,
        reason: existing.reason,
      };
    }

    const adjustmentId = crypto.randomUUID();

    const [inserted] = await tx
      .insert(payrollAdjustments)
      .values({
        id: adjustmentId,
        entryId: entry.id,
        deltaVnd: Math.round(params.deltaVnd),
        reason: params.reason,
        idempotencyKey: params.idempotencyKey,
        createdBy: params.actor.userId,
        createdAt: now,
      })
      .returning();

    return {
      adjustmentId,
      deltaVnd: inserted.deltaVnd,
      reason: inserted.reason,
      createdAt: inserted.createdAt,
    };
  });
}

export async function getNetPayrollAmount(entryId: string): Promise<{
  baseAmountVnd: number;
  totalAdjustmentsVnd: number;
  netAmountVnd: number;
}> {
  const db = getDb();
  const [entry] = await db
    .select({ amountVnd: payrollEntries.amountVnd })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, entryId));

  if (!entry) {
    throw new AppError(404, 'ENTRY_NOT_FOUND', 'Không tìm thấy bản ghi lương.');
  }

  const adjustments = await db
    .select()
    .from(payrollAdjustments)
    .where(eq(payrollAdjustments.entryId, entryId));

  const totalAdjustments = adjustments.reduce((acc, curr) => acc + curr.deltaVnd, 0);
  const netAmount = Math.max(0, entry.amountVnd + totalAdjustments);

  return {
    baseAmountVnd: entry.amountVnd,
    totalAdjustmentsVnd: totalAdjustments,
    netAmountVnd: netAmount,
  };
}

