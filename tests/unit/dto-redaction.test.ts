import { describe, expect, it } from 'vitest';
import { toContractSummary, toContractDetail } from '../../server/modules/contracts/dto';

describe('DTO Redaction & Sanitization (T11)', () => {
  it('toContractSummary strips internal file storage keys and paths', () => {
    const rawContract = {
      id: 'c_abc',
      contractNumber: 'HD-999',
      name: 'Hop dong quang cao',
      partnerName: 'Cong ty ABC',
      valueText: '100,000,000 VND',
      valueAmount: '100000000.00',
      status: 'Chờ in' as const,
      version: 2,
      processingMethod: 'physical' as const,
      uploadedAt: new Date('2026-11-07T00:00:00Z'),
      slaBreached: false,
      slaBreachType: null,
      storageKey: '/internal/disk/path/secret.pdf',
    };

    const summary = toContractSummary(rawContract, { role: 'clerk', userId: 'u_clerk' });
    expect(summary.id).toBe('c_abc');
    expect(summary).not.toHaveProperty('storageKey');
    expect(summary).not.toHaveProperty('filePath');
    expect(summary.allowedActions).toContain('print');
  });

  it('toContractDetail returns safe file DTOs without server filesystem paths', () => {
    const rawFiles = [
      {
        id: 'f_1',
        name: 'hopdong.pdf',
        type: 'original' as const,
        uploadedBy: 'u1',
        uploadedAt: new Date(),
        size: 1024,
        mimeType: 'application/pdf',
        storageKey: 'uploads/2026/f_1.pdf',
      },
    ];

    const detail = toContractDetail(
      {
        id: 'c_abc',
        contractNumber: 'HD-999',
        name: 'Hop dong',
        partnerName: 'Partner',
        valueText: '1000',
        status: 'Chờ in',
        version: 1,
        processingMethod: 'physical',
        uploadedAt: new Date(),
        slaBreached: false,
        slaBreachType: null,
      },
      rawFiles,
      { role: 'admin', userId: 'u_admin' }
    );

    expect(detail.files).toHaveLength(1);
    expect(detail.files[0]).not.toHaveProperty('storageKey');
    expect(detail.files[0]).not.toHaveProperty('filePath');
    expect(detail.files[0].name).toBe('hopdong.pdf');
  });
});

