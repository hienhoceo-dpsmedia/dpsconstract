import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { payrollEntries, payrollAdjustments, workItems, users, contracts } from '../../db/schema.js';
import { finalizePayrollEntry } from './finalize.js';
import { createPayrollAdjustment, getNetPayrollAmount } from './adjustments.js';
import { recordClerkIncident, confirmClerkIncident, listClerkIncidents } from './incidents.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { verifyCsrfToken } from '../../http/csrf.js';
import { AppError } from '../../http/errors.js';
import type { UserActor } from '../../domain/types.js';

export const payrollRouter = Router();

function getActorFromReq(req: any): UserActor {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Yêu cầu đăng nhập.');
  }
  return {
    kind: 'user',
    userId: req.user.id,
    email: req.user.email,
    role: req.user.role,
  };
}

// GET /api/payroll/legal - Legal payroll ledger
payrollRouter.get('/legal', requireAuth, async (req, res, next) => {
  try {
    const actor = getActorFromReq(req);
    const db = getDb();

    let query = db
      .select({
        id: payrollEntries.id,
        contractId: payrollEntries.contractId,
        workItemId: payrollEntries.workItemId,
        beneficiaryId: payrollEntries.beneficiaryId,
        beneficiaryEmail: users.email,
        beneficiaryName: users.name,
        amountVnd: payrollEntries.amountVnd,
        finalizedAt: payrollEntries.finalizedAt,
        inputSnapshot: payrollEntries.inputSnapshot,
      })
      .from(payrollEntries)
      .innerJoin(workItems, eq(payrollEntries.workItemId, workItems.id))
      .innerJoin(users, eq(payrollEntries.beneficiaryId, users.id))
      .where(eq(workItems.kind, 'legal'))
      .orderBy(desc(payrollEntries.finalizedAt));

    // Non-admin can only view their own payroll
    if (actor.role !== 'admin') {
      const results = await db
        .select({
          id: payrollEntries.id,
          contractId: payrollEntries.contractId,
          workItemId: payrollEntries.workItemId,
          beneficiaryId: payrollEntries.beneficiaryId,
          beneficiaryEmail: users.email,
          beneficiaryName: users.name,
          amountVnd: payrollEntries.amountVnd,
          finalizedAt: payrollEntries.finalizedAt,
          inputSnapshot: payrollEntries.inputSnapshot,
        })
        .from(payrollEntries)
        .innerJoin(workItems, eq(payrollEntries.workItemId, workItems.id))
        .innerJoin(users, eq(payrollEntries.beneficiaryId, users.id))
        .where(
          and(
            eq(workItems.kind, 'legal'),
            eq(payrollEntries.beneficiaryId, actor.userId)
          )
        )
        .orderBy(desc(payrollEntries.finalizedAt));

      return res.json(results);
    }

    const rows = await query;
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/payroll/clerk - Clerk payroll ledger
payrollRouter.get('/clerk', requireAuth, async (req, res, next) => {
  try {
    const actor = getActorFromReq(req);
    const db = getDb();

    if (actor.role !== 'admin') {
      const results = await db
        .select({
          id: payrollEntries.id,
          contractId: payrollEntries.contractId,
          workItemId: payrollEntries.workItemId,
          beneficiaryId: payrollEntries.beneficiaryId,
          beneficiaryEmail: users.email,
          beneficiaryName: users.name,
          amountVnd: payrollEntries.amountVnd,
          finalizedAt: payrollEntries.finalizedAt,
          inputSnapshot: payrollEntries.inputSnapshot,
        })
        .from(payrollEntries)
        .innerJoin(workItems, eq(payrollEntries.workItemId, workItems.id))
        .innerJoin(users, eq(payrollEntries.beneficiaryId, users.id))
        .where(
          and(
            eq(workItems.kind, 'clerk'),
            eq(payrollEntries.beneficiaryId, actor.userId)
          )
        )
        .orderBy(desc(payrollEntries.finalizedAt));

      return res.json(results);
    }

    const rows = await db
      .select({
        id: payrollEntries.id,
        contractId: payrollEntries.contractId,
        workItemId: payrollEntries.workItemId,
        beneficiaryId: payrollEntries.beneficiaryId,
        beneficiaryEmail: users.email,
        beneficiaryName: users.name,
        amountVnd: payrollEntries.amountVnd,
        finalizedAt: payrollEntries.finalizedAt,
        inputSnapshot: payrollEntries.inputSnapshot,
      })
      .from(payrollEntries)
      .innerJoin(workItems, eq(payrollEntries.workItemId, workItems.id))
      .innerJoin(users, eq(payrollEntries.beneficiaryId, users.id))
      .where(eq(workItems.kind, 'clerk'))
      .orderBy(desc(payrollEntries.finalizedAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/payroll/incidents - List clerk incidents
payrollRouter.get('/incidents', requireAuth, async (req, res, next) => {
  try {
    const { contractId, responsibleId } = req.query;
    const incidents = await listClerkIncidents({
      contractId: contractId ? String(contractId) : undefined,
      responsibleId: responsibleId ? String(responsibleId) : undefined,
    });
    res.json(incidents);
  } catch (err) {
    next(err);
  }
});

// POST /api/payroll/incidents - Record clerk incident (Admin or Clerk)
payrollRouter.post('/incidents', requireAuth, verifyCsrfToken, async (req, res, next) => {
  try {
    const actor = getActorFromReq(req);
    const { contractId, workItemId, responsibleId, description } = req.body;
    const result = await recordClerkIncident({
      contractId,
      workItemId,
      responsibleId,
      description,
      actor,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/payroll/incidents/:id/confirm - Confirm incident (Admin only)
payrollRouter.patch(
  '/incidents/:id/confirm',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await confirmClerkIncident({
        incidentId: req.params.id,
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/payroll/finalize - Finalize a workItem (Admin only)
payrollRouter.post(
  '/finalize',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { workItemId } = req.body;
      if (!workItemId) {
        throw new AppError(400, 'MISSING_WORK_ITEM_ID', 'Mã workItemId là bắt buộc.');
      }
      const result = await finalizePayrollEntry({
        workItemId,
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/payroll/adjustments - Create manual adjustment (Admin only)
payrollRouter.post(
  '/adjustments',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { entryId, deltaVnd, reason, idempotencyKey } = req.body;
      const result = await createPayrollAdjustment({
        entryId,
        deltaVnd: Number(deltaVnd) || 0,
        reason,
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/payroll/:id - Detailed payroll entry
payrollRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const actor = getActorFromReq(req);
    const db = getDb();

    const [entry] = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.id, req.params.id));

    if (!entry) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi lương.');
    }

    // Role check: non-admin can only see their own entry
    if (actor.role !== 'admin' && entry.beneficiaryId !== actor.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xem bảng lương của người khác.');
    }

    const net = await getNetPayrollAmount(entry.id);
    const adjustments = await db
      .select()
      .from(payrollAdjustments)
      .where(eq(payrollAdjustments.entryId, entry.id));

    res.json({
      entry,
      net,
      adjustments,
    });
  } catch (err) {
    next(err);
  }
});

