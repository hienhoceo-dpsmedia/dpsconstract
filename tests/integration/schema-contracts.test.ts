import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, type TestSchemaContext } from '../support/database';
import { CONTRACT_STATUSES } from '../../src/shared/contracts';

describe('Contracts & Revision Schema Constraints (T07)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
    // Create base tables in isolated schema
    await ctx.pool.query(`
      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'legal', 'clerk')),
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_number VARCHAR(100) NOT NULL,
        name VARCHAR(500) NOT NULL,
        partner_name VARCHAR(500) NOT NULL,
        value_text VARCHAR(255) NOT NULL,
        status VARCHAR(64) NOT NULL CHECK (status IN (${CONTRACT_STATUSES.map(s => `'${s}'`).join(', ')})),
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX idx_contracts_lower_number ON "${ctx.schemaName}".contracts (LOWER(TRIM(contract_number)));

      CREATE TABLE IF NOT EXISTS "${ctx.schemaName}".contract_identifiers (
        code VARCHAR(100) PRIMARY KEY,
        kind VARCHAR(32) NOT NULL,
        contract_id VARCHAR(64) NOT NULL REFERENCES "${ctx.schemaName}".contracts(id)
      );
    `);
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('rejects invalid contract status not in 12 defined statuses', async () => {
    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".contracts (id, contract_number, name, partner_name, value_text, status)
        VALUES ('c1', 'HD-001', 'Test', 'Partner', '1000', 'Trạng thái lạ')
      `)
    ).rejects.toThrow();
  });

  it('rejects case-insensitive and whitespace duplicate contract numbers', async () => {
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".contracts (id, contract_number, name, partner_name, value_text, status)
      VALUES ('c2', 'HD-ABC-01', 'Test', 'Partner', '1000', 'Chờ in')
    `);

    // Duplicate with lower-case and whitespace
    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".contracts (id, contract_number, name, partner_name, value_text, status)
        VALUES ('c3', '  hd-abc-01  ', 'Test 2', 'Partner 2', '2000', 'Chờ in')
      `)
    ).rejects.toThrow();
  });

  it('identifier registry prevents duplicate codes across contracts', async () => {
    await ctx.pool.query(`
      INSERT INTO "${ctx.schemaName}".contract_identifiers (code, kind, contract_id)
      VALUES ('CODE-123', 'id', 'c2')
    `);

    // Another contract cannot claim the same code
    await expect(
      ctx.pool.query(`
        INSERT INTO "${ctx.schemaName}".contract_identifiers (code, kind, contract_id)
        VALUES ('CODE-123', 'id', 'c2_other')
      `)
    ).rejects.toThrow();
  });
});

