import { eq, and, count, sql, not } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { users, systemAuditLogs } from '../../db/schema.js';
import { hashPassword } from './passwords.js';
import { normalizeEmail } from '../../domain/identifiers.js';
import type { Role } from '../../../src/shared/contracts.js';

export async function findUserByEmail(email: string) {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const rows = await db.select().from(users).where(eq(users.email, normalized));
  return rows[0] || null;
}

export async function findUserById(id: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] || null;
}

export async function listAllUsers() {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(users.createdAt);
  return rows;
}

export async function countActiveAdmins(): Promise<number> {
  const db = getDb();
  const [res] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  return Number(res?.total || 0);
}

export async function bootstrapAdminUser(params: {
  email: string;
  name?: string;
  password: string;
}) {
  const db = getDb();

  return await db.transaction(async (tx) => {
    // Acquire advisory transaction lock
    await tx.execute(sql`SELECT pg_advisory_xact_lock(88991122)`);

    const [adminCount] = await tx
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));

    if (Number(adminCount?.total || 0) > 0) {
      throw new Error('Hệ thống đã có tài khoản Quản trị viên (Admin). Vui lòng đăng nhập.');
    }

    const passwordHash = await hashPassword(params.password);
    const userId = crypto.randomUUID();
    const normalizedEmail = normalizeEmail(params.email);

    const [inserted] = await tx
      .insert(users)
      .values({
        id: userId,
        email: normalizedEmail,
        name: params.name || 'Quản Trị Viên',
        role: 'admin',
        passwordHash,
        status: 'active',
        authVersion: 1,
      })
      .returning();

    return inserted;
  });
}

export async function inviteUserRecord(params: {
  email: string;
  role: Role;
  actorId?: string;
}) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(params.email);

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    if (existing.status === 'disabled') {
      throw new Error(`Tài khoản "${normalizedEmail}" đã bị vô hiệu hoá và không thể mời lại.`);
    }
    // Return existing user
    return existing;
  }

  const userId = crypto.randomUUID();
  const [inserted] = await db
    .insert(users)
    .values({
      id: userId,
      email: normalizedEmail,
      role: params.role,
      status: 'invited',
      authVersion: 1,
    })
    .returning();

  return inserted;
}

export async function acceptUserInvite(params: {
  userId: string;
  passwordHash: string;
  name?: string;
}) {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      passwordHash: params.passwordHash,
      name: params.name || undefined,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId))
    .returning();
  return updated;
}

export async function updateUserRole(userId: string, newRole: Role, actorId: string) {
  const db = getDb();

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(88991122)`);

    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user) throw new Error('Không tìm thấy người dùng.');

    // If demoting an admin, ensure at least one other active admin remains
    if (user.role === 'admin' && newRole !== 'admin') {
      const [otherAdmins] = await tx
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), not(eq(users.id, userId))));

      if (Number(otherAdmins?.total || 0) === 0) {
        const err = new Error('Không thể giáng chức Quản trị viên (Admin) duy nhất còn lại.');
        (err as unknown as { code: string }).code = 'LAST_ADMIN_PROTECTED';
        throw err;
      }
    }

    const nextAuthVersion = user.authVersion + 1;
    const [updated] = await tx
      .update(users)
      .set({
        role: newRole,
        authVersion: nextAuthVersion,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await tx.insert(systemAuditLogs).values({
      id: crypto.randomUUID(),
      target: `user:${userId}`,
      action: 'update_role',
      actorId,
      diff: { oldRole: user.role, newRole },
    });

    return updated;
  });
}

export async function disableUser(userId: string, actorId: string) {
  const db = getDb();

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(88991122)`);

    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user) throw new Error('Không tìm thấy người dùng.');

    if (user.role === 'admin') {
      const [otherAdmins] = await tx
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), not(eq(users.id, userId))));

      if (Number(otherAdmins?.total || 0) === 0) {
        const err = new Error('Không thể vô hiệu hoá Quản trị viên (Admin) duy nhất còn lại.');
        (err as unknown as { code: string }).code = 'LAST_ADMIN_PROTECTED';
        throw err;
      }
    }

    const nextAuthVersion = user.authVersion + 1;
    const [updated] = await tx
      .update(users)
      .set({
        status: 'disabled',
        authVersion: nextAuthVersion,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await tx.insert(systemAuditLogs).values({
      id: crypto.randomUUID(),
      target: `user:${userId}`,
      action: 'disable_user',
      actorId,
      diff: { oldStatus: user.status, newStatus: 'disabled' },
    });

    return updated;
  });
}
