import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export interface ImportInspectionReport {
  sourcePath: string;
  sourceSha256: string;
  totalContracts: number;
  seedContractsCount: number;
  totalUsers: number;
  totalFiles: number;
  missingFiles: string[];
  conflicts: string[];
  roleIssues: string[];
  canImportToProduction: boolean;
}

export function inspectJsonSource(
  sourcePath: string,
  filesRoot: string = 'uploads'
): ImportInspectionReport {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File nguồn không tồn tại: ${sourcePath}`);
  }

  const rawBytes = fs.readFileSync(sourcePath);
  const hash = crypto.createHash('sha256').update(rawBytes).digest('hex');
  const content = JSON.parse(rawBytes.toString('utf-8'));

  const contracts = Array.isArray(content.contracts) ? content.contracts : [];
  const users = Array.isArray(content.settings?.users) ? content.settings.users : [];

  let seedContractsCount = 0;
  const missingFiles: string[] = [];
  const conflicts: string[] = [];
  const roleIssues: string[] = [];
  const contractNumbersSeen = new Set<string>();

  for (const c of contracts) {
    if (String(c.id).startsWith('con_seed_')) {
      seedContractsCount++;
    }

    const normNumber = String(c.contractNumber || '').trim().toLowerCase();
    if (contractNumbersSeen.has(normNumber)) {
      conflicts.push(`Trùng mã hợp đồng trong file nguồn: ${c.contractNumber}`);
    } else if (normNumber) {
      contractNumbersSeen.add(normNumber);
    }

    if (Array.isArray(c.files)) {
      for (const f of c.files) {
        if (f.filePath) {
          const resolvedPath = path.isAbsolute(f.filePath) ? f.filePath : path.resolve(filesRoot, path.basename(f.filePath));
          if (!fs.existsSync(resolvedPath)) {
            missingFiles.push(`File không tồn tại trên đĩa: ${f.filePath} (hợp đồng: ${c.id})`);
          }
        }
      }
    }
  }

  for (const u of users) {
    if (!['admin', 'legal', 'clerk'].includes(u.role)) {
      roleIssues.push(`Vai trò không hợp lệ: ${u.email} có vai trò "${u.role}"`);
    }
  }

  return {
    sourcePath,
    sourceSha256: hash,
    totalContracts: contracts.length,
    seedContractsCount,
    totalUsers: users.length,
    totalFiles: contracts.reduce((acc: number, c: { files?: unknown[] }) => acc + (Array.isArray(c.files) ? c.files.length : 0), 0),
    missingFiles,
    conflicts,
    roleIssues,
    canImportToProduction: seedContractsCount === 0 && conflicts.length === 0,
  };
}

