import type { ContractStatus, ContractSummary, SafeContractFile } from '../../../src/shared/contracts.js';

export function calculateAllowedActions(status: ContractStatus, role?: string): string[] {
  const actions: string[] = [];

  switch (status) {
    case 'Chờ soạn thảo':
      if (role === 'legal' || role === 'admin') actions.push('submit_draft');
      break;
    case 'Chờ duyệt bản mềm':
      if (role === 'admin') actions.push('approve_soft_copy', 'feedback_draft');
      break;
    case 'Chờ in':
      if (role === 'clerk' || role === 'admin') actions.push('print');
      break;
    case 'Đang chờ ký':
      if (role === 'clerk' || role === 'admin') actions.push('sign');
      break;
    case 'Chờ tạo vận đơn':
      if (role === 'clerk' || role === 'admin') actions.push('assign_waybill');
      break;
    case 'Chờ shipper đến lấy':
      if (role === 'clerk' || role === 'admin') actions.push('confirm_pickup');
      break;
    case 'Đang giao':
      if (role === 'clerk' || role === 'admin') actions.push('confirm_delivery', 'report_issue');
      break;
    case 'Chờ bản gửi lại':
      if (role === 'clerk' || role === 'admin') actions.push('upload_scan', 'reject');
      break;
    case 'Bị từ chối ký':
      if (role === 'legal' || role === 'admin') actions.push('redraft');
      break;
    case 'Sự cố vận chuyển':
      if (role === 'clerk' || role === 'admin') actions.push('reship');
      break;
    case 'Hoàn tất':
      actions.push('archive');
      break;
  }

  if (role === 'admin' && status !== 'Đã hủy' && status !== 'Hoàn tất') {
    actions.push('cancel');
  }

  return actions;
}

export function toContractSummary(
  row: Record<string, unknown>,
  context: { role?: string; userId?: string } = {}
): ContractSummary {
  const status = (row.status as ContractStatus) || 'Chờ soạn thảo';
  const allowedActions = calculateAllowedActions(status, context.role);

  return {
    id: String(row.id),
    contractNumber: String(row.contractNumber || row.contract_number),
    name: String(row.name),
    partnerName: String(row.partnerName || row.partner_name),
    value: String(row.valueText || row.value_text || row.value || '0 VND'),
    status,
    version: Number(row.version || 1),
    processingMethod: (row.processingMethod || row.processing_method || 'physical') as 'physical' | 'digital',
    uploaded_at: row.uploadedAt ? new Date(row.uploadedAt as string | Date).toISOString() : new Date().toISOString(),
    slaBreached: Boolean(row.slaBreached ?? row.sla_breached),
    slaBreachType: (row.slaBreachType || row.sla_breach_type || null) as 'internal' | 'viettelpost' | null,
    assigned_to: row.legalAssigneeId ? String(row.legalAssigneeId) : undefined,
    requested_by: row.createdBy ? String(row.createdBy) : undefined,
    clerk_assignee: row.clerkAssigneeId ? String(row.clerkAssigneeId) : undefined,
    allowedActions,
  };
}

export function toContractDetail(
  row: Record<string, unknown>,
  files: Array<Record<string, unknown>> = [],
  context: { role?: string; userId?: string } = {}
) {
  const summary = toContractSummary(row, context);

  const safeFiles: SafeContractFile[] = files.map((f) => ({
    id: String(f.id),
    name: String(f.name),
    type: (f.type as 'original' | 'scan' | 'attachment') || 'original',
    uploadedBy: String(f.uploadedBy || f.uploaded_by || ''),
    uploadedAt: f.uploadedAt ? new Date(f.uploadedAt as string | Date).toISOString() : new Date().toISOString(),
    size: Number(f.size || 0),
    mimeType: String(f.mimeType || f.detectedMime || f.detected_mime || 'application/octet-stream'),
  }));

  return {
    ...summary,
    files: safeFiles,
    googleDocsLink: row.googleDocsLink || row.google_docs_link ? String(row.googleDocsLink || row.google_docs_link) : undefined,
    receiverName: row.receiverName || row.receiver_name ? String(row.receiverName || row.receiver_name) : undefined,
    receiverPhone: row.receiverPhone || row.receiver_phone ? String(row.receiverPhone || row.receiver_phone) : undefined,
    receiverAddress: row.receiverAddress || row.receiver_address ? String(row.receiverAddress || row.receiver_address) : undefined,
    deliveryNotes: row.deliveryNotes || row.delivery_notes ? String(row.deliveryNotes || row.delivery_notes) : undefined,
    printCopies: Number(row.printCopies || row.print_copies || 1),
    draftingInstructions: row.draftingInstructions || row.drafting_instructions ? String(row.draftingInstructions || row.drafting_instructions) : undefined,
    waybillCode: row.waybillCode || row.waybill_code ? String(row.waybillCode || row.waybill_code) : '',
    soft_approved_at: row.softApprovedAt ? new Date(row.softApprovedAt as string | Date).toISOString() : null,
    printed_at: row.printedAt ? new Date(row.printedAt as string | Date).toISOString() : null,
    signed_at: row.signedAt ? new Date(row.signedAt as string | Date).toISOString() : null,
    waybill_created_at: row.waybillCreatedAt ? new Date(row.waybillCreatedAt as string | Date).toISOString() : null,
    picked_up_at: row.pickedUpAt ? new Date(row.pickedUpAt as string | Date).toISOString() : null,
    delivered_at: row.deliveredAt ? new Date(row.deliveredAt as string | Date).toISOString() : null,
    received_back_at: row.receivedBackAt ? new Date(row.receivedBackAt as string | Date).toISOString() : null,
    archived_at: row.archivedAt ? new Date(row.archivedAt as string | Date).toISOString() : null,
  };
}

