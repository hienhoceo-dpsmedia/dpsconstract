import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { loadConfig } from '../config.js';

const config = loadConfig();

let poolInstance: pg.Pool | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (poolInstance && !connectionString) {
    return poolInstance;
  }

  const conn = connectionString || config.DATABASE_URL;
  if (!conn && config.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not configured for database pool');
  }

  const pool = new pg.Pool({
    connectionString: conn || 'postgresql://postgres:postgrespassword@localhost:5433/dps_contract_test',
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  });

  pool.on('error', (err) => {
    console.error('[DB_POOL_ERROR] Unexpected error on idle client:', err.message);
  });

  if (!connectionString) {
    poolInstance = pool;
  }

  return pool;
}

export function getDb(connectionString?: string) {
  const pool = getPool(connectionString);
  return drizzle(pool, { schema });
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

