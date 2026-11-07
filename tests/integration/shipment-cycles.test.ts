import { describe, it, expect, beforeEach } from 'vitest';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, contractCycles, shipments, users } from '../../server/db/schema.js';
import { redraftContract, reshipContract } from '../../server/modules/contracts/exceptions.js';
import { assignWaybillContract } from '../../server/modules/contracts/physical.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Shipment Cycles & Redraft Lineage Preservation (T25)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let clerkActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const clerkId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-cyc-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: clerkId,
        email: `clerk-cyc-${Date.now()}@dps.media`,
        role: 'clerk',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-cyc@dps.media',
      role: 'admin',
    };

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email: 'clerk-cyc@dps.media',
      role: 'clerk',
    };
  });

  it('preserves cycle 1 history and spawns cycle 2 upon redraft', async () => {
    const contractId = crypto.randomUUID();
    const cycle1Id = crypto.randomUUID();

    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-REDRAFT-${Date.now()}`,
      name: 'Hợp đồng cần soạn lại sau khi bị từ chối ký',
      partnerName: 'Công ty Đối tác Khó Tính',
      valueText: '120.000.000 đ',
      status: 'Bị từ chối ký',
      version: 3,
      currentCycleId: cycle1Id,
      processingMethod: 'physical',
    });

    await db.insert(contractCycles).values({
      id: cycle1Id,
      contractId,
      cycleNumber: 1,
      type: 'initial',
      startedAt: new Date(Date.now() - 3600000),
    });

    // Execute redraft
    const redraftRes = await redraftContract({
      contractId,
      note: 'Đối tác yêu cầu điều chỉnh lại điều khoản bảo hành từ 12 tháng lên 24 tháng',
      actor: adminActor,
    });

    expect(redraftRes.cycleNumber).toBe(2);
    expect(redraftRes.transitionResult.currentStatus).toBe('Chờ duyệt bản mềm');

    // Verify all cycles in DB
    const allCycles = await db
      .select()
      .from(contractCycles)
      .where(eq(contractCycles.contractId, contractId))
      .orderBy(asc(contractCycles.cycleNumber));

    expect(allCycles).toHaveLength(2);
    expect(allCycles[0].cycleNumber).toBe(1);
    expect(allCycles[0].type).toBe('initial');
    expect(allCycles[1].cycleNumber).toBe(2);
    expect(allCycles[1].type).toBe('redraft');

    // Contract points to new cycle
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.currentCycleId).toBe(allCycles[1].id);
    expect(contract.status).toBe('Chờ duyệt bản mềm');
  });

  it('supersedes failed shipment and allows reship attempt 2', async () => {
    const contractId = crypto.randomUUID();
    const shipment1Id = crypto.randomUUID();

    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-RESHIP-${Date.now()}`,
      name: 'Hợp đồng bị thất lạc bưu phẩm cần gửi lại',
      partnerName: 'Công ty Giao Nhận Lại',
      valueText: '70.000.000 đ',
      status: 'Sự cố vận chuyển',
      version: 4,
      currentShipmentId: shipment1Id,
      processingMethod: 'physical',
    });

    await db.insert(shipments).values({
      id: shipment1Id,
      contractId,
      attemptNumber: 1,
      provider: 'viettelpost',
      waybillCode: 'VTP-OLD-001',
      status: 'issue',
      manualCreated: true,
    });

    // 1. Trigger reship
    const reshipRes = await reshipContract({
      contractId,
      note: 'In lại bộ hồ sơ mới và gửi lại bưu cục lần 2',
      actor: clerkActor,
    });

    expect(reshipRes.transitionResult.currentStatus).toBe('Chờ tạo vận đơn');

    // Old shipment marked superseded
    const [oldShipment] = await db.select().from(shipments).where(eq(shipments.id, shipment1Id));
    expect(oldShipment.status).toBe('failed');
    expect(oldShipment.supersededAt).toBeDefined();

    // 2. Assign new waybill for attempt 2
    const waybillRes = await assignWaybillContract({
      contractId,
      waybillCode: 'VTP-NEW-002',
      actor: clerkActor,
    });

    expect(waybillRes.transitionResult.currentStatus).toBe('Chờ shipper đến lấy');
    expect(waybillRes.waybillCode).toBe('VTP-NEW-002');

    // Both shipments exist in DB
    const allShipments = await db
      .select()
      .from(shipments)
      .where(eq(shipments.contractId, contractId));

    expect(allShipments).toHaveLength(2);
  });
});

