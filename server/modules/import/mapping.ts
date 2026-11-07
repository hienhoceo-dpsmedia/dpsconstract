import crypto from 'node:crypto';
import { parseContractValue } from '../../domain/money.js';
import { normalizeContractNumber, normalizeEmail } from '../../domain/identifiers.js';

export function generateStableId(parentId: string, collection: string, index: number): string {
  const input = `${parentId}:${collection}:${index}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

export function mapLegacyContract(raw: Record<string, unknown>) {
  const money = parseContractValue(String(raw.value || '0 VND'));
  const contractNumber = normalizeContractNumber(String(raw.contractNumber || ''));

  return {
    id: String(raw.id),
    contractNumber,
    name: String(raw.name || 'Hợp đồng không tên'),
    partnerName: String(raw.partnerName || 'Chưa rõ đối tác'),
    valueText: money.valueText,
    valueAmount: money.valueAmount ? String(money.valueAmount) : null,
    currency: money.currency,
    valueKind: money.valueKind,
    status: String(raw.status || 'Chờ duyệt bản mềm'),
    version: Number(raw.version || 1),
    processingMethod: String(raw.processingMethod || 'physical'),
    uploadedAt: raw.uploaded_at ? new Date(raw.uploaded_at as string).toISOString() : new Date().toISOString(),
    slaBreached: Boolean(raw.slaBreached),
    waybillCode: raw.waybillCode ? String(raw.waybillCode) : '',
    requiresReview: true, // Legacy imported contracts flagged for review
  };
}

