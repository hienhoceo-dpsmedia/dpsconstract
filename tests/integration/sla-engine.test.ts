import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, TestSchemaContext } from '../support/database.js';
import { scanAndDetectSlaBreaches } from '../../server/modules/sla/engine.js';
import { getDb } from '../../server/db/client.js';
import { contracts, slaAlerts, outboxJobs } from '../../server/db/schema.js';
import { eq } from 'drizzle-orm';

describe('SLA Scanning & Detection Engine (T50)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('detects internal stage delays exceeding threshold and raises alerts', async () => {
    const db = getDb();
    const contractId = `c_sla_${Date.now()}`;
    const enteredAt30hAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);

    // 1. Insert contract stuck at "Chờ in" for 30 hours
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-SLA-${Date.now().toString().slice(-6)}`,
      name: 'Hợp Đồng Thử Nghiệm Quá Hạn SLA',
      partnerName: 'Công Ty Quá Hạn',
      valueText: '20.000.000 VNĐ',
      status: 'Chờ in',
      processingMethod: 'physical',
      statusEnteredAt: enteredAt30hAgo,
      lastActivityAt: enteredAt30hAgo,
      slaBreached: false,
    });

    // 2. Run SLA scanner
    const result = await scanAndDetectSlaBreaches();

    expect(result.breachedCount).toBeGreaterThanOrEqual(1);
    expect(result.internalBreaches).toContain(contractId);

    // 3. Verify contract record updated in DB
    const [updatedContract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId));

    expect(updatedContract.slaBreached).toBe(true);
    expect(updatedContract.slaBreachType).toBe('internal');

    // 4. Verify alert created in slaAlerts
    const alerts = await db
      .select()
      .from(slaAlerts)
      .where(eq(slaAlerts.contractId, contractId));

    expect(alerts.length).toBeGreaterThanOrEqual(1);

    // 5. Verify Teams webhook job enqueued in outboxJobs
    const jobs = await db
      .select()
      .from(outboxJobs)
      .where(eq(outboxJobs.aggregateId, contractId));

    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs[0].eventType).toBe('teams_webhook');
  });
});

