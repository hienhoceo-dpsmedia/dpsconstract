import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../../db/client.js';
import { contractFiles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { validateUploadedFile } from './validation.js';

const STORAGE_ROOT = path.resolve(process.cwd(), 'data', 'storage');

// Ensure root directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

export interface StoredFileRecord {
  id: string;
  contractId: string | null;
  revisionId: string | null;
  cycleId: string | null;
  type: string;
  name: string;
  storageKey: string;
  detectedMime: string;
  size: number;
  sha256: string;
  availability: string;
  uploadedBy: string | null;
  uploadedAt: Date;
}

export interface StreamOptions {
  rangeHeader?: string;
}

export interface StreamResult {
  stream: fs.ReadStream;
  status: 200 | 206;
  headers: Record<string, string | number>;
}

/**
 * Computes sha256 hash of a buffer
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Resolves physical file path from sha256
 */
export function getDiskPathForHash(hash: string): string {
  const dir = path.join(STORAGE_ROOT, hash.slice(0, 2), hash.slice(2, 4));
  return path.join(dir, hash);
}

/**
 * Saves a file buffer using content-addressable storage.
 * Performs virus/magic-bytes validation, writes deduped file to disk, and records metadata in PostgreSQL.
 */
export async function saveFile(params: {
  buffer: Buffer;
  originalFilename: string;
  type: 'original' | 'scan' | 'attachment';
  contractId?: string | null;
  revisionId?: string | null;
  cycleId?: string | null;
  uploadedByUserId?: string | null;
}): Promise<StoredFileRecord> {
  const { buffer, originalFilename, type, contractId, revisionId, cycleId, uploadedByUserId } = params;

  // 1. Validation (T35)
  const val = validateUploadedFile(buffer, originalFilename);
  if (!val.valid) {
    throw new Error(val.error || 'Tệp không hợp lệ');
  }

  // 2. Compute SHA-256
  const hash = computeSha256(buffer);
  const targetPath = getDiskPathForHash(hash);
  const targetDir = path.dirname(targetPath);

  // 3. Write file to disk if not exists (Deduplication)
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetDir, { recursive: true });
    // Write atomically via tmp file
    const tmpPath = `${targetPath}.tmp.${crypto.randomUUID()}`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, targetPath);
  }

  // 4. Save metadata into PostgreSQL (T34)
  const db = getDb();
  const fileId = `file_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const storageKey = `sha256:${hash}:${fileId}:${originalFilename}`;

  const [record] = await db
    .insert(contractFiles)
    .values({
      id: fileId,
      contractId: contractId || null,
      revisionId: revisionId || null,
      cycleId: cycleId || null,
      type,
      name: originalFilename,
      storageKey,
      detectedMime: val.mimeType,
      size: buffer.length,
      sha256: hash,
      availability: 'present',
      uploadedBy: uploadedByUserId || null,
    })
    .returning();

  return record as StoredFileRecord;
}

/**
 * Streams a stored file supporting HTTP Range requests (206 Partial Content)
 */
export async function streamFile(
  fileId: string,
  options?: StreamOptions
): Promise<StreamResult> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(contractFiles)
    .where(eq(contractFiles.id, fileId))
    .limit(1);

  if (!record) {
    throw new Error('Không tìm thấy tệp trong hệ thống');
  }

  const filePath = getDiskPathForHash(record.sha256);
  if (!fs.existsSync(filePath)) {
    throw new Error('Tệp vật lý bị thiếu trên máy chủ lưu trữ');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const rangeHeader = options?.rangeHeader;

  // If no Range requested, return standard 200 stream
  if (!rangeHeader) {
    const stream = fs.createReadStream(filePath);
    return {
      stream,
      status: 200,
      headers: {
        'Content-Type': record.detectedMime,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(record.name)}"`,
        'ETag': `"${record.sha256}"`,
      },
    };
  }

  // Parse Range header: e.g. "bytes=0-1023" or "bytes=1024-"
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (isNaN(start) || start >= fileSize || (parts[1] && isNaN(end)) || start > end) {
    // 416 Range Not Satisfiable
    const err: any = new Error('Phạm vi yêu cầu không hợp lệ');
    err.status = 416;
    err.contentRange = `bytes */${fileSize}`;
    throw err;
  }

  const clampedEnd = Math.min(end, fileSize - 1);
  const chunkSize = clampedEnd - start + 1;

  const stream = fs.createReadStream(filePath, { start, end: clampedEnd });

  return {
    stream,
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${clampedEnd}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': record.detectedMime,
      'Content-Disposition': `inline; filename="${encodeURIComponent(record.name)}"`,
      'ETag': `"${record.sha256}"`,
    },
  };
}
