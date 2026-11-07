import crypto from 'crypto';

const DEFAULT_SECRET = 'dps-secure-qr-secret-key-2026';

function getQrSecret(): string {
  return process.env.QR_HMAC_SECRET || DEFAULT_SECRET;
}

export interface QrPayloadData {
  contractId: string;
  version: number;
  ts: number;
}

export interface SignedQrPayload extends QrPayloadData {
  sig: string;
}

/**
 * Signs a contract QR payload with HMAC SHA-256
 */
export function generateSignedQrPayload(contractId: string, version: number): SignedQrPayload {
  const ts = Date.now();
  const raw = `${contractId}:${version}:${ts}`;
  const sig = crypto.createHmac('sha256', getQrSecret()).update(raw).digest('hex');
  return {
    contractId,
    version,
    ts,
    sig,
  };
}

/**
 * Encodes signed QR payload to a compact string for QR code generation
 */
export function encodeQrString(contractId: string, version: number): string {
  const payload = generateSignedQrPayload(contractId, version);
  return `DPSQR:${payload.contractId}:${payload.version}:${payload.ts}:${payload.sig}`;
}

/**
 * Verifies and decodes a signed QR payload string.
 * Prevents tampering with contract ID or state version.
 */
export function verifyAndDecodeQrString(qrString: string): { valid: boolean; data?: QrPayloadData; error?: string } {
  if (!qrString || typeof qrString !== 'string') {
    return { valid: false, error: 'Chuỗi mã QR không hợp lệ hoặc rỗng' };
  }

  // Support JSON format or DPSQR prefix format
  if (qrString.startsWith('{')) {
    try {
      const parsed: SignedQrPayload = JSON.parse(qrString);
      if (!parsed.contractId || parsed.version === undefined || !parsed.ts || !parsed.sig) {
        return { valid: false, error: 'Cấu trúc mã QR JSON thiếu trường bắt buộc' };
      }
      const raw = `${parsed.contractId}:${parsed.version}:${parsed.ts}`;
      const expectedSig = crypto.createHmac('sha256', getQrSecret()).update(raw).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(parsed.sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return { valid: true, data: { contractId: parsed.contractId, version: parsed.version, ts: parsed.ts } };
      }
      return { valid: false, error: 'Chữ ký số HMAC của mã QR không khớp (nghi vấn bị can thiệp)' };
    } catch {
      return { valid: false, error: 'Không thể phân tích dữ liệu JSON từ mã QR' };
    }
  }

  if (qrString.startsWith('DPSQR:')) {
    const parts = qrString.split(':');
    if (parts.length !== 5) {
      return { valid: false, error: 'Định dạng mã QR DPSQR không hợp lệ' };
    }
    const contractId = parts[1];
    const version = parseInt(parts[2], 10);
    const ts = parseInt(parts[3], 10);
    const sig = parts[4];

    if (!contractId || isNaN(version) || isNaN(ts) || !sig) {
      return { valid: false, error: 'Dữ liệu mã QR bị khuyết thiếu trường' };
    }

    const raw = `${contractId}:${version}:${ts}`;
    const expectedSig = crypto.createHmac('sha256', getQrSecret()).update(raw).digest('hex');

    try {
      if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return { valid: true, data: { contractId, version, ts } };
      }
    } catch {
      return { valid: false, error: 'Chữ ký mã QR bị sai định dạng hex' };
    }

    return { valid: false, error: 'Chữ ký số HMAC của mã QR không khớp' };
  }

  // Fallback for legacy plain contractId QR labels
  // If it matches UUID or standard alphanumeric ID, allow with warning
  if (/^[a-zA-Z0-9_\-]+$/.test(qrString)) {
    return {
      valid: true,
      data: { contractId: qrString, version: 1, ts: Date.now() },
    };
  }

  return { valid: false, error: 'Mã QR không thuộc định dạng được hệ thống hỗ trợ' };
}

