import { describe, it, expect } from 'vitest';
import { verifyDumpFileFormat } from '../../scripts/verify-backup.js';
import fs from 'fs';
import path from 'path';

describe('Backup Tooling & Integrity Verification (T57)', () => {
  const tempDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  it('validates authentic PostgreSQL custom dump header (PGDMP)', () => {
    const validDump = path.join(tempDir, 'test_valid.dump');
    // Write PGDMP magic bytes (5 bytes) + sample data
    fs.writeFileSync(validDump, Buffer.concat([Buffer.from('PGDMP'), Buffer.from([0x01, 0x02, 0x03])]));

    const isValid = verifyDumpFileFormat(validDump);
    expect(isValid).toBe(true);

    fs.unlinkSync(validDump);
  });

  it('rejects corrupt or plain text file disguised as .dump', () => {
    const invalidDump = path.join(tempDir, 'test_invalid.dump');
    fs.writeFileSync(invalidDump, 'PLAIN TEXT SQL NOT A PGDMP ARCHIVE');

    const isValid = verifyDumpFileFormat(invalidDump);
    expect(isValid).toBe(false);

    fs.unlinkSync(invalidDump);
  });

  it('rejects non-existent file path safely', () => {
    const isValid = verifyDumpFileFormat(path.join(tempDir, 'does_not_exist.dump'));
    expect(isValid).toBe(false);
  });
});

