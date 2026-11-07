import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, type TestSchemaContext } from '../support/database';
import { validateSettingsData } from '../../server/modules/settings/validation';

describe('Core Schema & Settings Validation (T06)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('validates settings policy thresholds strictly', () => {
    const valid = {
      defaultBasePayLegal: 500000,
      defaultBasePayClerk: 100000,
      slaInternalHours: 24,
      slaViettelPostDays: 3,
      slaPrintingHours: 2,
      slaCourierHours: 4,
      slaRetrievalDays: 7,
      slaEarlyMaxRate: 30,
      slaEarlyMidRate: 20,
      slaEarlyMinRate: 10,
      slaOnTimeRate: 0,
      slaLateMinRate: -10,
      slaLateMidRate: -20,
      slaLateMaxRate: -30,
      slaEarlyMaxTimePct: 50,
      slaEarlyMidTimePct: 25,
      urgencyEmergencyMaxHours: 1,
      urgencyUrgentBeforeHours: 3,
      urgencyPriorityBeforeHours: 24,
    };
    expect(validateSettingsData(valid).success).toBe(true);

    // Invalid: earlyMinTimePct >= earlyMaxTimePct
    const invalidThresholds = { ...valid, slaEarlyMaxTimePct: 20, slaEarlyMidTimePct: 30 };
    expect(validateSettingsData(invalidThresholds).success).toBe(false);

    // Invalid: urgency hours not strictly ascending
    const invalidUrgency = { ...valid, urgencyUrgentBeforeHours: 1, urgencyEmergencyMaxHours: 2 };
    expect(validateSettingsData(invalidUrgency).success).toBe(false);

    // Invalid: base pay negative
    const invalidBasePay = { ...valid, defaultBasePayLegal: -50000 };
    expect(validateSettingsData(invalidBasePay).success).toBe(false);

    // Valid: base pay zero is allowed and preserved
    const zeroBasePay = { ...valid, defaultBasePayLegal: 0 };
    expect(validateSettingsData(zeroBasePay).success).toBe(true);
  });

  it('prohibits requester role in database schema constraints', async () => {
    // Attempting to insert a user with role 'requester' should violate the CHECK constraint
    await ctx.pool.query(`
      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'legal', 'clerk')),
        status VARCHAR(32) NOT NULL DEFAULT 'invited'
      )
    `);

    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".users (id, email, role)
        VALUES ('u1', 'test@example.com', 'requester')
      `)
    ).rejects.toThrow();

    const insertLegal = await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".users (id, email, role)
      VALUES ('u2', 'legal@dps.media', 'legal')
      RETURNING id, role
    `);
    expect(insertLegal.rows[0].role).toBe('legal');
  });
});

