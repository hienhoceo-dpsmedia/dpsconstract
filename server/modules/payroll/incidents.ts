import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { clerkIncidents, contracts, users, workItems } from '../../db/schema.js';
import type { UserActor } from '../../domain/types.js';
import { AppError } from '../../http/errors.js';

export interface RecordIncidentParams {
  contractId: string;
  workItemId?: string;
  responsibleId?: string;
  description: string;
  actor: UserActor;
  clock?: () => Date;
}

export interface ConfirmIncidentParams {
  incidentId: string;
  actor: UserActor;
  clock?: () => Date;
}

export async function recordClerkIncident(params: RecordIncidentParams) {
  if (!params.description || params.description.trim() === '') {
    throw new AppError(400, 'MISSING_DESCRIPTION', 'Vui lòng cung cấp mô tả chi tiết sự cố văn thư.');
  }

  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    // 1. Verify contract exists
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, params.contractId));

    if (!contract) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng.');
    }

    const incidentId = crypto.randomUUID();

    const [inserted] = await tx
      .insert(clerkIncidents)
      .values({
        id: incidentId,
        contractId: contract.id,
        workItemId: params.workItemId || null,
        description: params.description,
        responsibleId: params.responsibleId || contract.clerkAssigneeId || null,
        recordedBy: params.actor.userId,
        createdAt: now,
      })
      .returning();

    return inserted;
  });
}

export async function confirmClerkIncident(params: ConfirmIncidentParams) {
  const db = getDb();
  const now = params.clock ? params.clock() : new Date();

  return await db.transaction(async (tx) => {
    const [incident] = await tx
      .select()
      .from(clerkIncidents)
      .where(eq(clerkIncidents.id, params.incidentId))
      .for('update');

    if (!incident) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi sự cố.');
    }

    const [updated] = await tx
      .update(clerkIncidents)
      .set({
        confirmedBy: params.actor.userId,
        confirmedAt: now,
      })
      .where(eq(clerkIncidents.id, incident.id))
      .returning();

    return updated;
  });
}

export async function listClerkIncidents(filters: {
  contractId?: string;
  responsibleId?: string;
}) {
  const db = getDb();
  const query = db
    .select({
      id: clerkIncidents.id,
      contractId: clerkIncidents.contractId,
      workItemId: clerkIncidents.workItemId,
      description: clerkIncidents.description,
      responsibleId: clerkIncidents.responsibleId,
      responsibleEmail: users.email,
      responsibleName: users.name,
      recordedBy: clerkIncidents.recordedBy,
      confirmedBy: clerkIncidents.confirmedBy,
      confirmedAt: clerkIncidents.confirmedAt,
      createdAt: clerkIncidents.createdAt,
    })
    .from(clerkIncidents)
    .leftJoin(users, eq(clerkIncidents.responsibleId, users.id))
    .orderBy(desc(clerkIncidents.createdAt));

  if (filters.contractId) {
    query.where(eq(clerkIncidents.contractId, filters.contractId));
  } else if (filters.responsibleId) {
    query.where(eq(clerkIncidents.responsibleId, filters.responsibleId));
  }

  return await query;
}

