import { Router } from 'express';
import { z } from 'zod';
import { findContractsPage, findContractById, findContractAuditHistory } from './repository.js';
import { contractQuerySchema } from './validation.js';
import { createDraftingRequest, createManualContract } from './service.js';
import {
  submitDraftRevision,
  recordDraftFeedback,
  approveSoftCopyDraft,
} from './revisions.js';
import {
  confirmPrintContract,
  confirmSignContract,
  assignWaybillContract,
  confirmPickupContract,
  confirmDeliveryContract,
} from './physical.js';
import { uploadScanContract, archiveContract } from './digital.js';
import {
  rejectContract,
  reportIssueContract,
  redraftContract,
  reshipContract,
  cancelContract,
} from './exceptions.js';
import { assignContractPersonnel } from './assignments.js';
import { editContractMetadata } from './edits.js';
import { addPhysicalEventNote } from './physical-notes.js';
import { uploadMemory, saveUploadedBuffer } from './upload-middleware.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { verifyCsrfToken } from '../../http/csrf.js';
import { AppError } from '../../http/errors.js';
import type { UserActor } from '../../domain/types.js';

export const contractsRouter = Router();

const draftRequestSchema = z.object({
  name: z.string().min(1, 'Tên hợp đồng là bắt buộc'),
  partnerName: z.string().min(1, 'Tên đối tác là bắt buộc'),
  valueText: z.string().min(1, 'Giá trị hợp đồng là bắt buộc'),
  valueAmount: z.number().optional(),
  currency: z.string().optional(),
  draftingInstructions: z.string().optional(),
  legalAssigneeId: z.string().optional().nullable(),
  processingMethod: z.enum(['physical', 'digital']).optional(),
});

const manualContractSchema = z.object({
  name: z.string().min(1, 'Tên hợp đồng là bắt buộc'),
  contractNumber: z.string().min(1, 'Số hợp đồng là bắt buộc'),
  partnerName: z.string().min(1, 'Tên đối tác là bắt buộc'),
  valueText: z.string().min(1, 'Giá trị hợp đồng là bắt buộc'),
  signDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  googleDocsLink: z.string().optional(),
  receiverName: z.string().optional(),
  receiverPhone: z.string().optional(),
  receiverAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  processingMethod: z.enum(['physical', 'digital']),
  printCopies: z.number().optional(),
});

function getActorFromReq(req: any): UserActor {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Yêu cầu đăng nhập trước khi thực hiện thao tác.');
  }
  return {
    kind: 'user',
    userId: req.user.id,
    email: req.user.email,
    role: req.user.role,
  };
}

