import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, contractAuditLogs, users } from '../../server/db/schema.js';
import { editContractMetadata } from '../../server/modules/contracts/edits.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Safe Metadata Edits & Audit Diff (T26)', () => {
  const db = getDb();
  let adminActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();

    await db.insert(users).values({
      id: adminId,
      email: `admin-edit-${Date.now()}@dps.media`,
      role: 'admin',
      passwordHash: 'dummy',
      status: 'active',
      authVersion: 1,
    });

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-edit@dps.media',
      role: 'admin',
    };
  });

  it('updates allowed fields, calculates valueAmount and ignores disallowed fields', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-EDIT-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Tên ban đầu',
      partnerName: 'Đối tác cũ',
      valueText: '10.000.000 đ',
      valueAmount: '10000000',
      status: 'Chờ in',
      version: 1,
      processingMethod: 'physical',
    });

    // 1. Missing note throws error
    await expect(
      editContractMetadata({
        contractId,
        fields: { name: 'Tên mới' },
        note: '',
        actor: adminActor,
      })
    ).rejects.toThrowError(/Vui lòng cung cấp lý do/i);

    // 2. Perform valid edit
    const res = await editContractMetadata({
      contractId,
      fields: {
        name: 'Tên mới đã cập nhật',
        partnerName: 'Đối tác mới chính thức',
        valueText: '25.000.000 đ',
        receiverAddress: '123 Đường Nguyễn Huệ, Q1, TP.HCM',
        // Attempt disallowed field injection
        contractNumber: 'HD-HACKED-999',
        status: 'Hoàn tất',
      } as any,
      note: 'Điều chỉnh đối tác và giá trị theo phụ lục hợp đồng mới',
      actor: adminActor,
    });

    expect(res.success).toBe(true);
    expect(res.updatedFields).toContain('name');
    expect(res.updatedFields).toContain('partnerName');
    expect(res.updatedFields).toContain('valueText');

    // Verify DB
    const [updated] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(updated.name).toBe('Tên mới đã cập nhật');
    expect(updated.partnerName).toBe('Đối tác mới chính thức');
    expect(updated.valueText).toBe('25.000.000 đ');
    expect(Number(updated.valueAmount)).toBe(25000000);
    expect(updated.receiverAddress).toBe('123 Đường Nguyễn Huệ, Q1, TP.HCM');

    // Inviolable checks: contractNumber and status must NOT be modified
    expect(updated.contractNumber).toBe(contractNumber);
    expect(updated.status).toBe('Chờ in');

    // Audit log check
    const logs = await db
      .select()
      .from(contractAuditLogs)
      .where(eq(contractAuditLogs.contractId, contractId));

    const editLog = logs.find((l) => l.action === 'edit_metadata');
    expect(editLog).toBeDefined();
    expect(editLog?.reason).toContain('Điều chỉnh đối tác');
    expect(editLog?.metadata).toBeDefined();
  });
});
