import { Router } from 'express';
import { generateAggregatedReports, exportContractsReconciliationCsv } from './service.js';
import { scanAndDetectSlaBreaches } from '../sla/engine.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export const reportsRouter = Router();

// GET /api/reports - Aggregated statistical reports
reportsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await generateAggregatedReports();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/export/csv - Export Reconciliation CSV
reportsRouter.get('/export/csv', requireAuth, async (req, res, next) => {
  try {
    const csvContent = await exportContractsReconciliationCsv();
    const filename = `Bao_Cao_Doi_Soat_Hop_Dong_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/run-sla-check - Manual trigger for SLA detection scan
reportsRouter.post('/run-sla-check', requireRole(['admin']), async (req, res, next) => {
  try {
    const result = await scanAndDetectSlaBreaches();
    res.json({
      success: true,
      message: `Đã quét SLA thành công. Phát hiện ${result.breachedCount} hợp đồng vi phạm hạn mức.`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

