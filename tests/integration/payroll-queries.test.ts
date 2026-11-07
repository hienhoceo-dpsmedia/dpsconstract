import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { getDb } from '../../server/db/client.js';
import { contracts, workItems, payrollEntries, users } from '../../server/db/schema.js';
import { hashPassword } from '../../server/modules/auth/passwords.js';

describe('Payroll Queries & RBAC Access Control (T31)', () => {
  const app = createApp({ isTest: true });
  const db = getDb();

  let adminUser: { id: string; email: string };
  let legalUser1: { id: string; email: string };
  let legalUser2: { id: string; email: string };
  let entry1Id: string;
  let entry2Id: string;

  beforeEach(async () => {
    const pwdHash = await hashPassword('SecurePassword123!');
    const adminId = crypto.randomUUID();
    const l1Id = crypto.randomUUID();
    const l2Id = crypto.randomUUID();
    const ts = Date.now();
    const adminEmail = `admin-pq-${ts}@dps.media`;
    const l1Email = `legal1-pq-${ts}@dps.media`;
    const l2Email = `legal2-pq-${ts}@dps.media`;

    await db.insert(users).values([
      {
        id: adminId,
        email: adminEmail,
        role: 'admin',
        passwordHash: pwdHash,
        status: 'active',
        authVersion: 1,
      },
      {
        id: l1Id,
        email: l1Email,
        role: 'legal',
        passwordHash: pwdHash,
        status: 'active',
        authVersion: 1,
      },
      {
        id: l2Id,
        email: l2Email,
        role: 'legal',
        passwordHash: pwdHash,
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminUser = { id: adminId, email: adminEmail };
    legalUser1 = { id: l1Id, email: l1Email };
    legalUser2 = { id: l2Id, email: l2Email };

    const c1Id = crypto.randomUUID();
    const c2Id = crypto.randomUUID();
    const w1Id = crypto.randomUUID();
    const w2Id = crypto.randomUUID();
    entry1Id = crypto.randomUUID();
    entry2Id = crypto.randomUUID();

    await db.insert(contracts).values([
      {
        id: c1Id,
        contractNumber: `HD-PQ1-${Date.now()}`,
        name: 'Hợp đồng Legal 1',
        partnerName: 'Đối tác 1',
        valueText: '10.000.000 đ',
        status: 'Hoàn tất',
        version: 1,
        processingMethod: 'digital',
      },
      {
        id: c2Id,
        contractNumber: `HD-PQ2-${Date.now()}`,
        name: 'Hợp đồng Legal 2',
        partnerName: 'Đối tác 2',
        valueText: '20.000.000 đ',
        status: 'Hoàn tất',
        version: 1,
        processingMethod: 'digital',
      },
    ]);

    await db.insert(workItems).values([
      {
        id: w1Id,
        contractId: c1Id,
        kind: 'legal',
        assigneeId: l1Id,
        payable: true,
        policySnapshot: {},
        basePaySnapshot: 500000,
        state: 'finalized',
      },
      {
        id: w2Id,
        contractId: c2Id,
        kind: 'legal',
        assigneeId: l2Id,
        payable: true,
        policySnapshot: {},
        basePaySnapshot: 500000,
        state: 'finalized',
      },
    ]);

    await db.insert(payrollEntries).values([
      {
        id: entry1Id,
        workItemId: w1Id,
        contractId: c1Id,
        beneficiaryId: l1Id,
        finalizedBy: adminId,
        amountVnd: 500000,
        coefBreakdown: {},
        policySnapshot: {},
        inputSnapshot: { contractNumber: `HD-PQ1-${Date.now()}` },
      },
      {
        id: entry2Id,
        workItemId: w2Id,
        contractId: c2Id,
        beneficiaryId: l2Id,
        finalizedBy: adminId,
        amountVnd: 600000,
        coefBreakdown: {},
        policySnapshot: {},
        inputSnapshot: { contractNumber: `HD-PQ2-${Date.now()}` },
      },
    ]);
  });

  it('restricts legal users to view only their own payroll entries', async () => {
    const legalAgent = request.agent(app);

    // Get CSRF
    const csrfRes = await legalAgent.get('/api/auth/csrf');
    const csrfToken = csrfRes.body.csrfToken;

    // Login as legalUser1
    await legalAgent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: legalUser1.email, password: 'SecurePassword123!' });

    // 1. Legal 1 calls /api/payroll/legal -> should only see entry 1
    const res = await legalAgent.get('/api/payroll/legal');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(entry1Id);

    // 2. Legal 1 tries to access detail of Legal 2 entry -> 403 Forbidden
    const detailForbidden = await legalAgent.get(`/api/payroll/${entry2Id}`);
    expect(detailForbidden.status).toBe(403);
    expect(detailForbidden.body.code).toBe('FORBIDDEN');

    // 3. Legal 1 views own detail -> 200 OK
    const detailOwn = await legalAgent.get(`/api/payroll/${entry1Id}`);
    expect(detailOwn.status).toBe(200);
    expect(detailOwn.body.entry.id).toBe(entry1Id);
  });

  it('allows admin users to view all payroll entries across all team members', async () => {
    const adminAgent = request.agent(app);

    const csrfRes = await adminAgent.get('/api/auth/csrf');
    const csrfToken = csrfRes.body.csrfToken;

    // Login as admin
    await adminAgent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: adminUser.email, password: 'SecurePassword123!' });

    const res = await adminAgent.get('/api/payroll/legal');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});
