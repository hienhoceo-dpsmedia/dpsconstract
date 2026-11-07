import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { authRateLimits } from '../../db/schema.js';

export interface RateLimitResult {
  allowed: boolean;
  points: number;
  retryAfterSeconds?: number;
}

export async function checkAndIncrementRateLimit(
  key: string,
  maxPoints = 5,
  windowSeconds = 900 // 15 minutes
): Promise<RateLimitResult> {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  const [record] = await db
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.key, key));

  if (!record || record.expiresAt < now) {
    // New or expired bucket
    await db
      .insert(authRateLimits)
      .values({
        key,
        points: 1,
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          points: 1,
          expiresAt,
          lockedUntil: null,
          updatedAt: now,
        },
      });

    return { allowed: true, points: 1 };
  }

  // Active bucket
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
    return { allowed: false, points: record.points, retryAfterSeconds: retryAfter };
  }

  const nextPoints = record.points + 1;
  const shouldLock = nextPoints > maxPoints;
  const lockedUntil = shouldLock ? new Date(now.getTime() + windowSeconds * 1000) : null;

  await db
    .update(authRateLimits)
    .set({
      points: nextPoints,
      lockedUntil,
      updatedAt: now,
    })
    .where(eq(authRateLimits.key, key));

  if (shouldLock) {
    return { allowed: false, points: nextPoints, retryAfterSeconds: windowSeconds };
  }

  return { allowed: true, points: nextPoints };
}

export async function resetRateLimit(key: string): Promise<void> {
  const db = getDb();
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}

