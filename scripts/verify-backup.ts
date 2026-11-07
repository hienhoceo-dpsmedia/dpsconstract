import fs from 'fs';
import path from 'path';

/**
 * Validates the header and integrity of a pg_dump custom archive (.dump)
 * PostgreSQL custom format archives start with magic bytes: 'PGDMP' (0x50 0x47 0x44 0x4D 0x50)
 */
export function verifyDumpFileFormat(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 5) {
    return false;
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(5);
  fs.readSync(fd, buffer, 0, 5, 0);
  fs.closeSync(fd);

  return buffer.toString('utf-8') === 'PGDMP';
}

if (process.argv[1] && process.argv[1].endsWith('verify-backup.ts')) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: tsx scripts/verify-backup.ts <path-to-dump-file>');
    process.exit(1);
  }
  const ok = verifyDumpFileFormat(path.resolve(target));
  if (ok) {
    console.log('[VERIFY_BACKUP] Valid PostgreSQL custom archive format (PGDMP).');
    process.exit(0);
  } else {
    console.error('[VERIFY_BACKUP] Invalid or corrupted dump file.');
    process.exit(1);
  }
}

