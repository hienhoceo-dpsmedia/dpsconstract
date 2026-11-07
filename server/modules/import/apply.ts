import fs from 'node:fs';
import { getDb } from '../../db/client.js';
import { contracts, jsonImportRuns, jsonImportRecords, contractIdentifiers } from '../../db/schema.js';
import { inspectJsonSource } from './inspect.js';
import { mapLegacyContract } from './mapping.js';
import { eq } from 'drizzle-orm';

export interface ApplyImportOptions {
  sourcePath: string;
  filesRoot?: string;
  includeDemo?: boolean;
}

export async function applyJsonImport(options: ApplyImportOptions) {
  const inspection = inspectJsonSource(options.sourcePath, options.filesRoot);

  if (inspection.seedContractsCount > 0 && !options.includeDemo) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Từ chối nhập ${inspection.seedContractsCount} hợp đồng mẫu (con_seed_*) vào môi trường production.`);
    }
  }

  const rawJson = JSON.parse(fs.readFileSync(options.sourcePath, 'utf-8'));
  const rawContracts = Array.isArray(rawJson.contracts) ? rawJson.contracts : [];

  const db = getDb();

  return await db.transaction(async (tx) => {
    const runId = crypto.randomUUID();

    // 1. Record import run
    await tx.insert(jsonImportRuns).values({
      id: runId,
      sourcePath: options.sourcePath,
      sourceSha256: inspection.sourceSha256,
      isDryRun: false,
      counts: {
        total: rawContracts.length,
      },
    });

    let inserted = 0;
    let alreadyImported = 0;

    for (const raw of rawContracts) {
      const mapped = mapLegacyContract(raw);

      // Check if already imported
      const existing = await tx.select().from(contracts).where(eq(contracts.id, mapped.id));
      if (existing.length > 0) {
        alreadyImported++;
        await tx.insert(jsonImportRecords).values({
          id: crypto.randomUUID(),
          runId,
          sourceId: mapped.id,
          entityType: 'contract',
          targetId: mapped.id,
          status: 'already_imported',
        });
        continue;
      }

      // Insert contract
      await tx.insert(contracts).values({
        id: mapped.id,
        contractNumber: mapped.contractNumber,
        name: mapped.name,
        partnerName: mapped.partnerName,
        valueText: mapped.valueText,
        valueAmount: mapped.valueAmount,
        currency: mapped.currency,
        valueKind: mapped.valueKind,
        status: mapped.status,
        version: mapped.version,
        processingMethod: mapped.processingMethod,
        uploadedAt: new Date(mapped.uploadedAt),
        slaBreached: mapped.slaBreached,
        requiresReview: mapped.requiresReview,
      });

      // Register identifier
      await tx.insert(contractIdentifiers).values({
        code: mapped.id,
        kind: 'id',
        contractId: mapped.id,
      }).onConflictDoNothing();

      if (mapped.contractNumber) {
        await tx.insert(contractIdentifiers).values({
          code: mapped.contractNumber,
          kind: 'current_number',
          contractId: mapped.id,
        }).onConflictDoNothing();
      }

      await tx.insert(jsonImportRecords).values({
        id: crypto.randomUUID(),
        runId,
        sourceId: mapped.id,
        entityType: 'contract',
        targetId: mapped.id,
        status: 'inserted',
      });

      inserted++;
    }

    return {
      runId,
      sourceSha256: inspection.sourceSha256,
      inserted,
      alreadyImported,
      total: rawContracts.length,
    };
  });
}

