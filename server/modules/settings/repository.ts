import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { settings, settingsVersions, systemAuditLogs } from '../../db/schema.js';
import type { ValidatedSettings } from './validation.js';

export async function getSettingsRecord() {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.id, 'global_default'));
  if (rows.length === 0) {
    // Insert default settings row
    const [inserted] = await db.insert(settings).values({ id: 'global_default' }).returning();
    return inserted;
  }
  return rows[0];
}

export async function updateSettingsRecord(
  newValues: Partial<ValidatedSettings>,
  expectedVersion: number,
  actor: { id: string; name?: string; email: string }
) {
  const db = getDb();

  return await db.transaction(async (tx) => {
    // 1. Fetch current settings with FOR UPDATE lock
    const [current] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, 'global_default'))
      .for('update');

    if (!current) {
      throw new Error('Global settings record not found');
    }

    if (current.version !== expectedVersion) {
      const err = new Error(`Cấu hình đã bị thay đổi bởi người khác (version hiện tại: ${current.version}, gửi lên: ${expectedVersion}). Vui lòng tải lại.`);
      (err as unknown as { code: string; statusCode: number }).code = 'STALE_SETTINGS_VERSION';
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    const nextVersion = current.version + 1;

    // 2. Update settings table
    const [updated] = await tx
      .update(settings)
      .set({
        ...newValues,
        version: nextVersion,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 'global_default'))
      .returning();

    // 3. Save snapshot to settingsVersions
    await tx.insert(settingsVersions).values({
      id: crypto.randomUUID(),
      version: nextVersion,
      policySnapshot: updated as unknown as Record<string, unknown>,
      createdBy: actor.id,
    });

    // 4. Log to systemAuditLogs
    await tx.insert(systemAuditLogs).values({
      id: crypto.randomUUID(),
      target: 'settings',
      action: 'update_settings',
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      diff: { before: current, after: updated },
    });

    return updated;
  });
}

