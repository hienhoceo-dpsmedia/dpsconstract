import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { getDb } from '../../server/db/client';
import { contracts, users } from '../../server/db/schema';
import { hashPassword } from '../../server/modules/auth/passwords';

describe('Contracts Query API (T11)', () => {
  const app = createApp({ isTest: true });
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const db = getDb();

    // Ensure a test user exists and login
    const pwd = await hashPassword('TestPass123456!');
    await db.insert(users).values({
      id: 'u_query_user',
      email: 'query.user@dps.media',
      name: 'Query User',
      role: 'clerk',
      passwordHash: pwd,
      status: 'active',
    }).onConflictDoNothing();

    agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'query.user@dps.media', password: 'TestPass123456!' });

    // Seed a couple of test contracts
    await db.insert(contracts).values([
      {
        id: 'c_query_1',
        contractNumber: 'HD-QUERY-01',
        name: 'Hợp Đồng A',
        partnerName: 'Đối Tác A',
        valueText: '100,000,000 VND',
        status: 'Chờ in',
        processingMethod: 'physical',
      },
      {
        id: 'c_query_2',
        contractNumber: 'HD-QUERY-02',
        name: 'Hợp Đồng B',
        partnerName: 'Đối Tác B',
        valueText: '200,000,000 VND',
        status: 'Đang giao',
        processingMethod: 'physical',
      },
    ]).onConflictDoNothing();
  });

  it('GET /api/contracts returns ContractPage with pagination envelope and 12 status counts', async () => {
    const res = await agent.get('/api/contracts?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pageSize', 10);
    expect(res.body).toHaveProperty('statusCounts');
    expect(Object.keys(res.body.statusCounts)).toHaveLength(12);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/contracts/:id returns detailed contract with files', async () => {
    const res = await agent.get('/api/contracts/c_query_1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c_query_1');
    expect(res.body.contractNumber).toBe('HD-QUERY-01');
    expect(res.body.files).toBeDefined();
    expect(Array.isArray(res.body.files)).toBe(true);
  });

  it('GET /api/contracts/:id returns 404 for non-existent ID', async () => {
    const res = await agent.get('/api/contracts/non_existent_id_999');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTRACT_NOT_FOUND');
  });
});

