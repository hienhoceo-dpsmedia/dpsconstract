import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, TestSchemaContext } from '../support/database.js';
import { handleQrTransition } from '../../server/modules/contracts/qr-transition.js';
import { encodeQrString } from '../../server/modules/security/qr.js';
import { getDb } from '../../server/db/client.js';
import { contracts } from '../../server/db/schema.js';

describe('QR Sequential Workflow Transition (T38)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('progresses contract sequentially from "Chờ in" through QR scans', async () => {
    const db = getDb();
    const contractId = `c_qr_${Date.now()}`;

    // 1. Insert contract at "Chờ in"
    await db.insert(contracts).values({
      id: contractId,
      contractNumber: `HD-QR-${Date.now().toString().slice(-6)}`,
      name: 'Hợp Đồng Quét QR Tự Động',
      partnerName: 'Công Ty TNHH Thử Nghiệm QR',
      valueText: '50.000.000 VNĐ',
      status: 'Chờ in',
      processingMethod: 'physical',
      version: 1,
    });

    // 2. Generate signed QR string
    const qrString = encodeQrString(contractId, 1);

    // 3. Scan 1: Transition "Chờ in" -> "Đang chờ ký" (print)
    const result1 = await handleQrTransition({
      qrString,
      actorId: 'clerk_scan@test.com',
      notes: 'Bưu tá quét in tại bàn',
    });

    expect(result1.success).toBe(true);
    expect(result1.previousStatus).toBe('Chờ in');
    expect(result1.newStatus).toBe('Đang chờ ký');
    expect(result1.actionTaken).toBe('print');

    // 4. Scan 2: Transition "Đang chờ ký" -> "Chờ tạo vận đơn" (sign)
    const qrString2 = encodeQrString(contractId, 2);
    const result2 = await handleQrTransition({
      qrString: qrString2,
      actorId: 'clerk_scan@test.com',
    });

    expect(result2.success).toBe(true);
    expect(result2.previousStatus).toBe('Đang chờ ký');
    expect(result2.newStatus).toBe('Chờ tạo vận đơn');
    expect(result2.actionTaken).toBe('sign');
  });

  it('rejects forged QR transition with invalid HMAC', async () => {
    // 64-char hex fake signature
    const fakeSignature = 'a'.repeat(64);
    const fakeQr = `DPSQR:c_test_fake:1:1793990000000:${fakeSignature}`;
    await expect(
      handleQrTransition({
        qrString: fakeQr,
        actorId: 'clerk@test.com',
      })
    ).rejects.toThrow(/không khớp|không hợp lệ/);
  });
});
