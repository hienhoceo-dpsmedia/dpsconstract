import type { ContractStatus, Role } from '../../../src/shared/contracts.js';
import type { Actor, WorkflowAction } from '../../domain/types.js';

export interface ContractWorkflowSubject {
  id: string;
  status: ContractStatus;
  processingMethod: 'physical' | 'digital';
  hasScanFile?: boolean;
  assignedLegalId?: string | null;
  assignedClerkId?: string | null;
}

export type ActionRequirement = {
  validFromStatuses: readonly ContractStatus[];
  allowedRoles: readonly Role[];
  allowsService: boolean;
  appliesToPhysicalOnly?: boolean;
  requiresNote?: boolean;
};

export const ACTION_RULES: Record<WorkflowAction, ActionRequirement> = {
  submit_draft: {
    validFromStatuses: ['Chờ soạn thảo'],
    allowedRoles: ['legal', 'admin'],
    allowsService: false,
  },
  feedback_draft: {
    validFromStatuses: ['Chờ duyệt bản mềm'],
    allowedRoles: ['admin'],
    allowsService: false,
    requiresNote: true,
  },
  approve_soft_copy: {
    validFromStatuses: ['Chờ duyệt bản mềm'],
    allowedRoles: ['admin'],
    allowsService: false,
  },
  print: {
    validFromStatuses: ['Chờ in'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
    appliesToPhysicalOnly: true,
  },
  sign: {
    validFromStatuses: ['Đang chờ ký'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
    appliesToPhysicalOnly: true,
  },
  assign_waybill: {
    validFromStatuses: ['Chờ tạo vận đơn'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
    appliesToPhysicalOnly: true,
  },
  confirm_pickup: {
    validFromStatuses: ['Chờ shipper đến lấy'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: true,
    appliesToPhysicalOnly: true,
  },
  confirm_delivery: {
    validFromStatuses: ['Đang giao'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: true,
    appliesToPhysicalOnly: true,
  },
  upload_scan: {
    validFromStatuses: [
      'Chờ bản gửi lại',
      'Chờ in',
      'Đang chờ ký',
      'Chờ tạo vận đơn',
      'Chờ shipper đến lấy',
      'Đang giao',
    ],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
  },
  archive: {
    validFromStatuses: ['Chờ bản gửi lại'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
  },
  reject: {
    validFromStatuses: ['Đang chờ ký'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
    requiresNote: true,
  },
  report_issue: {
    validFromStatuses: ['Chờ shipper đến lấy', 'Đang giao'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: true,
    requiresNote: true,
  },
  redraft: {
    validFromStatuses: ['Bị từ chối ký'],
    allowedRoles: ['legal', 'admin'],
    allowsService: false,
    requiresNote: true,
  },
  reship: {
    validFromStatuses: ['Sự cố vận chuyển'],
    allowedRoles: ['clerk', 'admin'],
    allowsService: false,
    requiresNote: true,
  },
  cancel: {
    validFromStatuses: [
      'Chờ soạn thảo',
      'Chờ duyệt bản mềm',
      'Chờ in',
      'Đang chờ ký',
      'Chờ tạo vận đơn',
      'Chờ shipper đến lấy',
      'Đang giao',
      'Chờ bản gửi lại',
      'Bị từ chối ký',
      'Sự cố vận chuyển',
    ],
    allowedRoles: ['admin'],
    allowsService: false,
    requiresNote: true,
  },
};

export class WorkflowGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'WorkflowGuardError';
  }
}

export function validateActionGuard(
  contract: ContractWorkflowSubject,
  action: WorkflowAction,
  actor: Actor,
  payload?: {
    note?: string;
    waybillCode?: string;
    hasFileOrLink?: boolean;
    hasScanFile?: boolean;
  }
): void {
  const rule = ACTION_RULES[action];
  if (!rule) {
    throw new WorkflowGuardError('UNKNOWN_ACTION', `Hành động ${action} không xác định.`);
  }

  // 1. Check current status
  if (!rule.validFromStatuses.includes(contract.status)) {
    throw new WorkflowGuardError(
      'INVALID_STATUS_TRANSITION',
      `Không thể thực hiện "${action}" khi hợp đồng đang ở trạng thái "${contract.status}".`
    );
  }

  // 2. Check processing method
  if (rule.appliesToPhysicalOnly && contract.processingMethod === 'digital') {
    throw new WorkflowGuardError(
      'METHOD_MISMATCH',
      `Hành động "${action}" chỉ áp dụng cho quy trình vật lý, không áp dụng cho quy trình số hóa (digital).`
    );
  }

  // 3. Check actor role
  if (actor.kind === 'service') {
    if (!rule.allowsService) {
      throw new WorkflowGuardError(
        'SERVICE_NOT_ALLOWED',
        `Dịch vụ nền không có quyền thực hiện hành động "${action}".`
      );
    }
  } else {
    if (!rule.allowedRoles.includes(actor.role)) {
      throw new WorkflowGuardError(
        'FORBIDDEN_ROLE',
        `Vai trò "${actor.role}" không có quyền thực hiện hành động "${action}".`
      );
    }
  }

  // 4. Check payload requirements
  if (rule.requiresNote && (!payload?.note || payload.note.trim() === '')) {
    throw new WorkflowGuardError(
      'MISSING_REQUIRED_NOTE',
      `Hành động "${action}" bắt buộc phải có ghi chú / lý do.`
    );
  }

  if (action === 'submit_draft' && payload?.hasFileOrLink === false) {
    throw new WorkflowGuardError(
      'MISSING_DRAFT_CONTENT',
      'Nộp bản thảo yêu cầu đính kèm file DOCX hoặc đường link Google Docs.'
    );
  }

  if (action === 'assign_waybill' && (!payload?.waybillCode || payload.waybillCode.trim() === '')) {
    throw new WorkflowGuardError(
      'MISSING_WAYBILL_CODE',
      'Gán vận đơn bắt buộc phải có mã vận đơn.'
    );
  }

  if (action === 'archive') {
    const hasScan = payload?.hasScanFile ?? contract.hasScanFile;
    if (contract.processingMethod === 'digital' && !hasScan) {
      throw new WorkflowGuardError(
        'MISSING_SIGNED_SCAN',
        'Hợp đồng số hóa bắt buộc phải có file scan đã ký trước khi hoàn tất lưu trữ.'
      );
    }
  }
}

export function computeAllowedActions(
  contract: ContractWorkflowSubject,
  actor: Actor
): WorkflowAction[] {
  const allowed: WorkflowAction[] = [];

  for (const [actionName, rule] of Object.entries(ACTION_RULES) as [WorkflowAction, ActionRequirement][]) {
    // Status check
    if (!rule.validFromStatuses.includes(contract.status)) continue;

    // Method check
    if (rule.appliesToPhysicalOnly && contract.processingMethod === 'digital') continue;

    // Actor check
    if (actor.kind === 'service') {
      if (!rule.allowsService) continue;
    } else {
      if (!rule.allowedRoles.includes(actor.role)) continue;
    }

    allowed.push(actionName);
  }

  return allowed;
}

