import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, TestSchemaContext } from '../support/database.js';
import {
  enqueueJob,
  claimNextJobs,
  processJob,
} from '../../server/modules/jobs/outbox.js';
import { getDb } from '../../server/db/client.js';
import { outboxJobs } from '../../server/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Outbox Queue & Worker Engine (T42, T43)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
    await ctx.pool.query('DELETE FROM "outboxJobs"');
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('enqueues a job with unique dedupe key idempotently', async () => {
    const dedupeKey = `dedupe_test_${Date.now()}`;
    const job1 = await enqueueJob({
      eventType: 'teams_webhook',
      aggregateId: 'c_test_1',
      payload: { title: 'Test 1', text: 'Hello' },
      dedupeKey,
    });

    expect(job1.id).toBeDefined();
    expect(job1.state).toBe('queued');

    // Second enqueue with same dedupeKey should return existing job without duplicating
    const job2 = await enqueueJob({
      eventType: 'teams_webhook',
      aggregateId: 'c_test_1',
      payload: { title: 'Test 1 Dup', text: 'Hello' },
      dedupeKey,
    });

    expect(job2.id).toBe(job1.id);
  });

  it('claims ready jobs atomically using SKIP LOCKED', async () => {
    const dedupeKey = `claim_test_${Date.now()}`;
    await enqueueJob({
      eventType: 'teams_webhook',
      aggregateId: 'c_test_2',
      payload: { title: 'Claim Test', text: 'Body' },
      dedupeKey,
    });

    const claimed = await claimNextJobs(10);
    const ourJob = claimed.find(j => j.dedupeKey === dedupeKey);
    expect(ourJob).toBeDefined();
    expect(ourJob?.state).toBe('running');
    expect(ourJob?.attempts).toBe(1);

    // Another claim immediately should NOT return this job because it is already running
    const claimedSecond = await claimNextJobs(10);
    const ourJobSecond = claimedSecond.find(j => j.dedupeKey === dedupeKey);
    expect(ourJobSecond).toBeUndefined();
  });

  it('marks job as succeeded after successful execution', async () => {
    const dedupeKey = `success_test_${Date.now()}`;
    const job = await enqueueJob({
      eventType: 'teams_webhook',
      aggregateId: 'c_test_3',
      payload: { title: 'Success Job', text: 'Hello' },
      dedupeKey,
    });

    // Execute job
    await processJob(job);

    const db = getDb();
    const [updated] = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.id, job.id));

    expect(updated.state).toBe('succeeded');
  });

  it('handles job failure with retry backoff and dead-letter progression', async () => {
    const db = getDb();
    const dedupeKey = `fail_test_${Date.now()}`;
    const job = await enqueueJob({
      eventType: 'teams_webhook',
      aggregateId: 'c_test_4',
      payload: { title: 'Fail Test', text: 'Boom', __throwError: 'Simulated connection failure' },
      dedupeKey,
    });

    // Attempt 1: Should fail and go to 'retry'
    await processJob(job);

    const [retryJob] = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.id, job.id));

    expect(retryJob.state).toBe('retry');
    expect(retryJob.lastError).toContain('Simulated connection failure');

    // Simulate 5 attempts -> should become 'dead'
    retryJob.attempts = 5;
    await processJob(retryJob as any);

    const [deadJob] = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.id, job.id));

    expect(deadJob.state).toBe('dead');
  });
});
