import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, type TestSchemaContext } from '../support/database';

describe('Ledgers, Outbox & Idempotency Constraints (T08)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
    // Setup necessary tables
    await ctx.pool.query(`
      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'legal', 'clerk'))
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_number VARCHAR(100) NOT NULL,
        name VARCHAR(500) NOT NULL,
        partner_name VARCHAR(500) NOT NULL,
        value_text VARCHAR(255) NOT NULL,
        status VARCHAR(64) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".work_items (
        id VARCHAR(64) PRIMARY KEY,
        contract_id VARCHAR(64) NOT NULL REFERENCES "${ctx.schemaName}".contracts(id),
        kind VARCHAR(32) NOT NULL,
        assignee_id VARCHAR(64) REFERENCES "${ctx.schemaName}".users(id),
        payable BOOLEAN NOT NULL DEFAULT true,
        policy_snapshot JSONB NOT NULL,
        base_pay_snapshot BIGINT NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'open'
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".payroll_entries (
        id VARCHAR(64) PRIMARY KEY,
        work_item_id VARCHAR(64) NOT NULL UNIQUE REFERENCES "${ctx.schemaName}".work_items(id),
        contract_id VARCHAR(64) NOT NULL REFERENCES "${ctx.schemaName}".contracts(id),
        beneficiary_id VARCHAR(64) NOT NULL REFERENCES "${ctx.schemaName}".users(id),
        finalized_by VARCHAR(64) NOT NULL REFERENCES "${ctx.schemaName}".users(id),
        finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        amount_vnd BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".outbox_jobs (
        id VARCHAR(64) PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        aggregate_id VARCHAR(64) NOT NULL,
        dedupe_key VARCHAR(255) NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'queued'
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".idempotency_requests (
        actor_key VARCHAR(128) NOT NULL,
        key VARCHAR(128) NOT NULL,
        route VARCHAR(255) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'pending',
        PRIMARY KEY (actor_key, key)
      );
    `);

    // Insert dummy user and contract
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".users (id, email, role)
      VALUES ('u_admin', 'admin@dps.media', 'admin'), ('u_legal', 'legal@dps.media', 'legal');
      INSERT INTO "${ctx.schemaName}".contracts (id, contract_number, name, partner_name, value_text, status)
      VALUES ('c100', 'HD-100', 'Test Contract', 'Partner', '1000', 'Chờ duyệt bản mềm');
      INSERT INTO "${ctx.schemaName}".work_items (id, contract_id, kind, assignee_id, policy_snapshot, base_pay_snapshot)
      VALUES ('w1', 'c100', 'legal', 'u_legal', '{}'::jsonb, 500000);
    `);
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('enforces exactly one finalized payroll entry per work item', async () => {
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".payroll_entries (id, work_item_id, contract_id, beneficiary_id, finalized_by, amount_vnd)
      VALUES ('pe1', 'w1', 'c100', 'u_legal', 'u_admin', 650000)
    `);

    // Second entry for same work item must be rejected
    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".payroll_entries (id, work_item_id, contract_id, beneficiary_id, finalized_by, amount_vnd)
        VALUES ('pe2', 'w1', 'c100', 'u_legal', 'u_admin', 650000)
      `)
    ).rejects.toThrow();
  });

  it('enforces outbox job dedupe key uniqueness', async () => {
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".outbox_jobs (id, event_type, aggregate_id, dedupe_key, payload)
      VALUES ('j1', 'teams_notify', 'c100', 'teams_c100_approved', '{"msg":"hello"}'::jsonb)
    `);

    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".outbox_jobs (id, event_type, aggregate_id, dedupe_key, payload)
        VALUES ('j2', 'teams_notify', 'c100', 'teams_c100_approved', '{"msg":"hello"}'::jsonb)
      `)
    ).rejects.toThrow();
  });

  it('enforces idempotency compound primary key (actor_key, key)', async () => {
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".idempotency_requests (actor_key, key, route, request_hash)
      VALUES ('actor_user_1', 'idem_key_abc', '/api/contracts/c1/approve', 'hash123')
    `);

    // Same actor and key must collide
    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".idempotency_requests (actor_key, key, route, request_hash)
        VALUES ('actor_user_1', 'idem_key_abc', '/api/contracts/c1/approve', 'hash123')
      `)
    ).rejects.toThrow();

    // Different actor can have same key without collision
    const diffActor = await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".idempotency_requests (actor_key, key, route, request_hash)
      VALUES ('actor_user_2', 'idem_key_abc', '/api/contracts/c1/approve', 'hash123')
      RETURNING actor_key, key
    `);
    expect(diffActor.rows[0].actor_key).toBe('actor_user_2');
  });
});

