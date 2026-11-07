import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { getDb } from '../../server/db/client';
import { users } from '../../server/db/schema';
import { hashPassword } from '../../server/modules/auth/passwords';
import { countActiveAdmins } from '../../server/modules/auth/repository';

describe('User Management, Invite Tokens & Last Admin Guard (T17)', () => {
  let app: ReturnType<typeof createApp>;
  let adminCookie: string;
  let adminCsrfToken: string;

  beforeAll(async () => {
    app = createApp({ isTest: true });
    const db = getDb();

    // Seed admin user
    const pwdHash = await hashPassword('AdminPass123456!');
    await db.insert(users).values([
      {
        id: 'u_mgmt_admin',
        email: 'mgmt.admin@dps.media',
        name: 'Mgmt Admin',
        role: 'admin',
        passwordHash: pwdHash,
        status: 'active',
      },
      {
        id: 'u_mgmt_legal',
        email: 'mgmt.legal@dps.media',
        name: 'Mgmt Legal',
        role: 'legal',
        passwordHash: pwdHash,
        status: 'active',
      },
    ]).onConflictDoNothing();

    // Login as admin
    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/auth/csrf');
    adminCsrfToken = csrfRes.body.csrfToken;

    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.csrfToken)
      .send({ email: 'mgmt.admin@dps.media', password: 'AdminPass123456!' });

    adminCookie = loginRes.headers['set-cookie'][0];
    adminCsrfToken = loginRes.body.csrfToken;
  });

  it('admin can invite a new clerk and receives a one-time invite token link', async () => {
    const res = await request(app)
      .post('/api/auth/invite')
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ email: 'new.clerk@dps.media', role: 'clerk' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('clerk');
    expect(res.body.inviteLink).toBeDefined();
    expect(res.body.rawToken).toBeDefined();

    // Accepting the invite activates the user
    const acceptRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({
        token: res.body.rawToken,
        password: 'ClerkNewPass123456!',
        name: 'New Clerk User',
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.user.status).toBe('active');

    // Token cannot be reused (one-time use)
    const reuseRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({
        token: res.body.rawToken,
        password: 'AnotherPass123456!',
      });
    expect(reuseRes.status).toBe(400);
  });

  it('prevents demoting or disabling the last active admin', async () => {
    // If there is only 1 admin, demoting or disabling must be blocked with 409
    const adminsCount = await countActiveAdmins();
    if (adminsCount === 1) {
      const demoteRes = await request(app)
        .patch('/api/auth/users/u_mgmt_admin/role')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrfToken)
        .send({ role: 'legal' });

      expect(demoteRes.status).toBe(409);
      expect(demoteRes.body.code).toBe('LAST_ADMIN_PROTECTED');

      const disableRes = await request(app)
        .patch('/api/auth/users/u_mgmt_admin/disable')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrfToken);

      expect(disableRes.status).toBe(409);
    }
  });
});
