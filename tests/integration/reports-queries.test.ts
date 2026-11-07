import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestSchema, TestSchemaContext } from '../support/database.js';
import {
  generateAggregatedReports,
  exportContractsReconciliationCsv,
} from '../../server/modules/reports/service.js';
import { getDb } from '../../server/db/client.js';
import { contracts } from '../../server/db/schema.js';

describe('SQL Aggregated Reports & Reconciliation Export (T51, T52)', () => {
  let ctx: TestSchemaContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestSchema();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('aggregates real metrics from PostgreSQL without mock data', async () => {
    const db = getDb();
    const ts = Date.now();

    // Insert 2 contracts
    await db.insert(contracts).values([
      {
        id: `c_rep_1_${ts}`,
        contractNumber: `HD-REP-1-${ts.toString().slice(-4)}`,
        name: 'Hợp Đồng Báo Cáo 1',
        partnerName: 'Đối Tác Alpha',
        valueText: '100.000.000 VNĐ',
        valueAmount: '100000000',
        status: 'Hoàn tất',
        processingMethod: 'physical',
        slaBreached: false,
      },
      {
        id: `c_rep_2_${ts}`,
        contractNumber: `HD-REP-2-${ts.toString().slice(-4)}`,
        name: 'Hợp Đồng Báo Cáo 2',
        partnerName: 'Đối Tác Beta',
        valueText: '50.000.000 VNĐ',
        valueAmount: '50000000',
        status: 'Chờ in',
        processingMethod: 'physical',
        slaBreached: true,
      },
    ]);

    const report = await generateAggregatedReports();

    expect(report.totalContracts).toBeGreaterThanOrEqual(2);
    expect(report.totalValueVnd).toBeGreaterThanOrEqual(150000000);
    expect(report.contractsByStatus).toHaveProperty('Hoàn tất');
    expect(report.contractsByStatus).toHaveProperty('Chờ in');
    expect(report.slaBreachCount).toBeGreaterThanOrEqual(1);
    expect(report.payrollSummary).toBeDefined();
    expect(report.topPartners.length).toBeGreaterThanOrEqual(1);
  });

  it('exports reconciliation CSV with UTF-8 BOM encoding for Excel', async () => {
    const csv = await exportContractsReconciliationCsv();

    // Verify UTF-8 BOM (\uFEFF)
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Verify Vietnamese headers
    expect(csv).toContain('Mã Hợp Đồng');
    expect(csv).toContain('Tên Hợp Đồng');
    expect(csv).toContain('Đối Tác');
    expect(csv).toContain('Trạng Thái');
    expect(csv).toContain('Vi Phạm SLA');
  });
});

