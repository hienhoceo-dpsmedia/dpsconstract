import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, users } from '../../server/db/schema.js';
import { executeWorkflowTransition } from '../../server/modules/workflow/transition.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Workflow Concurrency & Race-Condition Safety (T21)', () => {
  const db = getDb();
  let testClerkUser: { id: string; email: string };
  let clerkActor: UserActor;

  beforeEach(async () => {
    const userId = crypto.randomUUID();
    const email = `clerk-conc-${Date.now()}@dps.media`;
    const [inserted] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        role: 'clerk',
        passwordHash: 'dummy-hash',
        status: 'active',
        authVersion: 1,
      })
      .returning();

    testClerkUser = inserted;
    clerkActor = {
      kind: 'user',
      userId: testClerkUser.id,
      email: testClerkUser.email,
      role: 'clerk',
    };
  });

  it('safely handles concurrent transitions on the same contract via optimistic locks', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-RACE-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng kiểm thử Concurrency',
      partnerName: 'Công ty Đối tác Race Condition',
      valueText: '200.000.000 đ',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    // Execute two simultaneous transitions with expectedVersion = 1
    const results = await Promise.allSettled([
      executeWorkflowTransition({
        contractId,
        action: 'print',
        actor: clerkActor,
        expectedVersion: 1,
      }),
      executeWorkflowTransition({
        contractId,
        action: 'print',
        actor: clerkActor,
        expectedVersion: 1,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed, and one should be rejected due to version mismatch or status error
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rej = rejected[0] as PromiseRejectedResult;
    expect(rej.reason.message).toMatch(/(Xung đột phiên bản|Không thể thực hiện)/i);

    // Final DB contract version should be strictly 2
    const [finalContract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(finalContract.version).toBe(2);
    expect(finalContract.status).toBe('Đang chờ ký');
  });
});

