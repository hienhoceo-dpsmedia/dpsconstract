import { and, desc, asc, eq, ilike, or, sql, count } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { contracts, contractFiles, contractAuditLogs } from '../../db/schema.js';
import { CONTRACT_STATUSES, type ContractPage, type ContractStatus } from '../../../src/shared/contracts.js';
import { toContractSummary, toContractDetail } from './dto.js';
import type { ContractQuery } from './validation.js';

export async function findContractsPage(
  query: ContractQuery,
  userContext: { role?: string; userId?: string } = {}
): Promise<ContractPage> {
  const db = getDb();
  const conditions = [];

  // 1. Text search
  if (query.q && query.q.trim() !== '') {
    const searchPattern = `%${query.q.trim()}%`;
    conditions.push(
      or(
        ilike(contracts.name, searchPattern),
        ilike(contracts.partnerName, searchPattern),
        ilike(contracts.contractNumber, searchPattern)
      )
    );
  }

  // 2. Exact status filter
  if (query.status) {
    conditions.push(eq(contracts.status, query.status));
  }

  // 3. Processing method
  if (query.processingMethod) {
    conditions.push(eq(contracts.processingMethod, query.processingMethod));
  }

  // 4. Overdue filter
  if (query.overdue !== undefined) {
    conditions.push(eq(contracts.slaBreached, query.overdue));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count query
  const [totalRes] = await db
    .select({ total: count() })
    .from(contracts)
    .where(whereClause);
  const total = Number(totalRes?.total || 0);

  // Status counts query (all 12 statuses)
  const statusCountsRes = await db
    .select({
      status: contracts.status,
      count: count(),
    })
    .from(contracts)
    .where(whereClause)
    .groupBy(contracts.status);

  const statusCounts: Record<ContractStatus, number> = {
    'Chờ soạn thảo': 0,
    'Chờ duyệt bản mềm': 0,
    'Chờ in': 0,
    'Đang chờ ký': 0,
    'Chờ tạo vận đơn': 0,
    'Chờ shipper đến lấy': 0,
    'Đang giao': 0,
    'Chờ bản gửi lại': 0,
    'Hoàn tất': 0,
    'Bị từ chối ký': 0,
    'Sự cố vận chuyển': 0,
    'Đã hủy': 0,
  };

  for (const row of statusCountsRes) {
    const st = row.status as ContractStatus;
    if (statusCounts[st] !== undefined) {
      statusCounts[st] = Number(row.count);
    }
  }

  // Sorting
  const orderDirection = query.sortOrder === 'asc' ? asc : desc;
  const orderExpr =
    query.sortBy === 'contractNumber'
      ? orderDirection(contracts.contractNumber)
      : query.sortBy === 'status'
      ? orderDirection(contracts.status)
      : orderDirection(contracts.uploadedAt);

  // Pagination query with stable tie-break
  const rows = await db
    .select()
    .from(contracts)
    .where(whereClause)
    .orderBy(orderExpr, desc(contracts.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const items = rows.map((r) => toContractSummary(r as Record<string, unknown>, userContext));

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    statusCounts,
  };
}

export async function findContractById(
  id: string,
  userContext: { role?: string; userId?: string } = {}
) {
  const db = getDb();
  const [contractRow] = await db.select().from(contracts).where(eq(contracts.id, id));
  if (!contractRow) return null;

  const files = await db.select().from(contractFiles).where(eq(contractFiles.contractId, id));
  return toContractDetail(contractRow as Record<string, unknown>, files as Array<Record<string, unknown>>, userContext);
}

export async function findContractAuditHistory(contractId: string, limit = 50) {
  const db = getDb();
  return await db
    .select()
    .from(contractAuditLogs)
    .where(eq(contractAuditLogs.contractId, contractId))
    .orderBy(desc(contractAuditLogs.createdAt), desc(contractAuditLogs.id))
    .limit(limit);
}
