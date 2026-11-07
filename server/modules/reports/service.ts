import { getDb, getPool } from '../../db/client.js';
import { contracts, payrollEntries, payrollAdjustments } from '../../db/schema.js';
import { sql, eq } from 'drizzle-orm';

export interface ContractAggregatedReports {
  totalContracts: number;
  totalValueVnd: number;
  contractsByStatus: Record<string, number>;
  slaBreachCount: number;
  slaBreachRate: number;
  payrollSummary: {
    totalLegalPayrollVnd: number;
    totalClerkPayrollVnd: number;
    totalAdjustmentsVnd: number;
    netPayrollVnd: number;
  };
  topPartners: Array<{ partnerName: string; contractCount: number; totalValueVnd: number }>;
  generatedAt: string;
}

/**
 * Generates aggregated statistical reports directly using SQL queries in PostgreSQL
 */
export async function generateAggregatedReports(): Promise<ContractAggregatedReports> {
  const pool = getPool();

  // 1. Total counts, total values and SLA breach counts
  const overviewQuery = `
    SELECT 
      count(*)::int as "totalContracts",
      coalesce(sum("value_amount"), 0)::bigint as "totalValueVnd",
      count(*) FILTER (WHERE "sla_breached" = true)::int as "slaBreachCount"
    FROM "contracts";
  `;
  const overviewResult = await pool.query(overviewQuery);
  const overview = overviewResult.rows[0] || { totalContracts: 0, totalValueVnd: 0, slaBreachCount: 0 };

  // 2. Count by 12 statuses
  const statusQuery = `
    SELECT "status", count(*)::int as "count"
    FROM "contracts"
    GROUP BY "status";
  `;
  const statusResult = await pool.query(statusQuery);
  const contractsByStatus: Record<string, number> = {};
  for (const row of statusResult.rows) {
    contractsByStatus[row.status] = row.count;
  }

  // 3. Payroll summary from snapshot ledgers
  const payrollQuery = `
    SELECT
      coalesce(sum(p."amount_vnd") FILTER (WHERE u."role" = 'legal'), 0)::bigint as "totalLegalPayrollVnd",
      coalesce(sum(p."amount_vnd") FILTER (WHERE u."role" = 'clerk'), 0)::bigint as "totalClerkPayrollVnd"
    FROM "payrollEntries" p
    LEFT JOIN "users" u ON p."beneficiary_id" = u."id";
  `;
  const payrollResult = await pool.query(payrollQuery);
  const payrollRow = payrollResult.rows[0] || { totalLegalPayrollVnd: 0, totalClerkPayrollVnd: 0 };

  const adjustmentsQuery = `
    SELECT coalesce(sum("delta_vnd"), 0)::bigint as "totalAdjustmentsVnd"
    FROM "payrollAdjustments";
  `;
  const adjResult = await pool.query(adjustmentsQuery);
  const adjRow = adjResult.rows[0] || { totalAdjustmentsVnd: 0 };

  const totalLegal = Number(payrollRow.totalLegalPayrollVnd || 0);
  const totalClerk = Number(payrollRow.totalClerkPayrollVnd || 0);
  const totalAdjustments = Number(adjRow.totalAdjustmentsVnd || 0);
  const netPayroll = totalLegal + totalClerk + totalAdjustments;

  // 4. Top 5 partners
  const topPartnersQuery = `
    SELECT 
      "partner_name" as "partnerName",
      count(*)::int as "contractCount",
      coalesce(sum("value_amount"), 0)::bigint as "totalValueVnd"
    FROM "contracts"
    GROUP BY "partner_name"
    ORDER BY "totalValueVnd" DESC, "contractCount" DESC
    LIMIT 5;
  `;
  const topPartnersResult = await pool.query(topPartnersQuery);
  const topPartners = topPartnersResult.rows.map(r => ({
    partnerName: r.partnerName,
    contractCount: Number(r.contractCount),
    totalValueVnd: Number(r.totalValueVnd),
  }));

  const totalContracts = Number(overview.totalContracts || 0);
  const slaBreachCount = Number(overview.slaBreachCount || 0);
  const slaBreachRate = totalContracts > 0 ? Math.round((slaBreachCount / totalContracts) * 100) : 0;

  return {
    totalContracts,
    totalValueVnd: Number(overview.totalValueVnd || 0),
    contractsByStatus,
    slaBreachCount,
    slaBreachRate,
    payrollSummary: {
      totalLegalPayrollVnd: totalLegal,
      totalClerkPayrollVnd: totalClerk,
      totalAdjustmentsVnd: totalAdjustments,
      netPayrollVnd: netPayroll,
    },
    topPartners,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates Reconciliation CSV Report with UTF-8 BOM encoding for Excel compatibility
 */
export async function exportContractsReconciliationCsv(): Promise<string> {
  const pool = getPool();
  const query = `
    SELECT 
      "contract_number" as "contractNumber",
      "name",
      "partner_name" as "partnerName",
      "value_text" as "valueText",
      "status",
      "processing_method" as "processingMethod",
      "sla_breached" as "slaBreached",
      "uploaded_at" as "createdAt",
      "archived_at" as "archivedAt"
    FROM "contracts"
    ORDER BY "uploaded_at" DESC;
  `;

  const result = await pool.query(query);

  const headers = [
    'Mã Hợp Đồng',
    'Tên Hợp Đồng',
    'Đối Tác',
    'Giá Trị Hợp Đồng',
    'Trạng Thái',
    'Quy Trình',
    'Vi Phạm SLA',
    'Ngày Khởi Tạo',
    'Ngày Hoàn Tất',
  ];

  const rows = result.rows.map(row => {
    return [
      `"${row.contractNumber || ''}"`,
      `"${(row.name || '').replace(/"/g, '""')}"`,
      `"${(row.partnerName || '').replace(/"/g, '""')}"`,
      `"${(row.valueText || '').replace(/"/g, '""')}"`,
      `"${row.status || ''}"`,
      `"${row.processingMethod === 'digital' ? 'Số hóa' : 'Vật lý'}"`,
      `"${row.slaBreached ? 'CÓ' : 'KHÔNG'}"`,
      `"${row.createdAt ? new Date(row.createdAt).toLocaleString('vi-VN') : ''}"`,
      `"${row.archivedAt ? new Date(row.archivedAt).toLocaleString('vi-VN') : ''}"`,
    ].join(',');
  });

  // UTF-8 BOM: \uFEFF ensures Microsoft Excel opens Vietnamese UTF-8 characters without mojibake
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}
