import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const CONTRACTS_DIR = path.resolve(process.cwd(), 'data', 'contracts');
if (!fs.existsSync(CONTRACTS_DIR)) {
  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
}

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

export function saveUploadedBuffer(
  buffer: Buffer,
  originalName: string,
  prefix: string = 'file'
): {
  storageKey: string;
  sha256: string;
  size: number;
  filePath: string;
} {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName) || '.bin';
  const fileName = `${prefix}_${Date.now()}_${hash.slice(0, 8)}${ext}`;
  const filePath = path.join(CONTRACTS_DIR, fileName);

  fs.writeFileSync(filePath, buffer);

  return {
    storageKey: fileName,
    sha256: hash,
    size: buffer.length,
    filePath,
  };
}

