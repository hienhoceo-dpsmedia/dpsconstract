import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { getDb } from '../../server/db/client';
import { users } from '../../server/db/schema';
import { hashPassword } from '../../server/modules/auth/passwords';

describe('PostgreSQL Session, CSRF & Authentication Flow (T16)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp({ isTest: true });
    const db = getDb();

    // Seed test users
    const pwdHash = await hashPassword('ValidUser123456!');
    await db.insert(users).values([
      {
        id: 'u_session_legal',
        email: 'legal.session@dps.media',
        name: 'Legal Session User',
        role: 'legal',
        passwordHash: pwdHash,
        status: 'active',
      },
      {
        id: 'u_session_disabled',
        email: 'disabled@dps.media',
        name: 'Disabled User',
        role: 'legal',
        passwordHash: pwdHash,
        status: 'disabled',
      },
    ]).onConflictDoNothing();
  });

  it('unauthenticated request to /api/auth/me returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects login with invalid password with 401 without user enumeration', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'legal.session@dps.media', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Email hoặc mật khẩu không chính xác/i);
  });

  it('rejects login for disabled user with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disabled@dps.media', password: 'ValidUser123456!' });

    expect(res.status).toBe(401);
  });

  it('full login, session verification and logout flow', async () => {
    const agent = request.agent(app);

    // 1. Get CSRF token
    const csrfRes = await agent.get('/api/auth/csrf');
    expect(csrfRes.status).toBe(200);
    expect(csrfRes.body.csrfToken).toBeDefined();

    // 2. Login
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.csrfToken)
      .send({
        email: 'legal.session@dps.media',
        password: 'ValidUser123456!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toBeDefined();
    expect(loginRes.body.user.email).toBe('legal.session@dps.media');
    expect(loginRes.body.user.role).toBe('legal');
    expect(loginRes.body.user).not.toHaveProperty('passwordHash');

    // 3. /me returns authenticated user
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('legal.session@dps.media');

    // 4. Logout
    const logoutRes = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', loginRes.body.csrfToken);
    expect(logoutRes.status).toBe(200);

    // 5. Subsequent /me returns 401
    const postLogoutMe = await agent.get('/api/auth/me');
    expect(postLogoutMe.status).toBe(401);
  });
});

