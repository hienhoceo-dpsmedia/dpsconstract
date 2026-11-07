import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  mimeType: string;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.psm1',
  '.js', '.mjs', '.cjs', '.vbs', '.php', '.phtml', '.jar',
  '.msi', '.dll', '.scr', '.com', '.py', '.rb'
]);

/**
 * Validates file buffer against size limit, extension blocklist, and magic bytes.
 */
export function validateUploadedFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMime?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, mimeType: 'application/octet-stream', error: 'File rỗng (0 bytes)' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      mimeType: 'application/octet-stream',
      error: `Dung lượng tệp (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn tối đa cho phép 25 MB`
    };
  }

  const ext = path.extname(originalFilename).toLowerCase();
  if (DISALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      mimeType: 'application/octet-stream',
      error: `Định dạng tệp "${ext}" bị cấm vì lý do an toàn bảo mật hệ thống`
    };
  }

  // Check dangerous executable magic bytes (DOS / Windows PE: "MZ")
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return {
      valid: false,
      mimeType: 'application/x-dosexec',
      error: 'Phát hiện tệp thực thi nhị phân PE/MZ nguy hiểm bị từ chối'
    };
  }

  // Check ELF executable magic bytes: 0x7F 'E' 'L' 'F'
  if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return {
      valid: false,
      mimeType: 'application/x-executable',
      error: 'Phát hiện tệp thực thi Linux ELF bị từ chối'
    };
  }

  // Magic bytes checks for allowed formats
  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, mimeType: 'application/pdf' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, mimeType: 'image/png' };
  }

  // 3. JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // 4. DOCX / ZIP: PK.. (0x50 0x4B 0x03 0x04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4B &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    if (ext === '.docx') {
      return {
        valid: true,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
    }
    return { valid: true, mimeType: 'application/zip' };
  }

  // 5. Legacy DOC (OLE Compound File): D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xD0 &&
    buffer[1] === 0xCF &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xE0
  ) {
    return { valid: true, mimeType: 'application/msword' };
  }

  // If extension is allowed text/document and declared mime matches
  if (['.txt', '.csv'].includes(ext)) {
    return { valid: true, mimeType: ext === '.csv' ? 'text/csv' : 'text/plain' };
  }

  return {
    valid: false,
    mimeType: 'application/octet-stream',
    error: `Định dạng tệp không được hỗ trợ hoặc nội dung tệp không khớp với phần mở rộng (${ext})`
  };
}

