import { Router } from 'express';
import { processVtpWebhookEvent } from './vtp.js';
import { scanAndDetectSlaBreaches } from '../sla/engine.js';
import { getDb } from '../../db/client.js';
import { vtpTrackingHistory, systemAuditLogs } from '../../db/schema.js';
import { desc } from 'drizzle-orm';

export const integrationsRouter = Router();

// POST /api/sim/vtp-webhook
integrationsRouter.post('/vtp-webhook', async (req, res, next) => {
  try {
    const { waybillCode, status, note, location, statusCode } = req.body;
    const numericCode = statusCode || (status === 'Đang giao' ? 200 : status === 'Chờ bản gửi lại' ? 500 : status === 'Sự cố vận chuyển' ? 505 : 100);

    const result = await processVtpWebhookEvent({
      waybillCode,
      statusCode: numericCode,
      statusName: status || 'Cập nhật từ Simulation Webhook',
      note,
      location,
      eventTime: new Date().toISOString(),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/sim/run-sla-check
integrationsRouter.post('/run-sla-check', async (req, res, next) => {
  try {
    const result = await scanAndDetectSlaBreaches();
    res.json({
      success: true,
      message: `Đã quét SLA thủ công thành công. Phát hiện ${result.breachedCount} vi phạm.`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sim/logs
integrationsRouter.get('/logs', async (req, res, next) => {
  try {
    const db = getDb();
    const logs = await db
      .select()
      .from(vtpTrackingHistory)
      .orderBy(desc(vtpTrackingHistory.occurredAt))
      .limit(50);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});
