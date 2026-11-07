import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, contractAuditLogs } from '../../db/schema.js';
import { parseContractValue } from '../../domain/money.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export const ALLOWED_EDIT_FIELDS = [
  'name',
  'partnerName',
  'valueText',
  'receiverName',
  'receiverPhone',
  'receiverAddress',
  'deliveryNotes',
  'printCopies',
  'googleDocsLink',
] as const;

export type AllowedEditField = (typeof ALLOWED_EDIT_FIELDS)[number];

export interface EditContractMetadataParams {
  contractId: string;
  fields: Partial<Record<AllowedEditField, unknown>>;
  note: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function editContractMetadata(params: EditContractMetadataParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp lý do chỉnh sửa thông tin hợp đồng.');
  }

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

    if (contract.status === 'Hoàn tất' || contract.status === 'Đã hủy') {
      throw new AppError(
        400,
        'TERMINAL_CONTRACT_LOCKED',
        `Không thể chỉnh sửa hợp đồng đã ở trạng thái "${contract.status}".`
      );
    }

    const diff: Record<string, { old: unknown; new: unknown }> = {};
    const updateValues: Record<string, unknown> = {
      lastActivityAt: now,
    };

    for (const field of ALLOWED_EDIT_FIELDS) {
      if (params.fields[field] !== undefined) {
        const oldValue = (contract as any)[field];
        const newValue = params.fields[field];

        if (String(oldValue) !== String(newValue)) {
          diff[field] = { old: oldValue, new: newValue };
          updateValues[field] = newValue;
        }
      }
    }

    // Special check if valueText changed, also recalculate valueAmount
    if (params.fields.valueText !== undefined && diff.valueText) {
      const parsed = parseContractValue(String(params.fields.valueText));
      updateValues.valueAmount = parsed.valueAmount !== null ? String(parsed.valueAmount) : '0';
      if (parsed.currency) {
        updateValues.currency = parsed.currency;
      }
    }

    if (Object.keys(diff).length === 0) {
      return { success: true, message: 'Không có thay đổi nào được ghi nhận.' };
    }

    // Update contract
    await tx.update(contracts).set(updateValues).where(eq(contracts.id, contract.id));

    // Audit log with diff
    await tx.insert(contractAuditLogs).values({
      id: crypto.randomUUID(),
      contractId: contract.id,
      cycleId: contract.currentCycleId,
      action: 'edit_metadata',
      fromStatus: contract.status,
      toStatus: contract.status,
      actorKind: 'user',
      actorId: params.actor.userId,
      actorEmail: params.actor.email,
      reason: params.note,
      metadata: { diff },
      createdAt: now,
    });

    return {
      success: true,
      updatedFields: Object.keys(diff),
      diff,
    };
  });
}

