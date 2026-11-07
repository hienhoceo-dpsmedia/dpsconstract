import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, contractAuditLogs, users } from '../../server/db/schema.js';
import {
  rejectContract,
  reportIssueContract,
  cancelContract,
} from '../../server/modules/contracts/exceptions.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Workflow Exceptions & Branching (T25)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let clerkActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const clerkId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-ex-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: clerkId,
        email: `clerk-ex-${Date.now()}@dps.media`,
        role: 'clerk',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-ex@dps.media',
      role: 'admin',
    };

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email: 'clerk-ex@dps.media',
      role: 'clerk',
    };
  });

  it('rejects signature with mandatory reason and transitions to Bị từ chối ký', async () => {
    const contractId = crypto.randomUUID();
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-REJ-${Date.now()}`,
      name: 'Hợp đồng thẩm định chữ ký',
      partnerName: 'Công ty Đối tác Ký',
      valueText: '60.000.000 đ',
      status: 'Đang chờ ký',
      version: 1,
      processingMethod: 'physical',
    });

    // Missing note throws error
    await expect(
      rejectContract({
        contractId,
        note: '',
        actor: clerkActor,
      })
    ).rejects.toThrowError(/Vui lòng cung cấp lý do từ chối/i);

    // Valid note advances to 'Bị từ chối ký'
    const res = await rejectContract({
      contractId,
      note: 'Đối tác không đồng ý điều khoản thanh toán trả chậm',
      actor: clerkActor,
    });

    expect(res.currentStatus).toBe('Bị từ chối ký');

    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Bị từ chối ký');

    const logs = await db
      .select()
      .from(contractAuditLogs)
      .where(eq(contractAuditLogs.contractId, contractId));

    expect(logs.some((l) => l.action === 'reject')).toBe(true);
  });

  it('reports courier issue with note and transitions to Sự cố vận chuyển', async () => {
    const contractId = crypto.randomUUID();
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-ISSUE-${Date.now()}`,
      name: 'Hợp đồng vận chuyển thất lạc',
      partnerName: 'Công ty Giao Nhận Nhanh',
      valueText: '30.000.000 đ',
      status: 'Đang giao',
      version: 1,
      processingMethod: 'physical',
    });

    const res = await reportIssueContract({
      contractId,
      note: 'Bưu tá báo người nhận chuyển địa chỉ, không liên lạc được qua điện thoại',
      actor: clerkActor,
    });

    expect(res.transitionResult.currentStatus).toBe('Sự cố vận chuyển');

    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Sự cố vận chuyển');
  });

  it('allows admin to cancel an active contract with explicit reason', async () => {
    const contractId = crypto.randomUUID();
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-CANCEL-${Date.now()}`,
      name: 'Hợp đồng đối tác hủy hợp tác',
      partnerName: 'Công ty Giải thể ABC',
      valueText: '10.000.000 đ',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    const res = await cancelContract({
      contractId,
      note: 'Đối tác thông báo dừng dự án do thay đổi kế hoạch kinh doanh',
      actor: adminActor,
    });

    expect(res.currentStatus).toBe('Đã hủy');

    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Đã hủy');
  });
});

