import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { authTokens } from '../../db/schema.js';

export function hashAuthToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createAuthToken(
  userId: string,
  type: 'invite' | 'reset',
  durationMs: number
): Promise<{ rawToken: string; id: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashAuthToken(rawToken);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationMs);

  const db = getDb();
  await db.insert(authTokens).values({
    id,
    userId,
    type,
    tokenHash,
    expiresAt,
  });

  return { rawToken, id, expiresAt };
}

export async function consumeAuthToken(
  rawToken: string,
  expectedType: 'invite' | 'reset'
): Promise<{ userId: string } | null> {
  const tokenHash = hashAuthToken(rawToken);
  const now = new Date();
  const db = getDb();

  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, expectedType),
          sql`${authTokens.expiresAt} > ${now}`,
          sql`${authTokens.consumedAt} IS NULL`,
          sql`${authTokens.revokedAt} IS NULL`
        )
      )
      .for('update');

    if (rows.length === 0) {
      return null;
    }

    const tokenRecord = rows[0];

    // Mark as consumed
    await tx
      .update(authTokens)
      .set({ consumedAt: now })
      .where(eq(authTokens.id, tokenRecord.id));

    return { userId: tokenRecord.userId };
  });
}

