import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, contractFiles } from '../../db/schema.js';
import { executeWorkflowTransition } from '../workflow/transition.js';
import type { Actor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface ScanFileInfo {
  name: string;
  storageKey: string;
  detectedMime: string;
  size: number;
  sha256: string;
}

export interface UploadScanParams {
  contractId: string;
  file: ScanFileInfo;
  actor: Actor;
  clock?: () => Date;
  idempotencyKey?: string;
}

export interface ArchiveParams {
  contractId: string;
  actor: Actor;
  clock?: () => Date;
  idempotencyKey?: string;
}

export async function uploadScanContract(params: UploadScanParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId))
      .for('update');

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    const fileId = crypto.randomUUID();

    // 1. Insert into contractFiles
    await tx.insert(contractFiles).values({
      id: fileId,
      contractId: contract.id,
      revisionId: contract.currentRevisionId,
      cycleId: contract.currentCycleId,
      type: 'scan',
      name: params.file.name,
      storageKey: params.file.storageKey,
      detectedMime: params.file.detectedMime,
      size: params.file.size,
      sha256: params.file.sha256,
      availability: 'present',
      uploadedBy: params.actor.kind === 'user' ? params.actor.userId : null,
      uploadedAt: now,
    });

    // 2. Execute workflow transition (upload_scan keeps state intact, records audit log)
    const transitionResult = await executeWorkflowTransition({
      contractId: contract.id,
      action: 'upload_scan',
      actor: params.actor,
      payload: {
        note: `Tải lên bản quét scan: ${params.file.name}`,
        hasScanFile: true,
      },
      clock: params.clock,
      idempotencyKey: params.idempotencyKey,
      tx,
    });

    return {
      fileId,
      name: params.file.name,
      transitionResult,
    };
  });
}

export async function archiveContract(params: ArchiveParams) {
  return await executeWorkflowTransition({
    contractId: params.contractId,
    action: 'archive',
    actor: params.actor,
    clock: params.clock,
    idempotencyKey: params.idempotencyKey,
  });
}

