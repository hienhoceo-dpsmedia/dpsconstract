import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import {
  contracts,
  contractAuditLogs,
  outboxJobs,
  users,
} from '../../server/db/schema.js';
import { executeWorkflowTransition } from '../../server/modules/workflow/transition.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Workflow Atomicity, Audit & Idempotency (T21)', () => {
  const db = getDb();
  let testClerkUser: { id: string; email: string };
  let clerkActor: UserActor;

  beforeEach(async () => {
    const userId = crypto.randomUUID();
    const email = `clerk-${Date.now()}@dps.media`;
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

  it('atomically advances status, increments version, records audit log and outbox job', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng kiểm thử Atomicity',
      partnerName: 'Công ty Đối tác ABC',
      valueText: '100.000.000 đ',
      valueAmount: '100000000',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    const res = await executeWorkflowTransition({
      contractId,
      action: 'print',
      actor: clerkActor,
      expectedVersion: 1,
    });

    expect(res.success).toBe(true);
    expect(res.previousStatus).toBe('Chờ in');
    expect(res.currentStatus).toBe('Đang chờ ký');
    expect(res.version).toBe(2);

    // Verify DB contract state
    const [updatedContract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(updatedContract.status).toBe('Đang chờ ký');
    expect(updatedContract.version).toBe(2);
    expect(updatedContract.printedAt).toBeDefined();

    // Verify Audit Log
    const auditLogs = await db
      .select()
      .from(contractAuditLogs)
      .where(eq(contractAuditLogs.contractId, contractId));

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('print');
    expect(auditLogs[0].fromStatus).toBe('Chờ in');
    expect(auditLogs[0].toStatus).toBe('Đang chờ ký');
    expect(auditLogs[0].actorId).toBe(testClerkUser.id);

    // Verify Outbox Job
    const jobs = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.aggregateId, contractId));

    expect(jobs).toHaveLength(1);
    expect(jobs[0].eventType).toBe('contract.status_transitioned');
    expect(jobs[0].state).toBe('queued');
  });

  it('guarantees idempotency when the same idempotency key is submitted twice', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-IDEM-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng kiểm thử Idempotency',
      partnerName: 'Công ty Đối tác Idempotent',
      valueText: '50.000.000 đ',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    const idempotencyKey = `idem-${Date.now()}`;

    // First call
    const run1 = await executeWorkflowTransition({
      contractId,
      action: 'print',
      actor: clerkActor,
      idempotencyKey,
    });

    expect(run1.success).toBe(true);
    expect(run1.currentStatus).toBe('Đang chờ ký');
    expect(run1.version).toBe(2);
    expect(run1.isIdempotentReplay).toBeFalsy();

    // Second call with same idempotency key
    const run2 = await executeWorkflowTransition({
      contractId,
      action: 'print',
      actor: clerkActor,
      idempotencyKey,
    });

    expect(run2.success).toBe(true);
    expect(run2.currentStatus).toBe('Đang chờ ký');
    expect(run2.version).toBe(2);
    expect(run2.isIdempotentReplay).toBe(true);

    // Ensure version was not incremented again
    const [currentDb] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(currentDb.version).toBe(2);
  });
});

