import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, contractPhysicalEvents } from '../../db/schema.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface PhysicalNoteParams {
  contractId: string;
  step: string;
  note: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function addPhysicalEventNote(params: PhysicalNoteParams) {
  if (!params.note || params.note.trim() === '') {
    throw new AppError(400, 'MISSING_NOTE', 'Vui lòng cung cấp nội dung ghi chú hiện trường.');
  }

  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId));

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    const eventId = crypto.randomUUID();

    await tx.insert(contractPhysicalEvents).values({
      id: eventId,
      contractId: contract.id,
      cycleId: contract.currentCycleId,
      step: params.step || 'physical_note',
      note: params.note,
      actorId: params.actor.userId,
      createdAt: now,
    });

    return {
      success: true,
      eventId,
      step: params.step,
      note: params.note,
      createdAt: now,
    };
  });
}

