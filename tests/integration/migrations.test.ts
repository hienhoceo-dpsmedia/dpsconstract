import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/db-migrate';
import pg from 'pg';

describe('Database Migration Runner & Concurrency Locks (T09)', () => {
  it('applies migrations safely and records in __dps_migrations', async () => {
    await runMigrations();

    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5433/dps_contract_test',
    });
    await client.connect();

    const res = await client.query('SELECT name FROM __dps_migrations');
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows[0].name).toContain('narrow_pestilence.sql');

    await client.end();
  });

  it('runs concurrent migrators without race conditions due to advisory lock', async () => {
    // Run two migrations concurrently
    const [res1, res2] = await Promise.allSettled([
      runMigrations(),
      runMigrations(),
    ]);

    expect(res1.status).toBe('fulfilled');
    expect(res2.status).toBe('fulfilled');
  });
});

