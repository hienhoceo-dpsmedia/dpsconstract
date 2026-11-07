export type Role = 'admin' | 'legal' | 'clerk';

export const CONTRACT_STATUSES = [
  'Chờ soạn thảo',
  'Chờ duyệt bản mềm',
  'Chờ in',
  'Đang chờ ký',
  'Chờ tạo vận đơn',
  'Chờ shipper đến lấy',
  'Đang giao',
  'Chờ bản gửi lại',
  'Hoàn tất',
  'Bị từ chối ký',
  'Sự cố vận chuyển',
  'Đã hủy',
] as const;

export type ContractStatus = typeof CONTRACT_STATUSES[number];

export interface SafeUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
  status: 'invited' | 'active' | 'disabled';
}

export interface SafeContractFile {
  id: string;
  name: string;
  type: 'original' | 'scan' | 'attachment';
  uploadedBy: string;
  uploadedAt: string;
  size: number;
  mimeType: string;
}

export interface ContractSummary {
  id: string;
  contractNumber: string;
  name: string;
  partnerName: string;
  value: string;
  status: ContractStatus;
  version: number;
  processingMethod: 'physical' | 'digital';
  uploaded_at: string;
  slaBreached: boolean;
  slaBreachType: 'internal' | 'viettelpost' | null;
  assigned_to?: string;
  requested_by?: string;
  clerk_assignee?: string;
  allowedActions: string[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContractPage extends Page<ContractSummary> {
  statusCounts: Record<ContractStatus, number>;
}

