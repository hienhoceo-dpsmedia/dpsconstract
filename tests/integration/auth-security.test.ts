import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';

describe('RBAC & Route Security (T18)', () => {
  const app = createApp({ isTest: true });

  it('rejects anonymous request to /api/contracts with 401', async () => {
    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(401);
  });

  it('ignores forged x-user-role header and still requires real session', async () => {
    const res = await request(app)
      .get('/api/contracts')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(401);
  });
});

