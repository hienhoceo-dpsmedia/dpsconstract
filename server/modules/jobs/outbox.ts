import crypto from 'crypto';
import { getDb, getPool } from '../../db/client.js';
import { outboxJobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { sendTeamsNotification } from '../integrations/teams.js';
import { extractContractMetadata } from '../integrations/gemini.js';
import { processVtpWebhookEvent } from '../integrations/vtp.js';
import { getSettingsRecord } from '../settings/repository.js';

export interface EnqueueJobParams {
  eventType: string;
  aggregateId: string;
  payload: Record<string, any>;
  dedupeKey?: string;
}

export interface OutboxJobRecord {
  id: string;
  eventType: string;
  aggregateId: string;
  dedupeKey: string;
  payload: any;
  state: 'queued' | 'running' | 'succeeded' | 'retry' | 'awaiting_reconciliation' | 'dead' | 'skipped';
  attempts: number;
  nextRunAt: Date;
  lockedUntil: Date | null;
  lastError: string | null;
  createdAt: Date;
}

/**
 * Enqueues a persistent job into the outbox queue
 */
export async function enqueueJob(params: EnqueueJobParams): Promise<OutboxJobRecord> {
  const db = getDb();
  const id = `job_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const dedupeKey = params.dedupeKey || `dedupe_${id}`;

  const [job] = await db
    .insert(outboxJobs)
    .values({
      id,
      eventType: params.eventType,
      aggregateId: params.aggregateId,
      dedupeKey,
      payload: params.payload,
      state: 'queued',
      attempts: 0,
    })
    .onConflictDoNothing({ target: outboxJobs.dedupeKey })
    .returning();

  if (!job) {
    // Already enqueued with this dedupe key
    const [existing] = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.dedupeKey, dedupeKey))
      .limit(1);
    return existing as OutboxJobRecord;
  }

  return job as OutboxJobRecord;
}

/**
 * Claims a batch of ready jobs atomically using PostgreSQL FOR UPDATE SKIP LOCKED
 */
export async function claimNextJobs(batchSize: number = 5): Promise<OutboxJobRecord[]> {
  const pool = getPool();
  const query = `
    UPDATE "outboxJobs"
    SET "state" = 'running',
        "locked_until" = NOW() + INTERVAL '1 minute',
        "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "outboxJobs"
      WHERE ("state" = 'queued' OR "state" = 'retry')
        AND "next_run_at" <= NOW()
        AND ("locked_until" IS NULL OR "locked_until" < NOW())
      ORDER BY "created_at" ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING 
      "id", "event_type" as "eventType", "aggregate_id" as "aggregateId",
      "dedupe_key" as "dedupeKey", "payload", "state", "attempts",
      "next_run_at" as "nextRunAt", "locked_until" as "lockedUntil",
      "last_error" as "lastError", "created_at" as "createdAt";
  `;

  const result = await pool.query(query, [batchSize]);
  return result.rows as OutboxJobRecord[];
}

/**
 * Dispatches and executes an individual outbox job with retry handling
 */
export async function processJob(job: OutboxJobRecord): Promise<void> {
  const db = getDb();

  try {
    if (job.payload?.__throwError) {
      throw new Error(job.payload.__throwError);
    }

    switch (job.eventType) {
      case 'teams_webhook': {
        const settings = await getSettingsRecord();
        const webhookUrl = settings?.teamsWebhookUrl;
        await sendTeamsNotification(webhookUrl, job.payload);
        break;
      }

      case 'gemini_extract': {
        await extractContractMetadata(job.payload.text || '', job.payload.mimeType);
        break;
      }

      case 'vtp_tracking': {
        await processVtpWebhookEvent(job.payload);
        break;
      }

      default:
        // Unknown or custom job type
        break;
    }

    // Mark as succeeded
    await db
      .update(outboxJobs)
      .set({
        state: 'succeeded',
        lockedUntil: null,
      })
      .where(eq(outboxJobs.id, job.id));
  } catch (err: any) {
    const nextAttempts = job.attempts;
    const isDead = nextAttempts >= 5;
    // Exponential backoff: 2^attempts * 1000ms
    const backoffMs = Math.pow(2, nextAttempts) * 1000;
    const nextRun = new Date(Date.now() + backoffMs);

    await db
      .update(outboxJobs)
      .set({
        state: isDead ? 'dead' : 'retry',
        nextRunAt: nextRun,
        lockedUntil: null,
        lastError: err.message || String(err),
      })
      .where(eq(outboxJobs.id, job.id));
  }
}

/**
 * Runs a single worker poll iteration
 */
export async function runOutboxWorkerIteration(batchSize: number = 5): Promise<number> {
  const jobs = await claimNextJobs(batchSize);
  for (const job of jobs) {
    await processJob(job);
  }
  return jobs.length;
}

/**
 * Starts continuous background outbox worker
 */
export function startOutboxWorker(intervalMs: number = 5000): { stop: () => void } {
  let isRunning = false;
  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runOutboxWorkerIteration();
    } catch (e) {
      console.error('[OUTBOX_WORKER_ERROR]', e);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
