import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client.js';
import { contracts, contractFiles, users } from '../../server/db/schema.js';
import { approveSoftCopyDraft } from '../../server/modules/contracts/revisions.js';
import { uploadScanContract, archiveContract } from '../../server/modules/contracts/digital.js';
import type { UserActor } from '../../server/domain/types.js';

describe('Digital Processing & Signed Scan Guard (T24)', () => {
  const db = getDb();
  let adminActor: UserActor;
  let clerkActor: UserActor;

  beforeEach(async () => {
    const adminId = crypto.randomUUID();
    const clerkId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-dig-${Date.now()}@dps.media`,
        role: 'admin',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
      {
        id: clerkId,
        email: `clerk-dig-${Date.now()}@dps.media`,
        role: 'clerk',
        passwordHash: 'dummy',
        status: 'active',
        authVersion: 1,
      },
    ]);

    adminActor = {
      kind: 'user',
      userId: adminId,
      email: 'admin-dig@dps.media',
      role: 'admin',
    };

    clerkActor = {
      kind: 'user',
      userId: clerkId,
      email: 'clerk-dig@dps.media',
      role: 'clerk',
    };
  });

  it('bypasses physical steps for digital contracts and enforces signed scan before archive', async () => {
    const contractId = crypto.randomUUID();
    const contractNumber = `HD-DIG-${Date.now()}`;

    await db.insert(contracts).values({
      id: contractId,
      contractNumber,
      name: 'Hợp đồng dịch vụ tư vấn trực tuyến',
      partnerName: 'Công ty Công nghệ Số Z',
      valueText: '45.000.000 đ',
      status: 'Chờ duyệt bản mềm',
      version: 1,
      processingMethod: 'digital',
    });

    // 1. Approve soft copy -> advances directly to 'Chờ bản gửi lại' (skips printing and shipping)
    const approveRes = await approveSoftCopyDraft({
      contractId,
      actor: adminActor,
    });
    expect(approveRes.transitionResult.currentStatus).toBe('Chờ bản gửi lại');

    let [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Chờ bản gửi lại');

    // 2. Attempt archive before attaching scan -> must fail with MISSING_SIGNED_SCAN
    await expect(
      archiveContract({
        contractId,
        actor: clerkActor,
      })
    ).rejects.toThrowError(/Hợp đồng số hóa bắt buộc phải có file scan/i);

    // 3. Upload signed scan file
    const uploadRes = await uploadScanContract({
      contractId,
      file: {
        name: 'scan_ky_dien_tu.pdf',
        storageKey: `scan_${Date.now()}.pdf`,
        detectedMime: 'application/pdf',
        size: 512000,
        sha256: 'a'.repeat(64),
      },
      actor: clerkActor,
    });
    expect(uploadRes.transitionResult.currentStatus).toBe('Chờ bản gửi lại'); // state preserved

    const files = await db
      .select()
      .from(contractFiles)
      .where(eq(contractFiles.contractId, contractId));
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe('scan');

    // 4. Archive again -> succeeds, transitions to 'Hoàn tất'
    const archiveRes = await archiveContract({
      contractId,
      actor: clerkActor,
    });
    expect(archiveRes.currentStatus).toBe('Hoàn tất');

    [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract.status).toBe('Hoàn tất');
    expect(contract.archivedAt).toBeDefined();
  });
});

