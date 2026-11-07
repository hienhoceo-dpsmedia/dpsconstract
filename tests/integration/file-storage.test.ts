import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, TestSchemaContext } from '../support/database.js';
import { saveFile, streamFile, getDiskPathForHash } from '../../server/modules/files/storage.js';
import fs from 'fs';

describe('Content-Addressable File Storage & Range Requests (T34)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('saves file with SHA-256 deduplication and records in database', async () => {
    const content = Buffer.from('%PDF-1.4 Content for testing sha256 dedup ' + Date.now());
    
    // Save first time
    const rec1 = await saveFile({
      buffer: content,
      originalFilename: 'Test_Contract_v1.pdf',
      type: 'original',
    });

    expect(rec1.id).toBeDefined();
    expect(rec1.sha256).toBeDefined();
    expect(rec1.detectedMime).toBe('application/pdf');

    const diskPath = getDiskPathForHash(rec1.sha256);
    expect(fs.existsSync(diskPath)).toBe(true);

    // Save identical content again with different filename
    const rec2 = await saveFile({
      buffer: content,
      originalFilename: 'Test_Contract_Copy.pdf',
      type: 'attachment',
    });

    expect(rec2.id).not.toBe(rec1.id);
    expect(rec2.sha256).toBe(rec1.sha256);
    expect(getDiskPathForHash(rec2.sha256)).toBe(diskPath);
  });

  it('streams entire file with HTTP 200 when no range requested', async () => {
    const content = Buffer.from('%PDF-1.4 Stream Test 200');
    const rec = await saveFile({
      buffer: content,
      originalFilename: 'Stream_200.pdf',
      type: 'original',
    });

    const streamResult = await streamFile(rec.id);
    expect(streamResult.status).toBe(200);
    expect(streamResult.headers['Content-Type']).toBe('application/pdf');
    expect(streamResult.headers['Content-Length']).toBe(content.length);
    expect(streamResult.headers['Accept-Ranges']).toBe('bytes');

    // Read stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.stream) {
      chunks.push(chunk);
    }
    const finalBuffer = Buffer.concat(chunks);
    expect(finalBuffer.toString()).toBe(content.toString());
  });

  it('streams partial content with HTTP 206 when range requested', async () => {
    const content = Buffer.from('%PDF-1.4 ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890');
    const rec = await saveFile({
      buffer: content,
      originalFilename: 'Stream_206.pdf',
      type: 'original',
    });

    // Request bytes 0 to 9 (first 10 bytes)
    const streamResult = await streamFile(rec.id, { rangeHeader: 'bytes=0-9' });
    expect(streamResult.status).toBe(206);
    expect(streamResult.headers['Content-Range']).toBe(`bytes 0-9/${content.length}`);
    expect(streamResult.headers['Content-Length']).toBe(10);

    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.stream) {
      chunks.push(chunk);
    }
    const finalBuffer = Buffer.concat(chunks);
    expect(finalBuffer.length).toBe(10);
    expect(finalBuffer.toString()).toBe(content.subarray(0, 10).toString());
  });
});
