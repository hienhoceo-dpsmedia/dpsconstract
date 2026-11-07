import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { loadConfig } from '../../server/config';

describe('App Factory and HTTP Bootstrap', () => {
  it('creates an app without listening or side-effects', () => {
    const app = createApp({ isTest: true });
    expect(app).toBeDefined();
  });

  it('responds with 200 on /health/live', async () => {
    const app = createApp({ isTest: true });
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 404 with typed error envelope on unknown /api route', async () => {
    const app = createApp({ isTest: true });
    const res = await request(app).get('/api/unknown-route-12345');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('sets no-store headers on /api routes', async () => {
    const app = createApp({ isTest: true });
    const res = await request(app).get('/api/unknown-route');
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('rejects payload larger than 1MB with 413', async () => {
    const app = createApp({ isTest: true });
    const bigString = 'x'.repeat(1.2 * 1024 * 1024);
    const res = await request(app)
      .post('/api/test-body')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: bigString }));
    expect(res.status).toBe(413);
  });

  it('rejects production config when DATABASE_URL or secure SESSION_SECRET is missing', () => {
    expect(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: undefined,
      });
    }).toThrow(/DATABASE_URL is required in production/);

    expect(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SESSION_SECRET: 'short',
      });
    }).toThrow(/SESSION_SECRET must be set to a secure string/);
  });
});
