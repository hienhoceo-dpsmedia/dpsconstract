import type { ContractStatus } from '../../../src/shared/contracts.js';
import type { WorkflowAction } from '../../domain/types.js';

export const WORKFLOW_ACTIONS: readonly WorkflowAction[] = [
  'submit_draft',
  'feedback_draft',
  'approve_soft_copy',
  'print',
  'sign',
  'assign_waybill',
  'confirm_pickup',
  'confirm_delivery',
  'upload_scan',
  'archive',
  'reject',
  'report_issue',
  'redraft',
  'reship',
  'cancel',
] as const;

export type TransitionResult = {
  targetStatus: ContractStatus | null; // null if status remains the same (e.g. upload_scan)
  requiresNote: boolean;
};

export const ACTION_TARGET_MAP: Record<
  WorkflowAction,
  (params: { processingMethod: 'physical' | 'digital' }) => ContractStatus | null
> = {
  submit_draft: () => 'Chờ duyệt bản mềm',
  feedback_draft: () => 'Chờ soạn thảo',
  approve_soft_copy: ({ processingMethod }) =>
    processingMethod === 'digital' ? 'Chờ bản gửi lại' : 'Chờ in',
  print: () => 'Đang chờ ký',
  sign: () => 'Chờ tạo vận đơn',
  assign_waybill: () => 'Chờ shipper đến lấy',
  confirm_pickup: () => 'Đang giao',
  confirm_delivery: () => 'Chờ bản gửi lại',
  upload_scan: () => null, // Giữ nguyên trạng thái, chỉ gắn file scan
  archive: () => 'Hoàn tất',
  reject: () => 'Bị từ chối ký',
  report_issue: () => 'Sự cố vận chuyển',
  redraft: () => 'Chờ duyệt bản mềm',
  reship: () => 'Chờ tạo vận đơn',
  cancel: () => 'Đã hủy',
};

