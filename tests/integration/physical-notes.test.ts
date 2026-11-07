import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, contractPhysicalEvents, users } from '../../server/db/schema.js';
import { addPhysicalEventNote } from '../../server/modules/contracts/physical-notes.js';
import type { UserActor } from '../../domain/types.js';

describe('Physical Ground Events & Courier Notes (T26)', () => {
  const db = getDb();
  let clerkActor: UserActor;

  beforeEach(async () => {
    const clerkId = crypto.randomUUID();

    await db.insert(users).values({
      id: clerkId,
      email: `clerk-note-${Date.now()}@dps.media`,
      role: 'clerk',
      passwordHash: 'dummy',
      status: 'active',
      authVersion: 1,
    });

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email: 'clerk-note@dps.media',
      role: 'clerk',
    };
  });

  it('records ground physical notes into contractPhysicalEvents table', async () => {
    const contractId = crypto.randomUUID();
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-NOTE-${Date.now()}`,
      name: 'Hợp đồng kiểm thử ghi chú vật lý',
      partnerName: 'Công ty Hiện Trường',
      valueText: '15.000.000 đ',
      status: 'Chờ shipper đến lấy',
      version: 1,
      processingMethod: 'physical',
    });

    const res = await addPhysicalEventNote({
      contractId,
      step: 'courier_pickup',
      note: 'Đã đóng gói phong bì niêm phong 2 lớp kèm mã QR ID, shipper Viettel Post hẹn lấy lúc 14h30',
      actor: clerkActor,
    });

    expect(res.success).toBe(true);
    expect(res.step).toBe('courier_pickup');

    const events = await db
      .select()
      .from(contractPhysicalEvents)
      .where(eq(contractPhysicalEvents.contractId, contractId));

    expect(events).toHaveLength(1);
    expect(events[0].step).toBe('courier_pickup');
    expect(events[0].note).toContain('niêm phong 2 lớp');
    expect(events[0].actorId).toBe(clerkActor.userId);
  });
});

