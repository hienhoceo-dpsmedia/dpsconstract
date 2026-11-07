import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const ADVISORY_LOCK_ID = 74839201;

export async function runMigrations(connectionString?: string): Promise<void> {
  const conn = connectionString || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5433/dps_contract_test';
  const client = new pg.Client({ connectionString: conn });

  try {
    await client.connect();
    console.log('[MIGRATION] Connected to PostgreSQL. Acquiring advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);

    // Ensure migration journal table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__dps_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure drizzle migrations directory or init SQL exists
    const drizzleDir = path.resolve('drizzle');
    if (fs.existsSync(drizzleDir)) {
      const files = fs.readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const { rows } = await client.query('SELECT name FROM __dps_migrations WHERE name = $1', [file]);
        if (rows.length === 0) {
          console.log(`[MIGRATION] Applying migration: ${file}...`);
          const sqlContent = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
          await client.query('BEGIN');
          try {
            await client.query(sqlContent);
            await client.query('INSERT INTO __dps_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`[MIGRATION] Applied: ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        }
      }
    } else {
      console.log('[MIGRATION] No drizzle migrations directory found yet.');
    }

    console.log('[MIGRATION] Migrations completed successfully.');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
    } catch {
      // Ignore unlock errors on shutdown
    }
    await client.end();
  }
}

// Direct execution from CLI
if (process.argv[1]?.endsWith('db-migrate.ts') || process.argv[1]?.endsWith('db-migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MIGRATION_ERROR]', err);
      process.exit(1);
    });
}

