import { describe, it, expect } from 'vitest';
import { validateUploadedFile } from '../../server/modules/files/validation.js';

describe('File Security & Antivirus Validation (T35)', () => {
  it('accepts valid PDF file with %PDF magic bytes', () => {
    const pdfBuffer = Buffer.from('%PDF-1.5 test document content');
    const result = validateUploadedFile(pdfBuffer, 'contract.pdf');
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
  });

  it('accepts valid PNG image with PNG magic bytes', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
    const result = validateUploadedFile(pngBuffer, 'scan_page_1.png');
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/png');
  });

  it('accepts valid JPEG image with JPEG magic bytes', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
    const result = validateUploadedFile(jpegBuffer, 'signature.jpg');
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('accepts valid DOCX file with PK magic bytes', () => {
    const docxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const result = validateUploadedFile(docxBuffer, 'Hop_Dong_2026.docx');
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('rejects dangerous file extensions (exe, sh, bat, js)', () => {
    const fakeBuffer = Buffer.from('console.log("hello");');
    const res1 = validateUploadedFile(fakeBuffer, 'malicious.exe');
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('bị cấm');

    const res2 = validateUploadedFile(fakeBuffer, 'script.sh');
    expect(res2.valid).toBe(false);

    const res3 = validateUploadedFile(fakeBuffer, 'payload.js');
    expect(res3.valid).toBe(false);
  });

  it('rejects binary PE / MZ executables disguised as .pdf', () => {
    // Starts with MZ (4D 5A)
    const disguisedExe = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = validateUploadedFile(disguisedExe, 'real_contract.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('PE/MZ nguy hiểm');
  });

  it('rejects empty file (0 bytes)', () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = validateUploadedFile(emptyBuffer, 'empty.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File rỗng');
  });

  it('rejects file exceeding 25MB limit', () => {
    // 25MB + 1 byte
    const largeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1);
    const result = validateUploadedFile(largeBuffer, 'large.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('vượt quá giới hạn tối đa');
  });
});

