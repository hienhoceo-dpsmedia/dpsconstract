import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, shipments, users } from '../../server/db/schema.js';
import {
  confirmPrintContract,
  confirmSignContract,
  assignWaybillContract,
  confirmPickupContract,
  confirmDeliveryContract,
} from '../../server/modules/contracts/physical.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Physical Contract Milestones & Shipping Workflow (T23)', () => {
  const db = getDb();
  let clerkActor: UserActor;

  beforeEach(async () => {
    const clerkId = crypto.randomUUID();
    const email = `clerk-phys-${Date.now()}@dps.media`;

    await db.insert(users).values({
      id: clerkId,
      email,
      role: 'clerk',
      passwordHash: 'dummy',
      status: 'active',
      authVersion: 1,
    });

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email,
      role: 'clerk',
    };
  });

  it('progresses physically from Chờ in -> Đang chờ ký -> Chờ tạo vận đơn -> Chờ shipper -> Đang giao -> Chờ bản gửi lại', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-PHYS-${Date.now()}`;

    // Setup physical contract at 'Chờ in'
    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng mua sắm thiết bị viễn thông',
      partnerName: 'Tập đoàn Viettel',
      valueText: '500.000.000 đ',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    // 1. Confirm Printed -> 'Đang chờ ký'
    const printRes = await confirmPrintContract({
      contractId,
      actor: clerkActor,
    });
    expect(printRes.currentStatus).toBe('Đang chờ ký');

    let [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Đang chờ ký');
    expect(contract.printedAt).toBeDefined();

    // 2. Confirm Signed -> 'Chờ tạo vận đơn'
    const signRes = await confirmSignContract({
      contractId,
      actor: clerkActor,
    });
    expect(signRes.currentStatus).toBe('Chờ tạo vận đơn');

    [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Chờ tạo vận đơn');
    expect(contract.signedAt).toBeDefined();

    // 3. Assign Waybill -> 'Chờ shipper đến lấy'
    const waybillRes = await assignWaybillContract({
      contractId,
      waybillCode: 'VTP987654321VN',
      actor: clerkActor,
    });
    expect(waybillRes.transitionResult.currentStatus).toBe('Chờ shipper đến lấy');
    expect(waybillRes.waybillCode).toBe('VTP987654321VN');

    [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Chờ shipper đến lấy');
    expect(contract.waybillCreatedAt).toBeDefined();
    expect(contract.currentShipmentId).toBe(waybillRes.shipmentId);

    const [shipmentRow] = await db.select().from(shipments).where(eq(shipments.id, waybillRes.shipmentId));
    expect(shipmentRow.waybillCode).toBe('VTP987654321VN');
    expect(shipmentRow.status).toBe('created');

    // 4. Confirm Pickup -> 'Đang giao'
    const pickupRes = await confirmPickupContract({
      contractId,
      actor: clerkActor,
    });
    expect(pickupRes.transitionResult.currentStatus).toBe('Đang giao');

    [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Đang giao');
    expect(contract.pickedUpAt).toBeDefined();

    // 5. Confirm Delivery -> 'Chờ bản gửi lại'
    const deliveryRes = await confirmDeliveryContract({
      contractId,
      actor: clerkActor,
    });
    expect(deliveryRes.transitionResult.currentStatus).toBe('Chờ bản gửi lại');

    [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Chờ bản gửi lại');
    expect(contract.deliveredAt).toBeDefined();
    expect(contract.receivedBackAt).toBeDefined();
  });
});

