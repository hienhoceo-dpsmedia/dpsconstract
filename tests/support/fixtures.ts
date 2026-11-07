/**
 * Minimal in-memory generation of valid sample PDF and DOCX binary buffers for tests.
 */

export function createSamplePdfBuffer(title = 'Hợp Đồng Thử Nghiệm'): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(${title}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
308
%%EOF`;

  return Buffer.from(content, 'utf-8');
}

export function createSampleDocxBuffer(): Buffer {
  // Minimal ZIP containing [Content_Types].xml (magic bytes PK 0x03 0x04)
  const header = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, // Local file header signature
    0x14, 0x00, 0x00, 0x00, // Version, flags
    0x08, 0x00, 0x00, 0x00, // Compression (deflated), time
    0x00, 0x00, 0x00, 0x00, // Date, crc32
    0x00, 0x00, 0x00, 0x00, // Compressed size
    0x00, 0x00, 0x00, 0x00, // Uncompressed size
    0x13, 0x00, 0x00, 0x00, // Filename length (19)
  ]);
  const filename = Buffer.from('[Content_Types].xml', 'utf-8');
  return Buffer.concat([header, filename]);
}

