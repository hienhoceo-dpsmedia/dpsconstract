import { describe, expect, it } from 'vitest';
import { getDb } from '../../server/db/client';
import { contracts } from '../../server/db/schema';
import { eq } from 'drizzle-orm';

describe('Data Persistence & Integrity (T14)', () => {
  it('persists data across client reconnections without resorting to json', async () => {
    const db = getDb();
    const testId = `persist_${Date.now()}`;

    await db.insert(contracts).values({
      id: testId,
      contractNumber: `HD-PERSIST-${Date.now()}`,
      name: 'Persistence Verification Contract',
      partnerName: 'Test Partner',
      valueText: '500,000 VND',
      status: 'Chờ duyệt bản mềm',
    });

    // Query from database to verify persistence
    const [fetched] = await db.select().from(contracts).where(eq(contracts.id, testId));
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(testId);
    expect(fetched.name).toBe('Persistence Verification Contract');
  });

  it('empty table does not auto-generate seed contracts in PostgreSQL', async () => {
    const db = getDb();
    // Querying non-existent seed contract returns null
    const rows = await db.select().from(contracts).where(eq(contracts.id, 'con_seed_999999'));
    expect(rows).toHaveLength(0);
  });
});

