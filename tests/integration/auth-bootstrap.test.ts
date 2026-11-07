import { describe, expect, it, beforeAll } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/modules/auth/passwords';
import { checkAndIncrementRateLimit, resetRateLimit } from '../../server/modules/auth/rate-limit';
import { bootstrapAdminUser, countActiveAdmins } from '../../server/modules/auth/repository';

describe('Auth Security, Password Hashing & Rate Limits (T15)', () => {
  it('hashes passwords using Argon2id and verifies correctly', async () => {
    const plain = 'StrongPassword123!@#';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const valid = await verifyPassword(plain, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('WrongPassword123!', hash);
    expect(invalid).toBe(false);
  });

  it('rejects passwords shorter than 12 characters or longer than 128', async () => {
    await expect(hashPassword('short123')).rejects.toThrow(/12/);
    await expect(hashPassword('a'.repeat(129))).rejects.toThrow(/128/);
  });

  it('enforces shared PostgreSQL rate limits of 5 failed attempts per 15 minutes', async () => {
    const key = `login_fail_ip_${Date.now()}`;
    await resetRateLimit(key);

    for (let i = 1; i <= 5; i++) {
      const res = await checkAndIncrementRateLimit(key, 5, 15 * 60);
      expect(res.allowed).toBe(true);
    }

    // 6th attempt must be locked
    const blocked = await checkAndIncrementRateLimit(key, 5, 15 * 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('bootstrap admin allows creation only when no active admin exists', async () => {
    const initialAdmins = await countActiveAdmins();
    if (initialAdmins === 0) {
      const res = await bootstrapAdminUser({
        email: 'superadmin@dps.media',
        name: 'Super Admin',
        password: 'AdminPassword123456!',
      });
      expect(res.id).toBeDefined();

      // Second attempt must fail because admin already exists
      await expect(
        bootstrapAdminUser({
          email: 'anotheradmin@dps.media',
          name: 'Another Admin',
          password: 'AdminPassword123456!',
        })
      ).rejects.toThrow(/đã có tài khoản Quản trị viên/i);
    } else {
      expect(initialAdmins).toBeGreaterThan(0);
    }
  });
});

