import { describe, it, expect } from 'vitest';
import {
  generateSignedQrPayload,
  encodeQrString,
  verifyAndDecodeQrString,
} from '../../server/modules/security/qr.js';

describe('Secure HMAC QR Signatures (T37)', () => {
  it('generates and verifies valid signed QR payload', () => {
    const contractId = 'c_test_qr_123';
    const version = 1;
    const qrString = encodeQrString(contractId, version);

    expect(qrString).toContain('DPSQR:');
    const result = verifyAndDecodeQrString(qrString);

    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.contractId).toBe(contractId);
    expect(result.data?.version).toBe(version);
  });

  it('rejects tampered QR string where contract ID was modified', () => {
    const contractId = 'c_legit_id';
    const version = 1;
    const qrString = encodeQrString(contractId, version);

    // Tamper the contractId in the encoded string
    const tamperedQrString = qrString.replace('c_legit_id', 'c_hacked_id');
    const result = verifyAndDecodeQrString(tamperedQrString);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('không khớp');
  });

  it('rejects tampered QR string where version was modified', () => {
    const contractId = 'c_legit_id';
    const version = 1;
    const qrString = encodeQrString(contractId, version);

    // Tamper version: change :1: to :2:
    const tamperedQrString = qrString.replace(':1:', ':2:');
    const result = verifyAndDecodeQrString(tamperedQrString);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('không khớp');
  });

  it('verifies signed JSON format QR payload correctly', () => {
    const contractId = 'c_json_test';
    const payload = generateSignedQrPayload(contractId, 2);
    const jsonString = JSON.stringify(payload);

    const result = verifyAndDecodeQrString(jsonString);
    expect(result.valid).toBe(true);
    expect(result.data?.contractId).toBe(contractId);
  });

  it('handles fallback for plain alphanumeric contract ID', () => {
    const plainId = 'HD-2026-TEST';
    const result = verifyAndDecodeQrString(plainId);
    expect(result.valid).toBe(true);
    expect(result.data?.contractId).toBe(plainId);
  });
});

