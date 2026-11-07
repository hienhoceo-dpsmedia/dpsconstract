import pg from 'pg';

export function isSafeSchemaName(name: string): boolean {
  if (!name || name === 'public') return false;
  if (name.length > 63) return false;
  return /^[a-z][a-z0-9_]*$/.test(name);
}

export function validateTestDatabaseUrl(url: string): boolean {
  if (!url) {
    throw new Error('Test database URL cannot be empty');
  }

  const lowercase = url.toLowerCase();
  if (
    lowercase.includes('prod') ||
    lowercase.includes('production') ||
    lowercase.includes('live')
  ) {
    throw new Error(`Refusing to run tests against suspected production database URL: ${url}`);
  }

  return true;
}

export interface TestSchemaContext {
  schemaName: string;
  pool: pg.Pool;
  cleanup: () => Promise<void>;
}

export async function createIsolatedTestSchema(
  connectionString: string = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dps_contract_test'
): Promise<TestSchemaContext> {
  validateTestDatabaseUrl(connectionString);

  const schemaName = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  if (!isSafeSchemaName(schemaName)) {
    throw new Error(`Generated invalid test schema name: ${schemaName}`);
  }

  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  await pool.query(`SET search_path TO "${schemaName}", public`);

  return {
    schemaName,
    pool,
    cleanup: async () => {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await pool.end();
      }
    },
  };
}

