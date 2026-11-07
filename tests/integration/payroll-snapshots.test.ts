import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import {
  contracts,
  workItems,
  payrollEntries,
  users,
} from '../../server/db/schema.js';
import { finalizePayrollEntry } from '../../server/modules/payroll/finalize.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Payroll Immutable Snapshots & Finalization (T29)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let legalActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const legalId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-snap-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: legalId,
        email: `legal-snap-${Date.now()}@dps.media`,
        role: 'legal',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-snap@dps.media',
      role: 'admin',
    };

    legalActor = {
      kind: 'user',
      userId: legalId,
      email: 'legal-snap@dps.media',
      role: 'legal',
    };
  });

  it('finalizes a payroll workItem, creates an immutable snapshot, and rejects refinalization', async () => {
    const contractId = crypto.randomUUID();
    const workItemId = crypto.randomUUID();

    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-SNAP-${Date.now()}`,
      name: 'Hợp đồng kiểm thử chốt bảng lương snapshot',
      partnerName: 'Công ty Cổ phần Alpha',
      valueText: '100.000.000 đ',
      status: 'Hoàn tất',
      version: 2,
      legalAssigneeId: legalActor.userId,
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
      state: 'open',
    });

    // 1. Finalize
    const res = await finalizePayrollEntry({
      workItemId,
      actor: adminActor,
    });

    expect(res.payrollEntryId).toBeDefined();
    expect(res.finalPayroll).toBe(500000);
    expect(res.beneficiaryId).toBe(legalActor.userId);

    // Verify DB entry
    const [entry] = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.id, res.payrollEntryId));

    expect(entry).toBeDefined();
    expect(entry.engineVersion).toBe('1.0');
    expect(entry.inputSnapshot).toBeDefined();

    // Verify workItem is now finalized
    const [updatedItem] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.id, workItemId));

    expect(updatedItem.state).toBe('finalized');

    // 2. Refinalization must be rejected
    await expect(
      finalizePayrollEntry({
        workItemId,
        actor: adminActor,
      })
    ).rejects.toThrowError(/đã được chốt lương/i);
  });
});

