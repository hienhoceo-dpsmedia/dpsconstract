import { describe, expect, it } from 'vitest';
import { isSafeSchemaName, validateTestDatabaseUrl } from '../support/database';
import { createTestClock } from '../support/clock';
import { createSamplePdfBuffer, createSampleDocxBuffer } from '../support/fixtures';

describe('Test Safety and Isolation Harness', () => {
  it('validates schema names to prevent SQL injection and unsafe identifiers', () => {
    expect(isSafeSchemaName('test_schema_1')).toBe(true);
    expect(isSafeSchemaName('test_123')).toBe(true);
    expect(isSafeSchemaName('public')).toBe(false); // public cannot be an isolated ephemeral schema
    expect(isSafeSchemaName('test; DROP TABLE users;')).toBe(false);
    expect(isSafeSchemaName('test"schema')).toBe(false);
    expect(isSafeSchemaName('')).toBe(false);
    expect(isSafeSchemaName('a'.repeat(64))).toBe(false); // PostgreSQL max identifier length is 63
  });

  it('rejects production database URLs for testing', () => {
    expect(() => validateTestDatabaseUrl('postgresql://app:secret@prod.db.internal:5432/contracts_prod')).toThrow();
    expect(() => validateTestDatabaseUrl('postgresql://user:pass@localhost:5432/contracts_production')).toThrow();
    expect(validateTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/dps_contract_test')).toBe(true);
  });

  it('deterministic clock advances time without sleeping', () => {
    const clock = createTestClock('2026-11-07T08:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-07T08:00:00.000Z');

    clock.advance(3600 * 1000); // 1 hour
    expect(clock.now().toISOString()).toBe('2026-11-07T09:00:00.000Z');

    clock.set('2026-11-08T12:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-08T12:00:00.000Z');
  });

  it('creates sample valid PDF and DOCX buffers for upload tests', () => {
    const pdf = createSamplePdfBuffer();
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');

    const docx = createSampleDocxBuffer();
    expect(docx.length).toBeGreaterThan(0);
    // PK zip signature for DOCX
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
  });
});

