import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../server/db/client.js';
import { contracts, users } from '../../server/db/schema.js';
import {
  recordClerkIncident,
  confirmClerkIncident,
  listClerkIncidents,
} from '../../server/modules/payroll/incidents.js';
import { calculateClerkPayroll } from '../../src/utils/payroll.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Clerk Incident Penalties & Audits (T28)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let clerkActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const clerkId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-inc-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: clerkId,
        email: `clerk-inc-${Date.now()}@dps.media`,
        role: 'clerk',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-inc@dps.media',
      role: 'admin',
    };

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email: 'clerk-inc@dps.media',
      role: 'clerk',
    };
  });

  it('records clerk incidents, confirms them and penalizes physical payroll accordingly', async () => {
    const contractId = crypto.randomUUID();
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-INC-${Date.now()}`,
      name: 'Hợp đồng phát sinh sự cố in',
      partnerName: 'Công ty Sự Cố',
      valueText: '20.000.000 đ',
      status: 'Chờ in',
      version: 1,
      clerkAssigneeId: clerkActor.userId,
      processingMethod: 'physical',
    });

    // 1. Record an incident
    const incident = await recordClerkIncident({
      contractId,
      responsibleId: clerkActor.userId,
      description: 'In nhầm trang bìa thiếu dấu giáp lai công ty',
      actor: adminActor,
    });

    expect(incident.id).toBeDefined();
    expect(incident.confirmedAt).toBeNull();

    // 2. Confirm incident
    const confirmed = await confirmClerkIncident({
      incidentId: incident.id,
      actor: adminActor,
    });
    expect(confirmed.confirmedAt).toBeDefined();
    expect(confirmed.confirmedBy).toBe(adminActor.userId);

    // 3. List incidents
    const list = await listClerkIncidents({ contractId });
    expect(list).toHaveLength(1);
    expect(list[0].description).toContain('thiếu dấu giáp lai');

    // 4. Verify calculation reflects incident penalty
    const payrollRes = calculateClerkPayroll({
      clerk_base_pay: 100000,
      feedback_count: 1, // 1 incident registered
    });

    expect(payrollRes.accuracyCoef).toBeLessThan(0); // negative adjustment (-10%)
    expect(payrollRes.finalPayroll).toBeLessThan(100000); // 90.000 đ
  });
});

