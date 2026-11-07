import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, users } from '../../server/db/schema.js';
import { executeWorkflowTransition } from '../../server/modules/workflow/transition.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Completion Terminal Invariants & Immutability (T24)', () => {
  const db = getDb();
  let adminActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();

    await db.insert(users).values({
      id: adminId,
      email: `admin-term-${Date.now()}@dps.media`,
      role: 'admin',
      passwordHash: 'dummy',
      status: 'active',
      authVersion: 1,
    });

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-term@dps.media',
      role: 'admin',
    };
  });

  it('rejects all further state transitions once a contract reaches "Hoàn tất"', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-DONE-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng đã hoàn tất lưu kho',
      partnerName: 'Công ty Đối tác Đã xong',
      valueText: '25.000.000 đ',
      status: 'Hoàn tất',
      version: 5,
      processingMethod: 'physical',
      archivedAt: new Date(),
    });

    // Attempt cancel on completed contract
    await expect(
      executeWorkflowTransition({
        contractId,
        action: 'cancel',
        actor: adminActor,
        payload: { note: 'Muốn hủy hợp đồng đã hoàn tất' },
      })
    ).rejects.toThrowError(/Không thể thực hiện/i);

    // Attempt print on completed contract
    await expect(
      executeWorkflowTransition({
        contractId,
        action: 'print',
        actor: adminActor,
      })
    ).rejects.toThrowError(/Không thể thực hiện/i);

    // Ensure status remains untouched
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Hoàn tất');
    expect(contract.version).toBe(5);
  });
});

