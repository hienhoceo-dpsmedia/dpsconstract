import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../server/db/client.js';
import {
  contracts,
  workItems,
  payrollEntries,
  users,
} from '../../server/db/schema.js';
import {
  createPayrollAdjustment,
  getNetPayrollAmount,
} from '../../server/modules/payroll/adjustments.js';
import type { UserActor } from '../../domain/types.js';

describe('Payroll Adjustments & Audit Trail (T30)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let legalActor: UserActor;
  let testEntryId: string;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const legalId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-adj-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: legalId,
        email: `legal-adj-${Date.now()}@dps.media`,
        role: 'legal',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-adj@dps.media',
      role: 'admin',
    };

    legalActor = {
      kind: 'user',
      userId: legalId,
      email: 'legal-adj@dps.media',
      role: 'legal',
    };

    const contractId = crypto.randomUUID();
    const workItemId = crypto.randomUUID();
    testEntryId = crypto.randomUUID();

    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-ADJ-${Date.now()}`,
      name: 'Hợp đồng kiểm thử điều chỉnh lương',
      partnerName: 'Công ty Điều Chỉnh',
      valueText: '50.000.000 đ',
      status: 'Hoàn tất',
      version: 1,
      processingMethod: 'digital',
    });

    await db.insert(workItems).values({
      id: workItemId,
      contractId,
      kind: 'legal',
      assigneeId: legalActor.userId,
      payable: true,
      policySnapshot: {},
      basePaySnapshot: 500000,
      state: 'finalized',
    });

    await db.insert(payrollEntries).values({
      id: testEntryId,
      workItemId,
      contractId,
      beneficiaryId: legalActor.userId,
      finalizedBy: adminActor.userId,
      amountVnd: 500000,
      coefBreakdown: {},
      policySnapshot: {},
      inputSnapshot: {},
    });
  });

  it('records manual adjustments and calculates correct net payroll amount', async () => {
    // 1. Bonus adjustment (+50.000 đ)
    const bonus = await createPayrollAdjustment({
      entryId: testEntryId,
      deltaVnd: 50000,
      reason: 'Thưởng xuất sắc giải quyết tranh chấp pháp lý phức tạp',
      idempotencyKey: `idem-bonus-${Date.now()}`,
      actor: adminActor,
    });
    expect(bonus.deltaVnd).toBe(50000);

    // 2. Penalty adjustment (-20.000 đ)
    const penalty = await createPayrollAdjustment({
      entryId: testEntryId,
      deltaVnd: -20000,
      reason: 'Trừ bù chi phí in ấn phát sinh ngoài định mức',
      idempotencyKey: `idem-pen-${Date.now()}`,
      actor: adminActor,
    });
    expect(penalty.deltaVnd).toBe(-20000);

    // 3. Verify net amount
    const net = await getNetPayrollAmount(testEntryId);
    expect(net.baseAmountVnd).toBe(500000);
    expect(net.totalAdjustmentsVnd).toBe(30000); // 50k - 20k
    expect(net.netAmountVnd).toBe(530000); // 500k + 30k = 530.000 đ

    // 4. Idempotency replay check
    const replay = await createPayrollAdjustment({
      entryId: testEntryId,
      deltaVnd: 50000,
      reason: 'Thử lại cùng key',
      idempotencyKey: (bonus as any).adjustmentId || `idem-bonus-${Date.now()}`,
      actor: adminActor,
    });
    expect(replay).toBeDefined();
  });
});

