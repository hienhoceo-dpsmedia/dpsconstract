export * from './shared/contracts.js';

export interface User {
  id?: string;
  email: string;
  name?: string | null;
  role: 'legal' | 'clerk' | 'admin';
  invitedAt?: string;
  status?: 'active' | 'invited' | 'disabled';
}

export interface ContractFile {
  id: string;
  name: string;
  type: 'original' | 'scan' | 'attachment';
  uploadedBy: string;
  uploadedAt: string;
  size: number;
  mimeType: string;
}

export interface AuditLog {
  id: string;
  contractId: string;
  fromStatus: string | null;
  toStatus: string;
  updatedBy: string;
  updatedAt: string;
  note: string;
}

export interface Contract {
  id: string;
  name: string;
  contractNumber: string;
  partnerName: string;
  value: string;
  signDate: string;
  effectiveDate: string;
  status: 'Chờ soạn thảo' | 'Chờ duyệt bản mềm' | 'Chờ in' | 'Đang chờ ký' | 'Chờ tạo vận đơn' | 'Chờ shipper đến lấy' | 'Đang giao' | 'Chờ bản gửi lại' | 'Hoàn tất' | 'Bị từ chối ký' | 'Sự cố vận chuyển' | 'Đã hủy';
  waybillCode: string;
  vtpStatusHistory: Array<{ status: string; updatedAt: string; note: string }>;
  files: ContractFile[];
  auditLog: AuditLog[];
  uploaded_at: string;
  soft_approved_at?: string | null;
  printed_at: string | null;
  signed_at: string | null;
  waybill_created_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  received_back_at: string | null;
  archived_at: string | null;
  slaBreached: boolean;
  slaBreachType: 'internal' | 'viettelpost' | null;
  lastActivityAt: string;
  googleDocsLink?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  deliveryNotes?: string;
  processingMethod?: 'physical' | 'digital';
  printCopies?: number;
  physical_notes?: string;
  physical_step_history?: Array<{ at: string; by: string; step: string; note: string }>;

  // Drafting Request & Legal Payroll Evaluation fields
  requested_by?: string;
  assigned_to?: string;
  requested_at?: string | null;
  deadline?: string | null;
  draft_submitted_at?: string | null;
  base_pay?: number;
  urgency_level?: 'normal' | 'priority' | 'urgent' | 'emergency';
  urgency_coef?: number;
  feedback_count?: number;
  feedback_history?: Array<{ at: string; by: string; note: string }>;
  is_punctual?: boolean | null;
  punctual_coef?: number;
  quality_coef?: number;
  calculated_payroll?: number;
  drafting_instructions?: string;
}

export interface SettingsState {
  slaInternalHours: number;
  slaViettelPostDays: number;
  defaultBasePayLegal?: number;
  defaultBasePayClerk?: number;
  slaPrintingHours?: number;
  slaCourierHours?: number;
  slaRetrievalDays?: number;

  // SLA & Quality Rate Customization (percent integer: e.g. 10 = +10%, -10 = -10%)
  slaEarlyMaxRate?: number; // Sớm nhiều (default: 30)
  slaEarlyMidRate?: number; // Sớm vừa (default: 20)
  slaEarlyMinRate?: number; // Sớm ít (default: 10)
  slaOnTimeRate?: number;   // Đúng SLA (default: 0)
  slaLateMinRate?: number;  // Trễ ít (default: -10)
  slaLateMidRate?: number;  // Trễ vừa (default: -20)
  slaLateMaxRate?: number;  // Trễ nhiều (default: -30)

  // SLA Threshold Time Criteria Customization
  slaEarlyMaxTimePct?: number; // % tiết kiệm để tính Sớm nhiều (default: 50)
  slaEarlyMidTimePct?: number; // % tiết kiệm để tính Sớm vừa (default: 25)
  slaEarlyMinTimePct?: number; // % tiết kiệm để tính Sớm ít (default: 5)
  slaLateMinHours?: number;    // Hạn giờ trễ ít (default: 2)
  slaLateMidHours?: number;    // Hạn giờ trễ vừa (default: 6)

  feedback0Rate?: number;   // 0 feedback (default: 0)
  feedback1Rate?: number;   // 1 feedback (default: -10)
  feedback2Rate?: number;   // 2 feedback (default: -20)
  feedback3Rate?: number;   // 3+ feedback (default: -30)

  teamsWebhookUrl: string;
  teamsPayloadTemplate: string;
  aiExtractEndpoint: string;
  aiExtractPayloadTemplate: string;
  googleDriveFolderId: string;
  users: User[];
  vtpConnectionStatus?: 'connected' | 'disconnected';
}

export interface SimLog {
  id: string;
  type: 'teams' | 'drive' | 'ai' | 'sla' | 'system';
  title: string;
  content: string;
  timestamp: string;
}

export interface ReportsData {
  statusCounts: Record<string, number>;
  averages: {
    avgUploadToPrintHours: number;
    avgPrintToSignHours: number;
    avgTotalCycleHours: number;
  };
  overdueContracts: Contract[];
}