// GET /api/contracts - Paginated list of contracts
contractsRouter.get('/', async (req, res, next) => {
  try {
    const parseRes = contractQuerySchema.safeParse(req.query);
    if (!parseRes.success) {
      throw new AppError(400, 'INVALID_QUERY', 'Tham số truy vấn danh sách hợp đồng không hợp lệ.');
    }

    const userContext = {
      role: req.user?.role || 'clerk',
      userId: req.user?.id,
    };

    const result = await findContractsPage(parseRes.data, userContext);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/request-draft (Admin only)
contractsRouter.post(
  '/request-draft',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const parse = draftRequestSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError(400, 'INVALID_INPUT', parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.');
      }

      const actor = getActorFromReq(req);
      const contract = await createDraftingRequest({
        ...parse.data,
        actorId: actor.userId,
        actorEmail: actor.email,
      });

      res.status(201).json(contract);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/manual (Admin or Legal)
contractsRouter.post(
  '/manual',
  requireAuth,
  requireRole(['admin', 'legal']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const parse = manualContractSchema.safeParse(req.body);
      if (!parse.success) {
        throw new AppError(400, 'INVALID_INPUT', parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.');
      }

      const actor = getActorFromReq(req);
      const contract = await createManualContract({
        ...parse.data,
        actorId: actor.userId,
        actorEmail: actor.email,
      });

      res.status(201).json(contract);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/submit-draft (Legal or Admin)
contractsRouter.post(
  '/:id/submit-draft',
  requireAuth,
  requireRole(['legal', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { googleDocsLink, note, fileId, contentHash } = req.body;

      const result = await submitDraftRevision({
        contractId: req.params.id,
        actor,
        fileId,
        docsUrl: googleDocsLink,
        contentHash,
        note,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/feedback-draft (Admin only)
contractsRouter.post(
  '/:id/feedback-draft',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      if (!note || typeof note !== 'string') {
        throw new AppError(400, 'MISSING_NOTE', 'Nội dung phản hồi chỉnh sửa là bắt buộc.');
      }

      const result = await recordDraftFeedback({
        contractId: req.params.id,
        actor,
        note,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/approve-soft-copy (Admin only)
contractsRouter.post(
  '/:id/approve-soft-copy',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await approveSoftCopyDraft({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/print (Clerk or Admin)
contractsRouter.post(
  '/:id/print',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await confirmPrintContract({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/sign (Clerk or Admin)
contractsRouter.post(
  '/:id/sign',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await confirmSignContract({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/waybill (Clerk or Admin)
contractsRouter.post(
  '/:id/waybill',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { waybillCode } = req.body;
      const result = await assignWaybillContract({
        contractId: req.params.id,
        waybillCode,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/confirm-pickup (Clerk or Admin)
contractsRouter.post(
  '/:id/confirm-pickup',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await confirmPickupContract({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/confirm-delivery (Clerk or Admin)
contractsRouter.post(
  '/:id/confirm-delivery',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await confirmDeliveryContract({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/scan (Clerk or Admin)
contractsRouter.post(
  '/:id/scan',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  uploadMemory.single('file'),
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      let scanFile: {
        name: string;
        storageKey: string;
        detectedMime: string;
        size: number;
        sha256: string;
      };

      if (req.file) {
        const saved = saveUploadedBuffer(req.file.buffer, req.file.originalname, 'scan');
        scanFile = {
          name: req.file.originalname,
          storageKey: saved.storageKey,
          detectedMime: req.file.mimetype,
          size: saved.size,
          sha256: saved.sha256,
        };
      } else if (req.body.base64) {
        const buffer = Buffer.from(req.body.base64, 'base64');
        const name = req.body.fileName || `scan_${Date.now()}.pdf`;
        const saved = saveUploadedBuffer(buffer, name, 'scan');
        scanFile = {
          name,
          storageKey: saved.storageKey,
          detectedMime: req.body.mimeType || 'application/pdf',
          size: saved.size,
          sha256: saved.sha256,
        };
      } else {
        throw new AppError(400, 'MISSING_FILE', 'Vui lòng đính kèm file scan hoặc chuỗi base64.');
      }

      const result = await uploadScanContract({
        contractId: req.params.id,
        file: scanFile,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/archive (Clerk or Admin)
contractsRouter.post(
  '/:id/archive',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const result = await archiveContract({
        contractId: req.params.id,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/reject (Clerk or Admin)
contractsRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      const result = await rejectContract({
        contractId: req.params.id,
        note,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/report-issue (Clerk or Admin)
contractsRouter.post(
  '/:id/report-issue',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      const result = await reportIssueContract({
        contractId: req.params.id,
        note,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/redraft (Admin or Legal)
contractsRouter.post(
  '/:id/redraft',
  requireAuth,
  requireRole(['admin', 'legal']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      const result = await redraftContract({
        contractId: req.params.id,
        note,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/reship (Clerk or Admin)
contractsRouter.post(
  '/:id/reship',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      const result = await reshipContract({
        contractId: req.params.id,
        note,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/cancel (Admin only)
contractsRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note } = req.body;
      const result = await cancelContract({
        contractId: req.params.id,
        note,
        actor,
        idempotencyKey: (req.headers['idempotency-key'] as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/contracts/:id/edit (Admin or Legal)
contractsRouter.put(
  '/:id/edit',
  requireAuth,
  requireRole(['admin', 'legal']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { note, updatedBy, ...fields } = req.body;
      const result = await editContractMetadata({
        contractId: req.params.id,
        fields,
        note: note || 'Cập nhật thông tin hợp đồng',
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/assign (Admin only)
contractsRouter.post(
  '/:id/assign',
  requireAuth,
  requireRole(['admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { role, assigneeId } = req.body;
      if (!role || !assigneeId) {
        throw new AppError(400, 'INVALID_INPUT', 'Vui lòng cung cấp vai trò và ID nhân sự cần gán.');
      }
      const result = await assignContractPersonnel({
        contractId: req.params.id,
        role,
        assigneeId,
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/contracts/:id/physical-note (Clerk or Admin)
contractsRouter.post(
  '/:id/physical-note',
  requireAuth,
  requireRole(['clerk', 'admin']),
  verifyCsrfToken,
  async (req, res, next) => {
    try {
      const actor = getActorFromReq(req);
      const { step, note } = req.body;
      const result = await addPhysicalEventNote({
        contractId: req.params.id,
        step: step || 'physical_note',
        note,
        actor,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/contracts/:id - Detail of a single contract
contractsRouter.get('/:id', async (req, res, next) => {
  try {
    const userContext = {
      role: req.user?.role || 'clerk',
      userId: req.user?.id,
    };

    const contract = await findContractById(req.params.id, userContext);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Không tìm thấy hợp đồng với mã "${req.params.id}".`);
    }

    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/history - Audit log history of a contract
contractsRouter.get('/:id/history', async (req, res, next) => {
  try {
    const history = await findContractAuditHistory(req.params.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});
