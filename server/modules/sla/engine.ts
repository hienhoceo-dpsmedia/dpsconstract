import crypto from 'crypto';
import { getDb } from '../../db/client.js';
import { contracts, slaAlerts } from '../../db/schema.js';
import { inArray, eq, sql, and } from 'drizzle-orm';
import { getSettingsRecord } from '../settings/repository.js';
import { enqueueJob } from '../jobs/outbox.js';

export interface SlaBreachResult {
  breachedCount: number;
  internalBreaches: string[];
  courierBreaches: string[];
}

/**
 * Scans active contracts across physical stages, detects SLA delays,
 * raises persistent alerts in slaAlerts, and dispatches Teams notifications via Outbox.
 */
export async function scanAndDetectSlaBreaches(referenceTime: Date = new Date()): Promise<SlaBreachResult> {
  const db = getDb();
  const settings = await getSettingsRecord();

  const slaInternalHours = settings?.slaInternalHours || 24;
  const slaViettelPostDays = settings?.slaViettelPostDays || 3;
  const slaViettelPostHours = slaViettelPostDays * 24;

  const internalStages = ['Chờ in', 'Đang chờ ký', 'Chờ tạo vận đơn', 'Chờ bản gửi lại'];
  const internalBreaches: string[] = [];
  const courierBreaches: string[] = [];

  // 1. Scan internal processing stages
  const activeInternalContracts = await db
    .select()
    .from(contracts)
    .where(inArray(contracts.status, internalStages));

  for (const c of activeInternalContracts) {
    const enteredAt = c.statusEnteredAt ? new Date(c.statusEnteredAt).getTime() : new Date(c.lastActivityAt).getTime();
    const elapsedHours = (referenceTime.getTime() - enteredAt) / (1000 * 60 * 60);

    if (elapsedHours > slaInternalHours) {
      internalBreaches.push(c.id);

      // Update contract SLA breach status
      await db
        .update(contracts)
        .set({
          slaBreached: true,
          slaBreachType: 'internal',
        })
        .where(eq(contracts.id, c.id));

      // Record SLA alert (idempotent on contractId + stageInstanceId)
      const stageInstId = c.stageInstanceId || `stg_${c.status}`;
      const alertId = `sla_${c.id}_${stageInstId}`;
      const deadline = new Date(enteredAt + slaInternalHours * 60 * 60 * 1000);

      await db
        .insert(slaAlerts)
        .values({
          id: alertId,
          contractId: c.id,
          stageInstanceId: stageInstId,
          ruleVersion: 1,
          deadline,
          openedAt: referenceTime,
        })
        .onConflictDoNothing();

      // Enqueue Teams notification
      await enqueueJob({
        eventType: 'teams_webhook',
        aggregateId: c.id,
        payload: {
          title: `CẢNH BÁO SLA NỘI BỘ: Hợp đồng #${c.contractNumber}`,
          text: `Hợp đồng "${c.name}" (Đối tác: ${c.partnerName}) tồn đọng ở bước "${c.status}" quá ${slaInternalHours} giờ.`,
          contractId: c.id,
          status: c.status,
          themeColor: 'EA4335',
        },
        dedupeKey: `sla_alert_${c.id}_${stageInstId}`,
      });
    }
  }

  // 2. Scan courier shipping stage
  const inTransitContracts = await db
    .select()
    .from(contracts)
    .where(eq(contracts.status, 'Đang giao'));

  for (const c of inTransitContracts) {
    const enteredAt = c.statusEnteredAt ? new Date(c.statusEnteredAt).getTime() : new Date(c.lastActivityAt).getTime();
    const elapsedHours = (referenceTime.getTime() - enteredAt) / (1000 * 60 * 60);

    if (elapsedHours > slaViettelPostHours) {
      courierBreaches.push(c.id);

      await db
        .update(contracts)
        .set({
          slaBreached: true,
          slaBreachType: 'viettelpost',
        })
        .where(eq(contracts.id, c.id));

      const stageInstId = c.stageInstanceId || `stg_shipping`;
      const alertId = `sla_${c.id}_${stageInstId}`;
      const deadline = new Date(enteredAt + slaViettelPostHours * 60 * 60 * 1000);

      await db
        .insert(slaAlerts)
        .values({
          id: alertId,
          contractId: c.id,
          stageInstanceId: stageInstId,
          ruleVersion: 1,
          deadline,
          openedAt: referenceTime,
        })
        .onConflictDoNothing();

      await enqueueJob({
        eventType: 'teams_webhook',
        aggregateId: c.id,
        payload: {
          title: `CẢNH BÁO SLA VIETTEL POST: Hợp đồng #${c.contractNumber}`,
          text: `Hợp đồng "${c.name}" (Số: ${c.contractNumber}) đang giao qua Viettel Post quá ${slaViettelPostDays} ngày chưa nhận được cập nhật mới.`,
          contractId: c.id,
          status: c.status,
          themeColor: 'FFA000',
        },
        dedupeKey: `sla_alert_${c.id}_${stageInstId}`,
      });
    }
  }

  return {
    breachedCount: internalBreaches.length + courierBreaches.length,
    internalBreaches,
    courierBreaches,
  };
}

