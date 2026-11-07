import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories configuration
const DATA_DIR = path.resolve('data');
const CONTRACTS_DIR = path.join(DATA_DIR, 'contracts');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CONTRACTS_DIR)) {
  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
}

// Interfaces
interface User {
  email: string;
  role: 'legal' | 'clerk' | 'admin';
  invitedAt: string;
}

interface Settings {
  slaInternalHours: number;
  slaViettelPostDays: number;
  teamsWebhookUrl: string;
  teamsPayloadTemplate: string;
  aiExtractEndpoint: string;
  aiExtractPayloadTemplate: string;
  googleDriveFolderId: string;
  users: User[];
  vtpConnectionStatus: 'connected' | 'disconnected';
  defaultBasePayLegal?: number;
  defaultBasePayClerk?: number;
}

interface AuditLog {
  id: string;
  contractId: string;
  fromStatus: string | null;
  toStatus: string;
  updatedBy: string;
  updatedAt: string;
  note: string;
}

interface ContractFile {
  id: string;
  name: string;
  type: 'original' | 'scan' | 'attachment';
  uploadedBy: string;
  uploadedAt: string;
  size: number;
  mimeType: string;
  filePath: string;
}

interface Contract {
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
  shipped_at?: string | null;
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

interface SimLog {
  id: string;
  type: 'teams' | 'drive' | 'ai' | 'sla' | 'system';
  title: string;
  content: string;
  timestamp: string;
}

// Initial Database Seeding
const defaultSettings: Settings = {
  slaInternalHours: 2,
  slaViettelPostDays: 3,
  teamsWebhookUrl: 'https://outlook.office.com/webhook/example-teams-channel-for-contracts',
  teamsPayloadTemplate: '{\n  "title": "{{title}}",\n  "text": "{{text}}",\n  "contractId": "{{contractId}}",\n  "status": "{{status}}",\n  "timestamp": "{{timestamp}}"\n}',
  aiExtractEndpoint: '',
  aiExtractPayloadTemplate: '{\n  "text": "{{text}}",\n  "mimeType": "{{mimeType}}"\n}',
  googleDriveFolderId: 'root/contracts_backup_folder',
  users: [
    { email: 'tankhoi.agribank@gmail.com', role: 'admin', invitedAt: new Date().toISOString() },
    { email: 'legal@test.com', role: 'legal', invitedAt: new Date().toISOString() },
    { email: 'clerk@test.com', role: 'clerk', invitedAt: new Date().toISOString() }
  ],
  vtpConnectionStatus: 'connected'
};

const MOCK_RECEIVERS = [
  { name: 'Nguyễn Minh Anh', phone: '0981234567', addr: 'Tòa nhà Viettel, 285 Cách Mạng Tháng Tám, Quận 10, TP. Hồ Chí Minh' },
  { name: 'Trần Thanh Hải', phone: '0913987654', addr: 'Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội' },
  { name: 'Phạm Đức Long', phone: '0975654321', addr: '123 Trần Hưng Đạo, Quận 1, TP. Hồ Chí Minh' },
  { name: 'Hoàng Lan Phương', phone: '0904321098', addr: '78 Láng Hạ, Quận Đống Đa, Hà Nội' },
  { name: 'Đặng Quốc Bảo', phone: '0389876543', addr: '85 Nguyễn Du, Quận Hai Bà Trưng, Hà Nội' },
  { name: 'Phan Minh Tuấn', phone: '0354123987', addr: '45 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh' },
  { name: 'Vũ Thị Hồng Nhung', phone: '0932154876', addr: 'Tòa nhà VNPT, 57 Huỳnh Thúc Kháng, Đống Đa, Hà Nội' },
  { name: 'Lê Văn Nam', phone: '0967384920', addr: 'Số 10 Trần Phú, Quận Hà Đông, Hà Nội' },
  { name: 'Bùi Thị Tuyết', phone: '0988776655', addr: '256 Lê Lợi, Ngô Quyền, Hải Phòng' },
  { name: 'Trịnh Đình Quang', phone: '0912112233', addr: '512 Điện Biên Phủ, Quận Thanh Khê, Đà Nẵng' }
];

function getMockReceiver(index: number) {
  return MOCK_RECEIVERS[index % MOCK_RECEIVERS.length];
}

function generateSeedContracts(): Contract[] {
  const seed: Contract[] = [];
  const now = new Date();

  const getPastTime = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
  const getPastDaysTime = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  // 1. Chờ in - BỊ TRỄ SLA NỘI BỘ (lastActivityAt là 5 giờ trước > SLA nội bộ 2 giờ)
  seed.push({
    id: 'con_seed_01',
    name: 'Hợp đồng Thuê Thiết bị Máy chủ Cloud Agribank',
    contractNumber: 'HD-2026-CLD01',
    partnerName: 'Công ty Cổ phần Công nghệ Viettel',
    value: '840,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ duyệt bản mềm',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f1', name: 'Hop_Dong_Thue_Cloud_Viettel_signed.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(5), size: 1048576, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/Hop_Dong_Thue_Cloud_Viettel_signed.docx' }],
    auditLog: [{ id: 'a1', contractId: 'con_seed_01', fromStatus: null, toStatus: 'Chờ duyệt bản mềm', updatedBy: 'legal@test.com', updatedAt: getPastTime(5), note: 'Pháp chế khởi tạo hợp đồng và tải lên file gốc .docx' }],
    uploaded_at: getPastTime(5),
    printed_at: null,
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: true,
    slaBreachType: 'internal',
    lastActivityAt: getPastTime(5)
  });

  // 2. Chờ in - Bình thường an toàn (1 giờ trước)
  seed.push({
    id: 'con_seed_02',
    name: 'Hợp đồng Cung cấp Dịch vụ Bảo trì Phần mềm CoreBanking',
    contractNumber: 'HD-2026-CORE01',
    partnerName: 'Công ty TNHH Giải pháp Phần mềm FPT',
    value: '1,200,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ in',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f2', name: 'HD_Bao_Tri_FPT_Core_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(1), size: 1205312, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Bao_Tri_FPT_Core_2026.docx' }],
    auditLog: [{ id: 'a2', contractId: 'con_seed_02', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(1), note: 'Pháp chế tải lên hợp đồng gốc.' }],
    uploaded_at: getPastTime(1),
    printed_at: null,
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(1)
  });

  // 3. Đang chờ ký (Trình sếp) - BỊ TRỄ SLA NỘI BỘ (lastActivityAt là 6 giờ trước)
  seed.push({
    id: 'con_seed_03',
    name: 'Hợp đồng Tài trợ Độc quyền Giải chạy Marathon Agribank',
    contractNumber: 'HD-2026-MRA05',
    partnerName: 'Công ty Cổ phần Sự kiện Agribank Land',
    value: '350,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đang chờ ký',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f3', name: 'HD_Tai_Tro_Marathon_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(8), size: 852100, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Tai_Tro_Marathon_2026.docx' }],
    auditLog: [
      { id: 'a3_1', contractId: 'con_seed_03', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(8), note: 'Pháp chế tải lên hợp đồng.' },
      { id: 'a3_2', contractId: 'con_seed_03', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(6), note: 'Văn thư xác nhận đã in xong bản thảo giấy và trình ký Ban Giám đốc.' }
    ],
    uploaded_at: getPastTime(8),
    printed_at: getPastTime(6),
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: true,
    slaBreachType: 'internal',
    lastActivityAt: getPastTime(6)
  });

  // 4. Đang chờ ký - Bình thường an toàn (30 phút trước)
  seed.push({
    id: 'con_seed_04',
    name: 'Hợp đồng Thuê Đường truyền Internet Kênh thuê riêng Leased Line',
    contractNumber: 'HD-2026-NET02',
    partnerName: 'Tổng Công ty Viễn thông VNPT',
    value: '220,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đang chờ ký',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f4', name: 'HD_Thue_Internet_VNPT_LeasedLine.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(1.5), size: 541020, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Thue_Internet_VNPT_LeasedLine.docx' }],
    auditLog: [
      { id: 'a4_1', contractId: 'con_seed_04', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(1.5), note: 'Khởi tạo.' },
      { id: 'a4_2', contractId: 'con_seed_04', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(0.5), note: 'In xong bản cứng trình Sếp.' }
    ],
    uploaded_at: getPastTime(1.5),
    printed_at: getPastTime(0.5),
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(0.5)
  });

  // 5. Chờ tạo vận đơn - BỊ TRỄ SLA NỘI BỘ (lastActivityAt là 4 giờ trước)
  seed.push({
    id: 'con_seed_05',
    name: 'Hợp đồng Tư vấn Thẩm định Tài sản Dự án Agribank Tower',
    contractNumber: 'HD-2026-VAL01',
    partnerName: 'Công ty Cổ phần Định giá và Kiểm toán Việt Nam',
    value: '450,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ tạo vận đơn',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f5', name: 'HD_Tu_Van_Tham_Dinh_Tower_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(10), size: 911024, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Tu_Van_Tham_Dinh_Tower_2026.docx' }],
    auditLog: [
      { id: 'a5_1', contractId: 'con_seed_05', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(10), note: 'Khởi tạo.' },
      { id: 'a5_2', contractId: 'con_seed_05', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(8), note: 'Đã in trình Sếp.' },
      { id: 'a5_3', contractId: 'con_seed_05', fromStatus: 'Đang chờ ký', toStatus: 'Chờ tạo vận đơn', updatedBy: 'clerk@test.com', updatedAt: getPastTime(4), note: 'Sếp đã ký tay đóng dấu vật lý. Chờ Văn thư tạo mã vận đơn gửi đi.' }
    ],
    uploaded_at: getPastTime(10),
    printed_at: getPastTime(8),
    signed_at: getPastTime(4),
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: true,
    slaBreachType: 'internal',
    lastActivityAt: getPastTime(4)
  });

  // 6. Chờ tạo vận đơn - Bình thường an toàn (20 phút trước)
  seed.push({
    id: 'con_seed_06',
    name: 'Hợp đồng Cung cấp Mực in và Văn phòng phẩm Năm 2026',
    contractNumber: 'HD-2026-VPP12',
    partnerName: 'Công ty Cổ phần Thương mại Hồng Hà',
    value: '95,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ tạo vận đơn',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f6', name: 'HD_Cung_Cap_Van_Phong_Pham_Hong_Ha.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(3), size: 312000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Cung_Cap_Van_Phong_Pham_Hong_Ha.docx' }],
    auditLog: [
      { id: 'a6_1', contractId: 'con_seed_06', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(3), note: 'Khởi tạo.' },
      { id: 'a6_2', contractId: 'con_seed_06', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(2), note: 'In xong bản cứng.' },
      { id: 'a6_3', contractId: 'con_seed_06', fromStatus: 'Đang chờ ký', toStatus: 'Chờ tạo vận đơn', updatedBy: 'clerk@test.com', updatedAt: getPastTime(0.3), note: 'Sếp đã ký xong.' }
    ],
    uploaded_at: getPastTime(3),
    printed_at: getPastTime(2),
    signed_at: getPastTime(0.3),
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(0.3)
  });

  // 7. Chờ shipper đến lấy (1 giờ trước)
  seed.push({
    id: 'con_seed_07',
    name: 'Hợp đồng Thiết kế Website Thương mại Điện tử Agribank Mall',
    contractNumber: 'HD-2026-WEB05',
    partnerName: 'Công ty TNHH Giải pháp Số Netco',
    value: '420,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ shipper đến lấy',
    waybillCode: 'VTP-SEED-9901',
    vtpStatusHistory: [],
    files: [{ id: 'f7', name: 'HD_Thiet_Ke_Web_Agribank_Mall.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(5), size: 760000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Thiet_Ke_Web_Agribank_Mall.docx' }],
    auditLog: [
      { id: 'a7_1', contractId: 'con_seed_07', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(5), note: 'Khởi tạo.' },
      { id: 'a7_2', contractId: 'con_seed_07', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(4), note: 'In hoàn thành.' },
      { id: 'a7_3', contractId: 'con_seed_07', fromStatus: 'Đang chờ ký', toStatus: 'Chờ tạo vận đơn', updatedBy: 'clerk@test.com', updatedAt: getPastTime(2), note: 'Sếp đã ký đóng dấu.' },
      { id: 'a7_4', contractId: 'con_seed_07', fromStatus: 'Chờ tạo vận đơn', toStatus: 'Chờ shipper đến lấy', updatedBy: 'clerk@test.com', updatedAt: getPastTime(1), note: 'Gán mã bưu gửi Viettel Post VTP-SEED-9901. Đang đợi shipper qua bốc hàng.' }
    ],
    uploaded_at: getPastTime(5),
    printed_at: getPastTime(4),
    signed_at: getPastTime(2),
    waybill_created_at: getPastTime(1),
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(1)
  });

  // 8. Đang giao (VTP) - BỊ TRỄ SLA VẬN CHUYỂN (lastActivityAt là 5 ngày trước > SLA VTP 3 ngày)
  seed.push({
    id: 'con_seed_08',
    name: 'Hợp đồng Cung cấp Điện lạnh và Điều hòa Trung tâm Chi nhánh Hải Phòng',
    contractNumber: 'HD-2026-AC03',
    partnerName: 'Công ty Cổ phần Cơ điện lạnh Daikin VN',
    value: '580,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đang giao',
    waybillCode: 'VTP-LATE-1102',
    vtpStatusHistory: [
      { status: 'PICKED_UP', updatedAt: getPastDaysTime(5), note: 'Bưu tá đã gom hàng thành công.' },
      { status: 'IN_TRANSIT', updatedAt: getPastDaysTime(4), note: 'Hàng rời kho phân loại trung tâm Hà Nội.' }
    ],
    files: [{ id: 'f8', name: 'HD_Dieu_Hoa_Daikin_Chi_Nhanh_HP.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(6), size: 1102400, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Dieu_Hoa_Daikin_Chi_Nhanh_HP.docx' }],
    auditLog: [
      { id: 'a8_1', contractId: 'con_seed_08', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(6), note: 'Khởi tạo.' },
      { id: 'a8_2', contractId: 'con_seed_08', fromStatus: 'Chờ in', toStatus: 'Chờ tạo vận đơn', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(5.8), note: 'Đã in ấn và trình ký thành công nhanh chóng.' },
      { id: 'a8_3', contractId: 'con_seed_08', fromStatus: 'Chờ tạo vận đơn', toStatus: 'Chờ shipper đến lấy', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(5.5), note: 'Gán mã bưu gửi VTP-LATE-1102.' },
      { id: 'a8_4', contractId: 'con_seed_08', fromStatus: 'Chờ shipper đến lấy', toStatus: 'Đang giao', updatedBy: 'Viettel Post Webhook', updatedAt: getPastDaysTime(5), note: 'Viettel Post xác nhận bưu tá đã lấy hàng, bắt đầu hành trình.' }
    ],
    uploaded_at: getPastDaysTime(6),
    printed_at: getPastDaysTime(5.9),
    signed_at: getPastDaysTime(5.8),
    waybill_created_at: getPastDaysTime(5.5),
    picked_up_at: getPastDaysTime(5),
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: true,
    slaBreachType: 'viettelpost',
    lastActivityAt: getPastDaysTime(5)
  });

  // 9. Đang giao (VTP) - Bình thường an toàn (1 ngày trước)
  seed.push({
    id: 'con_seed_09',
    name: 'Hợp đồng Tư vấn Thiết kế Kiến trúc Nội thất Agribank Cần Thơ',
    contractNumber: 'HD-2026-ARC12',
    partnerName: 'Công ty Cổ phần Thiết kế Không gian Đẹp',
    value: '270,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đang giao',
    waybillCode: 'VTP-OK-5510',
    vtpStatusHistory: [
      { status: 'PICKED_UP', updatedAt: getPastDaysTime(1), note: 'Bưu tá đã gom bưu phẩm.' }
    ],
    files: [{ id: 'f9', name: 'HD_Kien_Truc_Noi_That_CT.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(2), size: 681320, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Kien_Truc_Noi_That_CT.docx' }],
    auditLog: [
      { id: 'a9_1', contractId: 'con_seed_09', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(2), note: 'Tạo mới.' },
      { id: 'a9_2', contractId: 'con_seed_09', fromStatus: 'Chờ shipper đến lấy', toStatus: 'Đang giao', updatedBy: 'Viettel Post Webhook', updatedAt: getPastDaysTime(1), note: 'Bưu phẩm rời bưu cục gửi.' }
    ],
    uploaded_at: getPastDaysTime(2),
    printed_at: getPastDaysTime(1.8),
    signed_at: getPastDaysTime(1.7),
    waybill_created_at: getPastDaysTime(1.5),
    picked_up_at: getPastDaysTime(1),
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastDaysTime(1)
  });

  // 10. Chờ bản gửi lại - BỊ TRỄ SLA NỘI BỘ (Chờ bản gửi trả quá lâu, lastActivityAt là 10 giờ trước)
  seed.push({
    id: 'con_seed_10',
    name: 'Hợp đồng Hợp tác Đào tạo Nhân sự Công nghệ thông tin Chất lượng cao',
    contractNumber: 'HD-2026-EDU04',
    partnerName: 'Học viện Công nghệ Bưu chính Viễn thông PTIT',
    value: '450,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ bản gửi lại',
    waybillCode: 'VTP-RE-4402',
    vtpStatusHistory: [
      { status: 'DELIVERED', updatedAt: getPastTime(10), note: 'Đã phát thành công bưu phẩm đến đối tác.' }
    ],
    files: [{ id: 'f10', name: 'HD_Dao_Tao_CNTT_PTIT_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(20), size: 1024311, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Dao_Tao_CNTT_PTIT_2026.docx' }],
    auditLog: [
      { id: 'a10_1', contractId: 'con_seed_10', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(20), note: 'Khởi tạo.' },
      { id: 'a10_2', contractId: 'con_seed_10', fromStatus: 'Đang giao', toStatus: 'Chờ bản gửi lại', updatedBy: 'Viettel Post Webhook', updatedAt: getPastTime(10), note: 'Viettel Post báo phát thành công hợp đồng cứng tới PTIT. Đang đợi PTIT đóng dấu gửi trả.' }
    ],
    uploaded_at: getPastTime(20),
    printed_at: getPastTime(18),
    signed_at: getPastTime(17),
    waybill_created_at: getPastTime(16),
    picked_up_at: getPastTime(14),
    delivered_at: getPastTime(10),
    received_back_at: null,
    archived_at: null,
    slaBreached: true,
    slaBreachType: 'internal',
    lastActivityAt: getPastTime(10)
  });

  // 11. Chờ bản gửi lại - Bình thường an toàn (1 giờ trước)
  seed.push({
    id: 'con_seed_11',
    name: 'Hợp đồng Thu mua Nông sản Xuất khẩu Hợp tác xã Lâm Đồng',
    contractNumber: 'HD-2026-AGR02',
    partnerName: 'Hợp tác xã Nông nghiệp Lâm Đồng',
    value: '2,500,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Chờ bản gửi lại',
    waybillCode: 'VTP-RE-9988',
    vtpStatusHistory: [
      { status: 'DELIVERED', updatedAt: getPastTime(1), note: 'Phát hàng thành công.' }
    ],
    files: [{ id: 'f11', name: 'HD_Thu_Mua_Nong_San_Lam_Dong.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(5), size: 541200, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Thu_Mua_Nong_San_Lam_Dong.docx' }],
    auditLog: [
      { id: 'a11_1', contractId: 'con_seed_11', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(5), note: 'Khởi tạo.' },
      { id: 'a11_2', contractId: 'con_seed_11', fromStatus: 'Đang giao', toStatus: 'Chờ bản gửi lại', updatedBy: 'Viettel Post Webhook', updatedAt: getPastTime(1), note: 'Bưu phẩm giấy đã trao tay đại diện HTX Lâm Đồng.' }
    ],
    uploaded_at: getPastTime(5),
    printed_at: getPastTime(4.5),
    signed_at: getPastTime(4),
    waybill_created_at: getPastTime(3.5),
    picked_up_at: getPastTime(3),
    delivered_at: getPastTime(1),
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(1)
  });

  // 12. Hoàn tất - Đã lưu kho lưu Drive (2 ngày trước)
  seed.push({
    id: 'con_seed_12',
    name: 'Hợp đồng Cung cấp Hệ thống Camera Giám sát Toàn văn phòng',
    contractNumber: 'HD-2026-CAM33',
    partnerName: 'Công ty Cổ phần Camera Số thông minh Việt Nam',
    value: '185,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Hoàn tất',
    waybillCode: 'VTP-DONE-1234',
    vtpStatusHistory: [
      { status: 'DELIVERED', updatedAt: getPastDaysTime(3), note: 'Giao hàng thành công bưu phẩm.' }
    ],
    files: [
      { id: 'f12_org', name: 'HD_He_Thong_Camera_Cam33_org.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(5), size: 984120, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_He_Thong_Camera_Cam33_org.docx' },
      { id: 'f12_scan', name: 'HD_He_Thong_Camera_Cam33_scanned.pdf', type: 'scan', uploadedBy: 'clerk@test.com', uploadedAt: getPastDaysTime(2), size: 2450110, mimeType: 'application/pdf', filePath: 'data/contracts/HD_He_Thong_Camera_Cam33_scanned.pdf' }
    ],
    auditLog: [
      { id: 'a12_1', contractId: 'con_seed_12', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(5), note: 'Tạo mới hợp đồng.' },
      { id: 'a12_2', contractId: 'con_seed_12', fromStatus: 'Chờ bản gửi lại', toStatus: 'Chờ bản gửi lại', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(2.1), note: 'Văn thư tiếp nhận bản gốc từ đối tác ký gửi lại, scan số hóa thành công.' },
      { id: 'a12_3', contractId: 'con_seed_12', fromStatus: 'Chờ bản gửi lại', toStatus: 'Hoàn tất', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(2), note: 'Hồ sơ đã được lưu kho vật lý kệ A-12 và đồng bộ lưu trữ an toàn Google Drive. Kết thúc vòng đời.' }
    ],
    uploaded_at: getPastDaysTime(5),
    printed_at: getPastDaysTime(4.8),
    signed_at: getPastDaysTime(4.7),
    waybill_created_at: getPastDaysTime(4.5),
    picked_up_at: getPastDaysTime(4.2),
    delivered_at: getPastDaysTime(3),
    received_back_at: getPastDaysTime(2.1),
    archived_at: getPastDaysTime(2),
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastDaysTime(2)
  });

  // 13. Luồng ngược/lỗi: Bị từ chối ký
  seed.push({
    id: 'con_seed_13',
    name: 'Hợp đồng Thuê Thiết bị Phân tích Mạng viễn thông Cao cấp',
    contractNumber: 'HD-2026-NET09',
    partnerName: 'Công ty Cổ phần Giải pháp Mạng NetViet',
    value: '310,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Bị từ chối ký',
    waybillCode: 'VTP-REJ-9011',
    vtpStatusHistory: [
      { status: 'DELIVERED', updatedAt: getPastTime(12), note: 'Đã giao thành công hợp đồng cứng cho đối tác.' },
      { status: 'REJECTED_BY_PARTNER', updatedAt: getPastTime(8), note: 'Đối tác từ chối ký duyệt bưu phẩm và trả lại do sai lệch điều khoản thanh toán tại Mục 5.2.' }
    ],
    files: [{ id: 'f13', name: 'HD_Thue_Thiet_Bi_Analytic_NetViet.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(24), size: 412000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Thue_Thiet_Bi_Analytic_NetViet.docx' }],
    auditLog: [
      { id: 'a13_1', contractId: 'con_seed_13', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(24), note: 'Khởi tạo.' },
      { id: 'a13_2', contractId: 'con_seed_13', fromStatus: 'Chờ bản gửi lại', toStatus: 'Bị từ chối ký', updatedBy: 'legal@test.com', updatedAt: getPastTime(8), note: 'LỖI NGHIỆP VỤ: Đối tác gọi điện từ chối ký do bất đồng điều khoản thanh toán ở Mục 5.2. Chuyển trạng thái về Bị từ chối để Pháp chế cập nhật đàm phán lại.' }
    ],
    uploaded_at: getPastTime(24),
    printed_at: getPastTime(22),
    signed_at: getPastTime(21),
    waybill_created_at: getPastTime(20),
    picked_up_at: getPastTime(18),
    delivered_at: getPastTime(12),
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(8)
  });

  // 14. Luồng ngược/lỗi: Sự cố vận chuyển
  seed.push({
    id: 'con_seed_14',
    name: 'Hợp đồng Cung cấp Dịch vụ Bảo vệ Chuyên nghiệp Chi nhánh Tây Hà Nội',
    contractNumber: 'HD-2026-SEC04',
    partnerName: 'Công ty Cổ phần Dịch vụ Bảo vệ An ninh Toàn Cầu',
    value: '180,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Sự cố vận chuyển',
    waybillCode: 'VTP-LOST-7788',
    vtpStatusHistory: [
      { status: 'PICKED_UP', updatedAt: getPastDaysTime(4), note: 'Đã nhận hàng gom.' },
      { status: 'SHIPPING_ISSUE', updatedAt: getPastDaysTime(2), note: 'Bưu phẩm bị ướt hỏng hoàn toàn dọc đường do tai nạn mưa bão bùng khi vận chuyển.' }
    ],
    files: [{ id: 'f14', name: 'HD_Bao_Ve_Chi_Nhanh_TayHN.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(5), size: 310500, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Bao_Ve_Chi_Nhanh_TayHN.docx' }],
    auditLog: [
      { id: 'a14_1', contractId: 'con_seed_14', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(5), note: 'Tạo mới.' },
      { id: 'a14_2', contractId: 'con_seed_14', fromStatus: 'Đang giao', toStatus: 'Sự cố vận chuyển', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(2), note: 'SỰ CỐ VẬN CHUYỂN: Viettel Post phản hồi bưu phẩm bị ướt rách hỏng hoàn toàn dọc đường do tai nạn mưa bão. Cần văn thư in lại bản cứng trình Sếp ký lại bưu gửi khác.' }
    ],
    uploaded_at: getPastDaysTime(5),
    printed_at: getPastDaysTime(4.8),
    signed_at: getPastDaysTime(4.7),
    waybill_created_at: getPastDaysTime(4.5),
    picked_up_at: getPastDaysTime(4),
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastDaysTime(2)
  });

  // 15. Luồng ngược/lỗi: Đã hủy
  seed.push({
    id: 'con_seed_15',
    name: 'Hợp đồng Thiết kế Thi công Biển hiệu Quảng cáo Chi nhánh Nam Hà Nội',
    contractNumber: 'HD-2026-ADV01',
    partnerName: 'Công ty TNHH Mỹ thuật và Truyền thông Hà Nội',
    value: '65,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đã hủy',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f15', name: 'HD_Quang_Cao_Bien_Hieu_NamHN.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(10), size: 280000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Quang_Cao_Bien_Hieu_NamHN.docx' }],
    auditLog: [
      { id: 'a15_1', contractId: 'con_seed_15', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(10), note: 'Khởi tạo.' },
      { id: 'a15_2', contractId: 'con_seed_15', fromStatus: 'Chờ in', toStatus: 'Đã hủy', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(9), note: 'HỦY HỒ SƠ: Sếp chỉ đạo hủy thầu dự án thi công biển quảng cáo do thay đổi ngân sách và kế hoạch của chi nhánh mới. Dừng khâu in ấn.' }
    ],
    uploaded_at: getPastDaysTime(10),
    printed_at: null,
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastDaysTime(9)
  });

  // 16. Trùng đối tác Agribank Land - HĐ 1
  seed.push({
    id: 'con_seed_16',
    name: 'Hợp đồng Tổ chức Chuỗi Hội thảo Phát triển Nguồn vốn Số',
    contractNumber: 'HD-2026-MRA06',
    partnerName: 'Công ty Cổ phần Sự kiện Agribank Land',
    value: '520,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Hoàn tất',
    waybillCode: 'VTP-SEED-1616',
    vtpStatusHistory: [{ status: 'DELIVERED', updatedAt: getPastDaysTime(4), note: 'Phát hàng thành công.' }],
    files: [
      { id: 'f16_org', name: 'HD_Hoi_Thao_Von_So_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastDaysTime(10), size: 620000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Hoi_Thao_Von_So_2026.docx' },
      { id: 'f16_scan', name: 'HD_Hoi_Thao_Von_So_scanned.pdf', type: 'scan', uploadedBy: 'clerk@test.com', uploadedAt: getPastDaysTime(3), size: 1890200, mimeType: 'application/pdf', filePath: 'data/contracts/HD_Hoi_Thao_Von_So_scanned.pdf' }
    ],
    auditLog: [
      { id: 'a16_1', contractId: 'con_seed_16', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastDaysTime(10), note: 'Tạo mới.' },
      { id: 'a16_2', contractId: 'con_seed_16', fromStatus: 'Chờ bản gửi lại', toStatus: 'Hoàn tất', updatedBy: 'clerk@test.com', updatedAt: getPastDaysTime(3), note: 'Scan số hóa lưu trữ thành công.' }
    ],
    uploaded_at: getPastDaysTime(10),
    printed_at: getPastDaysTime(9),
    signed_at: getPastDaysTime(8),
    waybill_created_at: getPastDaysTime(7),
    picked_up_at: getPastDaysTime(6),
    delivered_at: getPastDaysTime(4),
    received_back_at: getPastDaysTime(3),
    archived_at: getPastDaysTime(3),
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastDaysTime(3)
  });

  // 17. Trùng đối tác Agribank Land - HĐ 2 (Cố tình trùng đối tác nhưng khác mã HĐ và trạng thái để test search cực chính xác)
  seed.push({
    id: 'con_seed_17',
    name: 'Hợp đồng Thuê Mặt bằng Gian hàng Giới thiệu Sản phẩm tại Hội chợ',
    contractNumber: 'HD-2026-MRA07',
    partnerName: 'Công ty Cổ phần Sự kiện Agribank Land',
    value: '120,000,000 VND',
    signDate: now.toISOString().split('T')[0],
    effectiveDate: now.toISOString().split('T')[0],
    status: 'Đang chờ ký',
    waybillCode: '',
    vtpStatusHistory: [],
    files: [{ id: 'f17', name: 'HD_Thue_Gian_Hang_Hoi_Cho_2026.docx', type: 'original', uploadedBy: 'legal@test.com', uploadedAt: getPastTime(1.2), size: 380400, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filePath: 'data/contracts/HD_Thue_Gian_Hang_Hoi_Cho_2026.docx' }],
    auditLog: [
      { id: 'a17_1', contractId: 'con_seed_17', fromStatus: null, toStatus: 'Chờ in', updatedBy: 'legal@test.com', updatedAt: getPastTime(1.2), note: 'Khởi tạo.' },
      { id: 'a17_2', contractId: 'con_seed_17', fromStatus: 'Chờ in', toStatus: 'Đang chờ ký', updatedBy: 'clerk@test.com', updatedAt: getPastTime(0.2), note: 'In và trình ký.' }
    ],
    uploaded_at: getPastTime(1.2),
    printed_at: getPastTime(0.2),
    signed_at: null,
    waybill_created_at: null,
    picked_up_at: null,
    delivered_at: null,
    received_back_at: null,
    archived_at: null,
    slaBreached: false,
    slaBreachType: null,
    lastActivityAt: getPastTime(0.2)
  });
  seed.forEach((c, idx) => {
    if (c.processingMethod === undefined) {
      c.processingMethod = 'physical';
    }
    if (c.printCopies === undefined) {
      c.printCopies = 2;
    }
    const r = getMockReceiver(idx);
    if (c.receiverName === undefined || c.receiverName === '-') {
      c.receiverName = r.name;
    }
    if (c.receiverPhone === undefined || c.receiverPhone === '-') {
      c.receiverPhone = r.phone;
    }
    if (c.receiverAddress === undefined || c.receiverAddress === '-') {
      c.receiverAddress = r.addr;
    }
  });

  return seed;
}

function readDb(): { settings: Settings; contracts: Contract[] } {
  if (!fs.existsSync(DB_FILE)) {
    const initData = { settings: defaultSettings, contracts: generateSeedContracts() };
    fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2), 'utf-8');
    return initData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Ensure vtpConnectionStatus exists
    if (!parsed.settings.hasOwnProperty('vtpConnectionStatus')) {
      parsed.settings.vtpConnectionStatus = 'connected';
    }
    
    // Seed if empty for robust testing
    if (!parsed.contracts || parsed.contracts.length === 0) {
      parsed.contracts = generateSeedContracts();
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    } else {
      let migrated = false;
      parsed.contracts.forEach((c: any, idx: number) => {
        if (c.processingMethod === undefined) {
          c.processingMethod = 'physical';
          migrated = true;
        }
        if (c.printCopies === undefined) {
          c.printCopies = 2;
          migrated = true;
        }
        const r = getMockReceiver(idx);
        if (c.receiverName === undefined || c.receiverName === '' || c.receiverName === '-') {
          c.receiverName = r.name;
          migrated = true;
        }
        if (c.receiverPhone === undefined || c.receiverPhone === '' || c.receiverPhone === '-') {
          c.receiverPhone = r.phone;
          migrated = true;
        }
        if (c.receiverAddress === undefined || c.receiverAddress === '' || c.receiverAddress === '-') {
          c.receiverAddress = r.addr;
          migrated = true;
        }
      });
      if (migrated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      }
    }
    return parsed;
  } catch (e) {
    console.error('Error reading database file', e);
    return { settings: defaultSettings, contracts: generateSeedContracts() };
  }
}

function writeDb(data: { settings: Settings; contracts: Contract[] }) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readLogs(): SimLog[] {
  if (!fs.existsSync(LOGS_FILE)) {
    const initLogs: SimLog[] = [
      {
        id: 'init',
        type: 'system',
        title: 'Hệ thống khởi động',
        content: 'Hệ thống Quản lý Hợp đồng Nội bộ hoạt động thành công. Đã cấu hình Admin mặc định cho tankhoi.agribank@gmail.com.',
        timestamp: new Date().toISOString()
      }
    ];
    fs.writeFileSync(LOGS_FILE, JSON.stringify(initLogs, null, 2), 'utf-8');
    return initLogs;
  }
  try {
    const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeLog(type: SimLog['type'], title: string, content: string) {
  const logs = readLogs();
  const newLog: SimLog = {
    id: Math.random().toString(36).substring(7),
    type,
    title,
    content,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog); // newest first
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8'); // keep last 100 logs
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONTRACTS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }
  return aiClient;
}

// AI Extraction Utility
async function extractContractData(filePath: string, fileMime: string, isScan: boolean): Promise<{
  name: string;
  contractNumber: string;
  partnerName: string;
  value: string;
  signDate: string;
  effectiveDate: string;
}> {
  let textContent = '';
  writeLog('ai', 'Bắt đầu trích xuất AI', `File: ${path.basename(filePath)}, isScan: ${isScan}`);

  if (fileMime.includes('officedocument.wordprocessingml') || filePath.endsWith('.docx')) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result.value;
      writeLog('ai', 'Đọc text file DOCX thành công', `Đã đọc ${textContent.length} ký tự từ file.`);
    } catch (err: any) {
      writeLog('ai', 'Lỗi đọc file DOCX', err.message);
    }
  }

  // Fallback or Image scan content
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      let prompt = `Bạn là một AI chuyên gia pháp lý tiếng Việt. Hãy trích xuất các thông tin chi tiết của hợp đồng từ văn bản này. Trả về định dạng JSON thuần túy có cấu trúc chính xác sau đây (không dùng markdown block \`\`\`json):
{
  "name": "Tên đầy đủ của hợp đồng",
  "contractNumber": "Số hợp đồng hoặc số hiệu hợp đồng (nếu không có thì trả về mã ngẫu nhiên dạng HD-YYYY-XXXX)",
  "partnerName": "Tên đối tác hoặc Công ty bên B/bên đối tác",
  "value": "Giá trị hợp đồng (ghi bằng số hoặc chữ có kèm đơn vị tiền tệ)",
  "signDate": "Ngày ký hợp đồng (định dạng YYYY-MM-DD hoặc DD-MM-YYYY)",
  "effectiveDate": "Ngày hiệu lực của hợp đồng (định dạng YYYY-MM-DD hoặc DD-MM-YYYY)"
}

Nội dung văn bản:
${textContent || 'Văn bản rỗng hoặc không thể đọc được. Hãy tạo thông tin hợp đồng mẫu ngẫu nhiên phù hợp dựa trên tên file: ' + path.basename(filePath)}`;

      let response;
      if (isScan && (fileMime.startsWith('image/') || fileMime === 'application/pdf')) {
        // Multi-modal upload directly to Gemini
        const fileBuffer = fs.readFileSync(filePath);
        const filePart = {
          inlineData: {
            mimeType: fileMime,
            data: fileBuffer.toString('base64')
          }
        };
        response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            filePart,
            { text: prompt }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
      } else {
        response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
      }

      const resText = response.text ? response.text.trim() : '';
      writeLog('ai', 'Phản hồi từ Gemini AI', resText);
      
      let cleanJson = resText;
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      return {
        name: parsed.name || 'Hợp đồng không tên',
        contractNumber: parsed.contractNumber || 'HD-' + Date.now().toString().slice(-6),
        partnerName: parsed.partnerName || 'Chưa rõ đối tác',
        value: parsed.value || '0 VND',
        signDate: parsed.signDate || new Date().toISOString().split('T')[0],
        effectiveDate: parsed.effectiveDate || new Date().toISOString().split('T')[0]
      };
    } catch (err: any) {
      writeLog('ai', 'Lỗi gọi Gemini AI, đang sử dụng fallback mẫu', err.message);
    }
  } else {
    writeLog('ai', 'Không tìm thấy GEMINI_API_KEY', 'Sử dụng công cụ trích xuất mô phỏng chất lượng cao.');
  }

  // High-fidelity fallback simulated extract
  const fileName = path.basename(filePath).toLowerCase();
  let partner = 'Công ty Cổ phần Công nghệ ABC';
  let name = 'Hợp đồng Cung cấp Dịch vụ Phần mềm';
  let val = '150,000,000 VND';
  let num = 'HD-2026-VTP998';

  if (fileName.includes('thue') || fileName.includes('rent')) {
    name = 'Hợp đồng Thuê Văn phòng Tòa nhà';
    partner = 'Công ty TNHH Địa ốc Thịnh Vượng';
    val = '45,000,000 VND / Tháng';
    num = 'HDT-2026-0043';
  } else if (fileName.includes('mua') || fileName.includes('buy') || fileName.includes('sale')) {
    name = 'Hợp đồng Mua bán Thiết bị Tin học';
    partner = 'Tổng công ty Thiết bị Số Việt Nam';
    val = '582,300,000 VND';
    num = 'HDB-2026-512';
  } else if (fileName.includes('vận chuyển') || fileName.includes('ship')) {
    name = 'Hợp đồng Dịch vụ Vận chuyển Hàng hóa';
    partner = 'Công ty Cổ phần Giao nhận Logistics';
    val = 'Đơn giá 12,000 VND/km';
    num = 'HDCV-2026-102';
  }

  return {
    name,
    contractNumber: num,
    partnerName: partner,
    value: val,
    signDate: new Date().toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0]
  };
}

// Teams notification simulation & webhook calling
async function notifyTeams(title: string, text: string, contractId: string, status: string) {
  const db = readDb();
  const settings = db.settings;
  const url = settings.teamsWebhookUrl;

  let payload = settings.teamsPayloadTemplate;
  payload = payload.replace(/{{title}}/g, title)
                   .replace(/{{text}}/g, text)
                   .replace(/{{contractId}}/g, contractId)
                   .replace(/{{status}}/g, status)
                   .replace(/{{timestamp}}/g, new Date().toLocaleString('vi-VN'));

  writeLog('teams', 'Chuẩn bị gửi thông báo Microsoft Teams', `Payload: ${payload}`);

  if (url && url.startsWith('http')) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      const resText = await res.text();
      writeLog('teams', `Gửi Teams thành công (HTTP ${res.status})`, resText || 'Không có phản hồi');
    } catch (err: any) {
      writeLog('teams', 'Lỗi gửi webhook Teams thực tế', err.message);
    }
  } else {
    writeLog('teams', 'Mô phỏng gửi thông báo Teams thành công', 'Không có URL Teams hợp lệ được cấu hình, chỉ lưu vết simulator.');
  }
}

// Google Drive backup simulation
async function backupToDrive(fileName: string, filePath: string) {
  const db = readDb();
  const folder = db.settings.googleDriveFolderId;
  writeLog('drive', 'Sao lưu Google Drive', `Bắt đầu upload file "${fileName}" lên Google Drive vào thư mục "${folder}"`);
  
  // Simulate network latency
  setTimeout(() => {
    writeLog('drive', 'Sao lưu Google Drive thành công', `Đã đồng bộ file "${fileName}" thành công. ID Drive: drv_${Math.random().toString(36).substring(7)}`);
  }, 1500);
}

// SLA check background logic
function checkSlaBreaches() {
  const db = readDb();
  let modified = false;
  const now = new Date();

  db.contracts.forEach((contract) => {
    if (contract.status === 'Hoàn tất') return;

    const lastActivity = new Date(contract.lastActivityAt);
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Internal SLA check
    const internalStates = ['Chờ in', 'Đang chờ ký', 'Chờ tạo vận đơn', 'Chờ bản gửi lại'];
    if (internalStates.includes(contract.status)) {
      if (diffHours > db.settings.slaInternalHours && !contract.slaBreached) {
        contract.slaBreached = true;
        contract.slaBreachType = 'internal';
        modified = true;
        
        writeLog('sla', `⚠️ CẢNH BÁO SLA NỘI BỘ: Hợp đồng #${contract.contractNumber}`, 
          `Hợp đồng "${contract.name}" ở trạng thái "${contract.status}" quá ${db.settings.slaInternalHours} giờ chưa xử lý!`);
        
        notifyTeams(
          `⚠️ Cảnh báo SLA Nội bộ - Quá hạn`,
          `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) hiện đang tồn đọng ở bước "${contract.status}" quá ${db.settings.slaInternalHours} giờ. Vui lòng xử lý gấp!`,
          contract.id,
          contract.status
        );
      }
    }

    // Viettel Post SLA check
    if (contract.status === 'Đang giao') {
      const diffDays = diffHours / 24;
      if (diffDays > db.settings.slaViettelPostDays && !contract.slaBreached) {
        contract.slaBreached = true;
        contract.slaBreachType = 'viettelpost';
        modified = true;

        writeLog('sla', `⚠️ CẢNH BÁO SLA VIETTEL POST: Hợp đồng #${contract.contractNumber}`, 
          `Hợp đồng "${contract.name}" ở trạng thái "Đang giao" quá ${db.settings.slaViettelPostDays} ngày mà không nhận được cập nhật từ Viettel Post!`);

        notifyTeams(
          `⚠️ Cảnh báo SLA Giao nhận - Quá hạn`,
          `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đang giao qua Viettel Post quá ${db.settings.slaViettelPostDays} ngày chưa có cập nhật mới. Vui lòng liên hệ đơn vị vận chuyển!`,
          contract.id,
          contract.status
        );
      }
    }
  });

  if (modified) {
    writeDb(db);
  }
}

// Periodically run SLA checks every 1 minute
const slaInterval = setInterval(checkSlaBreaches, 60000);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Role Enforcement Middleware
  const requireRole = (allowedRoles: Array<'legal' | 'clerk' | 'admin'>) => {
    return (req: any, res: any, next: any) => {
      // 1. Check header x-user-role
      let role = req.headers['x-user-role'] as string;

      // 2. Fallback: check header x-user-email or req.body fields
      if (!role) {
        const userEmail = (req.headers['x-user-email'] || req.body?.updatedBy || req.body?.requestedBy || req.body?.uploadedBy) as string;
        if (userEmail) {
          const cleanEmail = userEmail.toLowerCase().trim();
          const demoRoles: Record<string, 'admin' | 'legal' | 'clerk'> = {
            'admin@dps.media': 'admin',
            'legal@dps.media': 'legal',
            'clerk@dps.media': 'clerk',
            'tankhoi.agribank@gmail.com': 'admin',
            'legal@test.com': 'legal',
            'clerk@test.com': 'clerk',
          };
          if (demoRoles[cleanEmail]) {
            role = demoRoles[cleanEmail];
          } else {
            const db = readDb();
            const foundUser = db.settings?.users?.find((u: any) => u.email.toLowerCase() === cleanEmail);
            if (foundUser) role = foundUser.role;
          }
        }
      }

      // 3. Fallback in development/demo mode: default to admin so actions are never blocked
      if (!role) {
        role = 'admin';
      }

      if (!allowedRoles.includes(role as any)) {
        return res.status(403).json({ error: `Hành động bị chặn. Bạn không có quyền thực hiện nghiệp vụ này. Yêu cầu: ${allowedRoles.join(' hoặc ')}` });
      }
      next();
    };
  };

  // Serve static contract files securely
  app.get('/api/contracts/:id/files/:fileId', (req, res) => {
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });
    const file = contract.files.find((f) => f.id === req.params.fileId);
    if (!file) return res.status(404).json({ error: 'Không tìm thấy tệp đính kèm' });

    if (fs.existsSync(file.filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
      res.setHeader('Content-Type', file.mimeType);
      fs.createReadStream(file.filePath).pipe(res);
    } else {
      res.status(404).json({ error: 'Tệp tin không tồn tại trên máy chủ' });
    }
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email là bắt buộc' });

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check demo accounts first for seamless demo testing
    const demoRoles: Record<string, 'admin' | 'legal' | 'clerk'> = {
      'admin@dps.media': 'admin',
      'legal@dps.media': 'legal',
      'clerk@dps.media': 'clerk',
      'tankhoi.agribank@gmail.com': 'admin',
      'legal@test.com': 'legal',
      'clerk@test.com': 'clerk',
    };

    if (demoRoles[cleanEmail]) {
      return res.json({
        user: {
          email: cleanEmail,
          role: demoRoles[cleanEmail],
          name: cleanEmail.startsWith('admin') ? 'Quản Trị Viên' : cleanEmail.startsWith('legal') ? 'Pháp Chế' : 'Văn Thư',
          status: 'active'
        }
      });
    }

    // 2. Try authenticating against PostgreSQL database (Argon2id)
    try {
      const { loginUser } = await import('./server/modules/auth/service.js');
      const { user } = await loginUser(cleanEmail, password || '', req);
      return res.json({ user });
    } catch (e: any) {
      // 3. Fallback to settings.users in database.json
      const db = readDb();
      const foundUser = db.settings.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (foundUser) {
        return res.json({ user: foundUser });
      }

      return res.status(403).json({ error: 'Email chưa được mời tham gia hệ thống' });
    }
  });

  // Current session status
  app.get('/api/auth/me', (req, res) => {
    const email = (req.headers['x-user-email'] as string) || 'admin@dps.media';
    const role = (req.headers['x-user-role'] as string) || 'admin';
    return res.json({
      user: {
        email,
        role,
        name: email.startsWith('admin') ? 'Quản Trị Viên' : email.startsWith('legal') ? 'Pháp Chế' : 'Văn Thư',
        status: 'active'
      }
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    return res.json({ success: true });
  });

  app.post('/api/auth/invite', requireRole(['admin']), (req, res) => {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ error: 'Thiếu email hoặc quyền hạn' });

    const db = readDb();
    const cleanEmail = email.toLowerCase().trim();
    const index = db.settings.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    if (index >= 0) {
      db.settings.users[index].role = role;
    } else {
      db.settings.users.push({
        email: cleanEmail,
        role,
        invitedAt: new Date().toISOString()
      });
    }

    writeDb(db);
    writeLog('system', 'Mời người dùng thành công', `Đã mời ${cleanEmail} làm vai trò ${role}`);
    res.json({ users: db.settings.users });
  });

  app.delete('/api/auth/invite/:email', requireRole(['admin']), (req, res) => {
    const { email } = req.params;
    const db = readDb();
    db.settings.users = db.settings.users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    writeDb(db);
    writeLog('system', 'Xóa người dùng thành công', `Đã hủy lời mời của ${email}`);
    res.json({ users: db.settings.users });
  });

  // Settings routes
  app.get('/api/settings', (req, res) => {
    const db = readDb();
    res.json(db.settings);
  });

  app.post('/api/settings', requireRole(['admin']), (req, res) => {
    const db = readDb();
    db.settings = { ...db.settings, ...req.body };
    writeDb(db);
    writeLog('system', 'Cập nhật cấu hình hệ thống', 'Đã lưu cấu hình cài đặt mới từ Admin Settings.');
    res.json(db.settings);
  });

  // Logs simulation routes
  app.get('/api/sim/logs', (req, res) => {
    res.json(readLogs());
  });

  app.post('/api/sim/run-sla-check', (req, res) => {
    checkSlaBreaches();
    res.json({ success: true, message: 'Đã chạy quét SLA thủ công.' });
  });

  // Contracts management APIs
  app.get('/api/contracts', (req, res) => {
    const db = readDb();
    res.json(db.contracts);
  });

  // Upload original DOCX file
  app.post('/api/contracts', upload.single('file'), requireRole(['legal', 'admin']), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không tìm thấy file tải lên' });
    const { uploadedBy } = req.body;

    const contractId = Math.random().toString(36).substring(7);
    const now = new Date().toISOString();

    try {
      // 1. Save Contract Metadata
      const db = readDb();

      // 2. Extract Data via AI
      const extracted = await extractContractData(req.file.path, req.file.mimetype, false);

      const contractFile: ContractFile = {
        id: Math.random().toString(36).substring(7),
        name: req.file.originalname,
        type: 'original',
        uploadedBy: uploadedBy || 'legal@test.com',
        uploadedAt: now,
        size: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path
      };

      const newContract: Contract = {
        id: contractId,
        name: extracted.name,
        contractNumber: extracted.contractNumber,
        partnerName: extracted.partnerName,
        value: extracted.value,
        signDate: extracted.signDate,
        effectiveDate: extracted.effectiveDate,
        status: 'Chờ duyệt bản mềm',
        waybillCode: '',
        vtpStatusHistory: [],
        files: [contractFile],
        auditLog: [],
        uploaded_at: now,
        printed_at: null,
        signed_at: null,
        waybill_created_at: null,
        picked_up_at: null,
        delivered_at: null,
        received_back_at: null,
        archived_at: null,
        slaBreached: false,
        slaBreachType: null,
        lastActivityAt: now
      };

      const auditLog: AuditLog = {
        id: Math.random().toString(36).substring(7),
        contractId,
        fromStatus: null,
        toStatus: 'Chờ duyệt bản mềm',
        updatedBy: uploadedBy || 'legal@test.com',
        updatedAt: now,
        note: `Khởi tạo hợp đồng mới thành công và tải lên file gốc "${req.file.originalname}". Đang chờ Sếp/Lãnh đạo duyệt bản mềm trước khi cho phép in.`
      };

      newContract.auditLog.push(auditLog);
      db.contracts.unshift(newContract);
      writeDb(db);

      // Webhooks and Backup async tasks
      notifyTeams(
        '🆕 Hợp đồng mới được tải lên',
        `Pháp chế đã tải lên hợp đồng mới: "${newContract.name}" (Số: ${newContract.contractNumber}, Đối tác: ${newContract.partnerName}). Đang chờ Sếp/Lãnh đạo duyệt bản mềm trước khi in.`,
        contractId,
        'Chờ duyệt bản mềm'
      );

      backupToDrive(req.file.originalname, req.file.path);

      res.json(newContract);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Xử lý hợp đồng thất bại: ' + e.message });
    }
  });

  // Check if contract ID/number already exists
  app.get('/api/contracts/check-id/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const exists = db.contracts.some((c) => c.contractNumber.toLowerCase() === id.toLowerCase().trim());
    res.json({ exists });
  });

  // Create contract manually (AI skip / manual input fallback)
  app.post('/api/contracts/manual', requireRole(['legal', 'admin']), (req, res) => {
    const { 
      name, 
      contractNumber, 
      partnerName, 
      value, 
      signDate, 
      effectiveDate, 
      uploadedBy,
      googleDocsLink,
      receiverName,
      receiverPhone,
      receiverAddress,
      deliveryNotes,
      processingMethod,
      printCopies
    } = req.body;

    if (!contractNumber) {
      return res.status(400).json({ error: 'Mã hợp đồng là bắt buộc' });
    }
    if (!name || !partnerName) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin pháp lý bắt buộc (Tên hợp đồng, Đối tác)' });
    }
    if (!googleDocsLink) {
      return res.status(400).json({ error: 'Đường dẫn Google Docs là bắt buộc' });
    }
    if (!receiverName || !receiverPhone || !receiverAddress) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ Thông tin giao nhận bắt buộc' });
    }

    // VN Phone validation regex
    const vnPhoneRegex = /^(0[35789]\d{8})$/;
    if (receiverPhone !== '-' && !vnPhoneRegex.test(receiverPhone)) {
      return res.status(400).json({ error: 'Số điện thoại người nhận không đúng định dạng Việt Nam (phải gồm 10 số và bắt đầu bằng 03, 05, 07, 08, 09) hoặc điền "-"' });
    }
    if (!processingMethod || (processingMethod !== 'physical' && processingMethod !== 'digital')) {
      return res.status(400).json({ error: 'Vui lòng chọn Quy cách xử lý' });
    }
    if (processingMethod === 'physical' && (!printCopies || isNaN(Number(printCopies)) || Number(printCopies) <= 0)) {
      return res.status(400).json({ error: 'Số lượng bản in hợp đồng giấy phải lớn hơn 0' });
    }

    const contractId = Math.random().toString(36).substring(7);
    const now = new Date().toISOString();

    try {
      const db = readDb();

      // Ensure contractNumber is unique
      const exists = db.contracts.some((c) => c.contractNumber.toLowerCase() === contractNumber.toLowerCase().trim());
      if (exists) {
        return res.status(400).json({ error: `Mã hợp đồng "${contractNumber}" đã tồn tại trong hệ thống. Vui lòng sử dụng mã khác.` });
      }

      // Determine initial status based on processing method
      const initialStatus = processingMethod === 'digital' ? 'Chờ bản gửi lại' : 'Chờ duyệt bản mềm';

      const newContract: Contract = {
        id: contractId,
        name,
        contractNumber: contractNumber.trim(),
        partnerName,
        value,
        signDate: signDate || now.split('T')[0],
        effectiveDate: effectiveDate || now.split('T')[0],
        status: initialStatus,
        waybillCode: '',
        vtpStatusHistory: [],
        files: [],
        auditLog: [],
        uploaded_at: now,
        printed_at: null,
        signed_at: null,
        waybill_created_at: null,
        picked_up_at: null,
        delivered_at: null,
        received_back_at: null,
        archived_at: null,
        slaBreached: false,
        slaBreachType: null,
        lastActivityAt: now,
        googleDocsLink,
        receiverName,
        receiverPhone,
        receiverAddress,
        deliveryNotes,
        processingMethod,
        printCopies: processingMethod === 'physical' ? Number(printCopies) : undefined
      };

      const auditLog: AuditLog = {
        id: Math.random().toString(36).substring(7),
        contractId,
        fromStatus: null,
        toStatus: initialStatus,
        updatedBy: uploadedBy || 'legal@test.com',
        updatedAt: now,
        note: processingMethod === 'digital'
          ? `Pháp chế khởi tạo quy trình số hóa. Quy cách xử lý: Chỉ lưu bản scan số. Hệ thống tự động bỏ qua các khâu in ấn, trình ký và gửi bưu điện, chuyển thẳng đến Chờ bản gửi lại.`
          : `Pháp chế khởi tạo quy trình bưu gửi giấy. Quy cách xử lý: In bản cứng & gửi chuyển phát (Số bản in: ${printCopies}).`
      };

      newContract.auditLog.push(auditLog);
      db.contracts.unshift(newContract);
      writeDb(db);

      notifyTeams(
        processingMethod === 'digital' 
          ? '🆕 Hợp đồng số hóa mới (Chỉ lưu scan số)' 
          : '🆕 Hợp đồng bưu gửi mới',
        processingMethod === 'digital'
          ? `Pháp chế khởi tạo hợp đồng số hóa: "${newContract.name}" (Mã: ${newContract.contractNumber}). Quy trình chuyển thẳng sang "Chờ đính kèm bản scan".`
          : `Pháp chế khởi tạo hợp đồng bưu gửi giấy: "${newContract.name}" (Mã: ${newContract.contractNumber}, Số bản in: ${printCopies}). Đang chờ Văn thư in bưu gửi.`,
        contractId,
        initialStatus
      );

      res.json(newContract);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Khởi tạo hợp đồng thủ công thất bại: ' + e.message });
    }
  });

  // Action: Manager creates Drafting Request (Tạo yêu cầu soạn thảo hợp đồng cho Legal)
  app.post('/api/contracts/request-draft', requireRole(['admin', 'legal']), (req, res) => {
    const {
      name,
      contractNumber,
      partnerName,
      value,
      deadline,
      basePay,
      urgencyLevel,
      assignedTo,
      requestedBy,
      draftingInstructions,
      googleDocsLink
    } = req.body;

    if (!name || !partnerName) {
      return res.status(400).json({ error: 'Tên công việc/hợp đồng và Tên đối tác là bắt buộc' });
    }

    const db = readDb();
    const generatedNumber = contractNumber && contractNumber.trim() !== '' 
      ? contractNumber.trim() 
      : `HD-REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    const exists = db.contracts.some((c) => c.contractNumber.toLowerCase() === generatedNumber.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: `Mã hợp đồng "${generatedNumber}" đã tồn tại.` });
    }

    const contractId = Math.random().toString(36).substring(7);
    const now = new Date().toISOString();

    // Default deadline to 24h from now if omitted
    const targetDeadline = deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const targetBasePay = Number(basePay) || db.settings?.defaultBasePayLegal || 500000;

    // Calculate urgency coef
    let uCoef = 0.0;
    let uLevel: 'normal' | 'priority' | 'urgent' | 'emergency' = 'normal';

    if (urgencyLevel) {
      uLevel = urgencyLevel;
      if (urgencyLevel === 'emergency') uCoef = 0.3;
      else if (urgencyLevel === 'urgent') uCoef = 0.2;
      else if (urgencyLevel === 'priority') uCoef = 0.1;
      else uCoef = 0.0;
    } else {
      const diffHours = (new Date(targetDeadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60);
      if (diffHours <= 1.0) { uCoef = 0.3; uLevel = 'emergency'; }
      else if (diffHours < 3.0) { uCoef = 0.2; uLevel = 'urgent'; }
      else if (diffHours < 24.0) { uCoef = 0.1; uLevel = 'priority'; }
      else { uCoef = 0.0; uLevel = 'normal'; }
    }

    const newContract: Contract = {
      id: contractId,
      name,
      contractNumber: generatedNumber,
      partnerName,
      value: value || '0 VNĐ',
      signDate: now.split('T')[0],
      effectiveDate: now.split('T')[0],
      status: 'Chờ soạn thảo',
      waybillCode: '',
      vtpStatusHistory: [],
      files: [],
      auditLog: [],
      uploaded_at: now,
      soft_approved_at: null,
      printed_at: null,
      signed_at: null,
      waybill_created_at: null,
      picked_up_at: null,
      delivered_at: null,
      received_back_at: null,
      archived_at: null,
      slaBreached: false,
      slaBreachType: null,
      lastActivityAt: now,
      googleDocsLink: googleDocsLink || '',
      processingMethod: 'physical',
      printCopies: 2,

      // Drafting Request & Legal Evaluation
      requested_by: requestedBy || 'Quản lý',
      assigned_to: assignedTo || 'legal@test.com',
      requested_at: now,
      deadline: targetDeadline,
      draft_submitted_at: null,
      base_pay: targetBasePay,
      urgency_level: uLevel,
      urgency_coef: uCoef,
      feedback_count: 0,
      feedback_history: [],
      is_punctual: null,
      punctual_coef: 0.0,
      quality_coef: 0.1, // default 0-1 feedback = +10%
      calculated_payroll: Math.round(targetBasePay * (1 + uCoef + 0.1)), // preview initial
      drafting_instructions: draftingInstructions || ''
    };

    const auditLog: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contractId,
      fromStatus: null,
      toStatus: 'Chờ soạn thảo',
      updatedBy: requestedBy || 'Quản lý',
      updatedAt: now,
      note: `Quản lý giao task soạn thảo hợp đồng cho Legal. Hạn chót: ${new Date(targetDeadline).toLocaleString('vi-VN')}. Mức độ gấp: ${uLevel.toUpperCase()} (+${Math.round(uCoef * 100)}%).`
    };

    newContract.auditLog.push(auditLog);
    db.contracts.unshift(newContract);
    writeDb(db);

    notifyTeams(
      '📝 Yêu cầu soạn thảo hợp đồng mới',
      `Quản lý vừa giao task soạn thảo: "${newContract.name}" cho Legal (${newContract.assigned_to}). Deadline: ${new Date(targetDeadline).toLocaleString('vi-VN')}. Yêu cầu: ${draftingInstructions || 'Soạn thảo bản mềm hợp đồng.'}`,
      contractId,
      'Chờ soạn thảo'
    );

    res.json(newContract);
  });

  // Action: Legal Submits Draft File (.docx / Google Docs)
  app.post('/api/contracts/:id/submit-draft', upload.single('file'), requireRole(['legal', 'admin']), (req, res) => {
    const { updatedBy, googleDocsLink } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;

    contract.draft_submitted_at = now;
    if (googleDocsLink) contract.googleDocsLink = googleDocsLink;

    if (req.file) {
      const draftFile: ContractFile = {
        id: Math.random().toString(36).substring(7),
        name: req.file.originalname,
        type: 'original',
        uploadedBy: updatedBy || 'Pháp chế',
        uploadedAt: now,
        size: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path
      };
      contract.files.push(draftFile);
    }

    // Evaluate punctuality
    if (contract.deadline) {
      const submitTime = new Date(now).getTime();
      const deadlineTime = new Date(contract.deadline).getTime();
      if (submitTime <= deadlineTime) {
        contract.is_punctual = true;
        contract.punctual_coef = 0.1; // +10% đúng hạn
      } else {
        contract.is_punctual = false;
        contract.punctual_coef = 0.0; // 0% trễ hạn
      }
    } else {
      contract.is_punctual = true;
      contract.punctual_coef = 0.1;
    }

    contract.status = 'Chờ duyệt bản mềm';
    contract.lastActivityAt = now;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ duyệt bản mềm',
      updatedBy: updatedBy || 'Pháp chế',
      updatedAt: now,
      note: `Legal đã nộp bản thảo hợp đồng${req.file ? ` tệp "${req.file.originalname}"` : ''}. Trạng thái đúng hạn: ${contract.is_punctual ? 'ĐÚNG HẠN (+10%)' : 'TRỄ HẠN (0%)'}. Chuyển sang Chờ duyệt bản mềm.`
    };

    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '📄 Legal đã nộp bản thảo hợp đồng',
      `Legal (${updatedBy || 'Pháp chế'}) đã hoàn thành soạn thảo "${contract.name}" (Mã: ${contract.contractNumber}). ${contract.is_punctual ? '✅ Đúng hạn cam kết' : '⚠️ Trễ hạn deadline'}. Mời Sếp duyệt bản mềm.`,
      contract.id,
      'Chờ duyệt bản mềm'
    );

    res.json(contract);
  });

  // Action: Manager Feedback / Request Revision on Draft
  app.post('/api/contracts/:id/feedback-draft', requireRole(['admin']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;

    contract.feedback_count = (contract.feedback_count || 0) + 1;
    if (!contract.feedback_history) contract.feedback_history = [];
    contract.feedback_history.push({
      at: now,
      by: updatedBy || 'Quản lý',
      note: note || 'Yêu cầu chỉnh sửa lại nội dung hợp đồng.'
    });

    // Quality coef update based on feedback count
    if (contract.feedback_count <= 1) {
      contract.quality_coef = 0.1;
    } else if (contract.feedback_count === 2) {
      contract.quality_coef = 0.0;
    } else {
      contract.quality_coef = -0.1;
    }

    contract.status = 'Chờ soạn thảo';
    contract.lastActivityAt = now;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ soạn thảo',
      updatedBy: updatedBy || 'Quản lý',
      updatedAt: now,
      note: `Quản lý gửi yêu cầu chỉnh sửa bản thảo (Feedback lần ${contract.feedback_count}). Nội dung: "${note || 'Vui lòng sửa lại bản thảo.'}". Hệ số chất lượng hiện tại: ${Math.round(contract.quality_coef * 100)}%.`
    };

    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '💬 Yêu cầu sửa đổi bản thảo hợp đồng',
      `Quản lý yêu cầu Legal chỉnh sửa hợp đồng "${contract.name}" (Lượt feedback: ${contract.feedback_count}). Nội dung: ${note || 'Vui lòng kiểm tra lại.'}`,
      contract.id,
      'Chờ soạn thảo'
    );

    res.json(contract);
  });

  // Action: Approve Soft Copy (Lãnh đạo / Sếp duyệt bản mềm)
  app.post('/api/contracts/:id/approve-soft-copy', requireRole(['admin', 'clerk', 'legal']), (req, res) => {
    const { updatedBy } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Chờ in';
    contract.soft_approved_at = now;
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    // Calculate final payroll if drafting task parameters exist
    const basePay = contract.base_pay || 500000;
    const urgencyCoef = contract.urgency_coef !== undefined ? contract.urgency_coef : 0.0;
    const punctualCoef = contract.punctual_coef !== undefined ? contract.punctual_coef : 0.1;
    const fbCount = contract.feedback_count || 0;

    let qualityCoef = 0.1;
    if (fbCount === 2) qualityCoef = 0.0;
    else if (fbCount > 2) qualityCoef = -0.1;

    contract.quality_coef = qualityCoef;
    const totalCoef = 1 + urgencyCoef + punctualCoef + qualityCoef;
    contract.calculated_payroll = Math.round(basePay * totalCoef);

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ in',
      updatedBy: updatedBy || 'Ban Giám Đốc',
      updatedAt: now,
      note: `Sếp / Lãnh đạo đã duyệt bản mềm hợp đồng. Lương task Legal tính được: ${contract.calculated_payroll.toLocaleString('vi-VN')} VNĐ (Đơn giá: ${basePay.toLocaleString('vi-VN')} VNĐ, Gấp: +${Math.round(urgencyCoef * 100)}%, Đúng hạn: +${Math.round(punctualCoef * 100)}%, Chất lượng: ${qualityCoef >= 0 ? '+' : ''}${Math.round(qualityCoef * 100)}%).`
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '✅ Bản mềm hợp đồng đã được phê duyệt',
      `Sếp đã phê duyệt bản mềm hợp đồng: "${contract.name}" (Số: ${contract.contractNumber}). Lương soạn thảo ghi nhận: ${contract.calculated_payroll.toLocaleString('vi-VN')} VNĐ. Chuyển Văn thư in ấn.`,
      contract.id,
      'Chờ in'
    );

    res.json(contract);
  });

  // Action: Print Contract
  app.post('/api/contracts/:id/print', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Đang chờ ký';
    contract.printed_at = now;
    contract.lastActivityAt = now;
    contract.slaBreached = false; // Reset breach status when moving to next stage
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Đang chờ ký',
      updatedBy: updatedBy || 'Văn thư',
      updatedAt: now,
      note: 'Văn thư xác nhận đã in thành công bản cứng hợp đồng.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '🖨️ Hợp đồng đã được in ấn',
      `Văn thư đã in bản cứng hợp đồng: "${contract.name}" (Số: ${contract.contractNumber}). Hiện đang chờ Sếp ký và đóng dấu vật lý.`,
      contract.id,
      'Đang chờ ký'
    );

    res.json(contract);
  });

  // Action: Sign Contract
  app.post('/api/contracts/:id/sign', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Chờ tạo vận đơn';
    contract.signed_at = now;
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ tạo vận đơn',
      updatedBy: updatedBy || 'Ban Giám Đốc',
      updatedAt: now,
      note: 'Văn thư xác nhận Sếp đã ký tay và đóng dấu đỏ vật lý lên hợp đồng.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '✍️ Hợp đồng đã ký đóng dấu',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đã được Sếp ký duyệt vật lý. Đang chờ văn thư tạo vận đơn Viettel Post để gửi cho đối tác.`,
      contract.id,
      'Chờ tạo vận đơn'
    );

    res.json(contract);
  });

  // Action: Create Waybill
  app.post('/api/contracts/:id/waybill', requireRole(['clerk', 'admin']), (req, res) => {
    const { waybillCode, updatedBy } = req.body;
    if (!waybillCode) return res.status(400).json({ error: 'Mã vận đơn là bắt buộc' });

    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Chờ shipper đến lấy';
    contract.waybillCode = waybillCode;
    contract.waybill_created_at = now;
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ shipper đến lấy',
      updatedBy: updatedBy || 'Văn thư',
      updatedAt: now,
      note: `Văn thư đã đăng ký gửi hàng trên Viettel Post, gán mã vận đơn: "${waybillCode}".`
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '📦 Đã tạo vận đơn vận chuyển',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đã được gán mã vận đơn Viettel Post: ${waybillCode}. Đang chờ shipper Viettel Post đến lấy hàng gửi đối tác.`,
      contract.id,
      'Chờ shipper đến lấy'
    );

    res.json(contract);
  });

  // Action: Upload Scan copy from Client
  app.post('/api/contracts/:id/scan', upload.single('file'), requireRole(['clerk', 'admin']), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không tìm thấy tệp scan' });
    const { uploadedBy } = req.body;

    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    
    try {
      writeLog('system', 'Bắt đầu số hóa bản quét hợp đồng', `Khách hàng gửi lại hợp đồng đã ký. Đang tiến hành lưu bản scan.`);

      const contractFile: ContractFile = {
        id: Math.random().toString(36).substring(7),
        name: req.file.originalname,
        type: 'scan',
        uploadedBy: uploadedBy || 'Văn thư',
        uploadedAt: now,
        size: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path
      };

      contract.files.push(contractFile);
      contract.received_back_at = now;
      contract.lastActivityAt = now;
      contract.status = 'Hoàn tất';
      contract.archived_at = now;

      const audit: AuditLog = {
        id: Math.random().toString(36).substring(7),
        contractId: contract.id,
        fromStatus: oldStatus,
        toStatus: 'Hoàn tất',
        updatedBy: uploadedBy || 'Văn thư',
        updatedAt: now,
        note: `Văn thư đã nhận bản scan hợp đồng và tải lên thành công tệp "${req.file.originalname}". Quy trình chính thức chuyển trạng thái sang Hoàn tất.`
      };
      contract.auditLog.push(audit);
      writeDb(db);

      backupToDrive(req.file.originalname, req.file.path);

      notifyTeams(
        '✅ HỢP ĐỒNG ĐÃ HOÀN TẤT VÒNG ĐỜI (SỐ HÓA)',
        `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}, Đối tác: ${contract.partnerName}) đã được đính kèm bản scan và chuyển trạng thái sang "Hoàn tất".`,
        contract.id,
        'Hoàn tất'
      );

      res.json(contract);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Lỗi tải và xử lý bản quét: ' + e.message });
    }
  });

  // Action: Complete and archive contract
  app.post('/api/contracts/:id/archive', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Hoàn tất';
    contract.archived_at = now;
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Hoàn tất',
      updatedBy: updatedBy || 'Văn thư',
      updatedAt: now,
      note: 'Hợp đồng đã hoàn thành lưu trữ số hóa hoàn tất 100% vòng đời.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '✅ HỢP ĐỒNG ĐÃ HOÀN TẤT VÒNG ĐỜI',
      `Chúc mừng! Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}, Đối tác: ${contract.partnerName}) đã được số hóa hoàn tất bản scan và lưu trữ hồ sơ thành công.`,
      contract.id,
      'Hoàn tất'
    );

    res.json(contract);
  });

  // Action: Transition contract via QR scan
  app.post('/api/contracts/:id/qr-transition', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    let nextStatus = oldStatus;
    let transitionNote = '';

    switch (oldStatus) {
      case 'Chờ duyệt bản mềm':
        nextStatus = 'Chờ in';
        transitionNote = 'Đã quét mã QR / Duyệt bản mềm: Chuyển trạng thái sang Chờ in.';
        contract.soft_approved_at = now;
        break;
      case 'Chờ in':
        nextStatus = 'Đang chờ ký';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Xác nhận đã in ấn, chuyển trạng thái sang Đang chờ ký.';
        contract.printed_at = now;
        break;
      case 'Đang chờ ký':
        nextStatus = 'Chờ tạo vận đơn';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Xác nhận sếp đã ký duyệt, chuyển trạng thái sang Chờ tạo vận đơn.';
        contract.signed_at = now;
        break;
      case 'Chờ tạo vận đơn':
        nextStatus = 'Chờ shipper đến lấy';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Chuyển trạng thái sang Chờ shipper đến lấy.';
        break;
      case 'Chờ shipper đến lấy':
        nextStatus = 'Đang giao';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Bưu tá đã lấy hàng bàn giao, chuyển trạng thái sang Đang giao.';
        contract.shipped_at = now;
        break;
      case 'Đang giao':
        nextStatus = 'Chờ bản gửi lại';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Chuyển trạng thái sang Chờ bản gửi lại.';
        break;
      case 'Chờ bản gửi lại':
        nextStatus = 'Hoàn tất';
        transitionNote = 'Đã quét mã QR nhãn bưu kiện cứng: Đã đối khớp nhận lại bản ký gốc thành công, chuyển sang Hoàn tất.';
        contract.received_back_at = now;
        contract.archived_at = now;
        break;
      default:
        return res.status(400).json({ error: `Trạng thái hiện tại "${oldStatus}" không thể tự động chuyển tiếp qua quét mã QR.` });
    }

    contract.status = nextStatus;
    contract.lastActivityAt = now;
    
    // Auto clear SLA delay if completing or transitioning properly
    if (nextStatus === 'Hoàn tất') {
      contract.slaBreached = false;
      contract.slaBreachType = null;
    }

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: nextStatus,
      updatedBy: updatedBy || 'Văn thư (QR Scan)',
      updatedAt: now,
      note: transitionNote
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      `QUÉT MÃ QR BƯU KIỆN - CHUYỂN TRẠNG THÁI [${nextStatus.toUpperCase()}]`,
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}, Đối tác: ${contract.partnerName}) được quét mã QR thành công, tự động chuyển trạng thái từ "${oldStatus}" sang "${nextStatus}".`,
      contract.id,
      nextStatus
    );

    res.json(contract);
  });

  // Action: Reject Contract (Bị từ chối ký)
  app.post('/api/contracts/:id/reject', requireRole(['admin', 'clerk', 'legal']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Bị từ chối ký';
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    // Ghi nhận lịch sử VTP tương ứng lý do từ chối ký
    contract.vtpStatusHistory.push({
      status: 'REJECTED_BY_PARTNER',
      updatedAt: now,
      note: note || 'Đối tác từ chối ký duyệt bưu phẩm và trả lại.'
    });

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Bị từ chối ký',
      updatedBy: updatedBy || 'Người dùng',
      updatedAt: now,
      note: note || 'Hợp đồng bị từ chối ký vật lý hoặc đối tác trả về từ chối ký.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '❌ Hợp đồng bị từ chối ký',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đã bị từ chối ký. Lý do: ${note || 'Không có lý do cụ thể'}.`,
      contract.id,
      'Bị từ chối ký'
    );

    res.json(contract);
  });

  // Action: Report Issue (Sự cố vận chuyển)
  app.post('/api/contracts/:id/report-issue', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Sự cố vận chuyển';
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    // Ghi nhận lịch sử VTP tương ứng sự cố vận chuyển
    contract.vtpStatusHistory.push({
      status: 'SHIPPING_ISSUE',
      updatedAt: now,
      note: note || 'Giao nhận bưu kiện gặp sự cố bất khả kháng.'
    });

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Sự cố vận chuyển',
      updatedBy: updatedBy || 'Văn thư',
      updatedAt: now,
      note: note || 'Ghi nhận sự cố trong quá trình giao nhận hàng qua Viettel Post.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '🚨 Sự cố vận chuyển hợp đồng',
      `Cảnh báo! Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) gặp sự cố vận chuyển: ${note || 'Không rõ nguyên nhân'}. Cần liên hệ bưu cục xử lý gấp!`,
      contract.id,
      'Sự cố vận chuyển'
    );

    res.json(contract);
  });

  // Action: Redraft Contract (Soạn thảo lại - quay về Chờ in)
  app.post('/api/contracts/:id/redraft', requireRole(['legal', 'admin']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Chờ duyệt bản mềm';
    contract.waybillCode = ''; // Reset mã vận đơn cũ
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ duyệt bản mềm',
      updatedBy: updatedBy || 'Pháp chế',
      updatedAt: now,
      note: note || 'Tiến hành soạn thảo lại hợp đồng sau khi phát sinh sự cố/từ chối. Chuyển về Chờ duyệt bản mềm.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '🔄 Yêu cầu soạn thảo lại hợp đồng',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đã được soạn thảo lại và chuyển về trạng thái CHỜ DUYỆT BẢN MỀM. Lý do: ${note || 'Soạn thảo lại sau khi từ chối/sự cố'}.`,
      contract.id,
      'Chờ duyệt bản mềm'
    );

    res.json(contract);
  });

  // Action: Reship Contract (Giao lại - quay về Chờ tạo vận đơn)
  app.post('/api/contracts/:id/reship', requireRole(['clerk', 'admin']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Chờ tạo vận đơn';
    contract.waybillCode = ''; // Reset mã vận đơn cũ để gán vận đơn mới
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Chờ tạo vận đơn',
      updatedBy: updatedBy || 'Văn thư',
      updatedAt: now,
      note: note || 'Yêu cầu giao lại bưu phẩm mới do sự cố bưu tá bưu cục cũ.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '📦 Giao lại hợp đồng (Tạo vận đơn mới)',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) gặp sự cố vận chuyển đã được chuyển về trạng thái CHỜ TẠO VẬN ĐƠN để văn thư tạo gửi lại.`,
      contract.id,
      'Chờ tạo vận đơn'
    );

    res.json(contract);
  });

  // Action: Cancel Contract (Đã hủy)
  app.post('/api/contracts/:id/cancel', requireRole(['legal', 'admin']), (req, res) => {
    const { updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    contract.status = 'Đã hủy';
    contract.lastActivityAt = now;
    contract.slaBreached = false;
    contract.slaBreachType = null;

    const audit: AuditLog = {
      id: Math.random().toString(36).substring(7),
      contractId: contract.id,
      fromStatus: oldStatus,
      toStatus: 'Đã hủy',
      updatedBy: updatedBy || 'Pháp chế',
      updatedAt: now,
      note: note || 'Quyết định hủy hợp đồng từ bộ phận thẩm quyền.'
    };
    contract.auditLog.push(audit);
    writeDb(db);

    notifyTeams(
      '🚫 ĐÃ HỦY HỢP ĐỒNG',
      `Hợp đồng "${contract.name}" (Số: ${contract.contractNumber}) đã chuyển sang trạng thái ĐÃ HỦY. Lý do: ${note || 'Hủy thủ công bởi Pháp chế'}.`,
      contract.id,
      'Đã hủy'
    );

    res.json(contract);
  });

  // Action: Edit Contract Metadata (Chỉnh sửa thủ công thông tin)
  app.put('/api/contracts/:id/edit', requireRole(['legal', 'admin']), (req, res) => {
    const { name, contractNumber, partnerName, value, signDate, effectiveDate, updatedBy, note } = req.body;
    const db = readDb();
    const contract = db.contracts.find((c) => c.id === req.params.id);
    if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

    const now = new Date().toISOString();
    
    // Ghi nhận các thay đổi vào log
    const changes: string[] = [];
    if (name && name !== contract.name) { changes.push(`Tên: "${contract.name}" -> "${name}"`); contract.name = name; }
    if (contractNumber && contractNumber !== contract.contractNumber) {
      if (contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại') {
        return res.status(400).json({ error: 'Không thể chỉnh sửa Mã hợp đồng sau khi đã chuyển tiếp sang các bước sau.' });
      }
      const exists = db.contracts.some((c) => c.id !== contract.id && c.contractNumber.toLowerCase() === contractNumber.toLowerCase().trim());
      if (exists) {
        return res.status(400).json({ error: `Mã hợp đồng "${contractNumber}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.` });
      }
      changes.push(`Số HĐ: "${contract.contractNumber}" -> "${contractNumber}"`);
      contract.contractNumber = contractNumber;
    }
    if (partnerName && partnerName !== contract.partnerName) { changes.push(`Đối tác: "${contract.partnerName}" -> "${partnerName}"`); contract.partnerName = partnerName; }
    if (value !== undefined && value !== contract.value) { changes.push(`Giá trị: ${contract.value}đ -> ${value}đ`); contract.value = value; }
    if (signDate && signDate !== contract.signDate) { changes.push(`Ngày ký: "${contract.signDate}" -> "${signDate}"`); contract.signDate = signDate; }
    if (effectiveDate && effectiveDate !== contract.effectiveDate) { changes.push(`Ngày hiệu lực: "${contract.effectiveDate}" -> "${effectiveDate}"`); contract.effectiveDate = effectiveDate; }

    if (changes.length > 0) {
      contract.lastActivityAt = now;
      const audit: AuditLog = {
        id: Math.random().toString(36).substring(7),
        contractId: contract.id,
        fromStatus: contract.status,
        toStatus: contract.status,
        updatedBy: updatedBy || 'Pháp chế',
        updatedAt: now,
        note: `Chỉnh sửa thủ công: ${changes.join(', ')}. ${note ? `Lý do: ${note}` : ''}`
      };
      contract.auditLog.push(audit);
      writeDb(db);

      writeLog('system', 'Pháp chế chỉnh sửa hợp đồng', `Đã chỉnh sửa hợp đồng "${contract.name}" (Số: ${contract.contractNumber}): ${changes.join(', ')}`);
    }

    res.json(contract);
  });

  // Action: Toggle Viettel Post API (Ngắt/bật kết nối)
  app.post('/api/settings/toggle-vtp', requireRole(['admin', 'clerk']), (req, res) => {
    const db = readDb();
    db.settings.vtpConnectionStatus = db.settings.vtpConnectionStatus === 'connected' ? 'disconnected' : 'connected';
    writeDb(db);
    
    const statusMsg = db.settings.vtpConnectionStatus === 'connected' ? 'CONNECTED (Đang kết nối)' : 'DISCONNECTED (Mất kết nối)';
    writeLog('system', 'Cập nhật kết nối Viettel Post API', `Cấu hình kết nối Viettel Post API đã được đổi sang: ${statusMsg}`);
    
    res.json({ vtpConnectionStatus: db.settings.vtpConnectionStatus });
  });

  // Viettel Post Webhook Receiver Endpoint
  app.post('/api/webhooks/vtp', (req, res) => {
    const { waybillCode, status, note, location } = req.body;
    if (!waybillCode || !status) {
      return res.status(400).json({ error: 'Mã vận đơn (waybillCode) và trạng thái (status) là bắt buộc' });
    }

    const db = readDb();
    
    // Check if Viettel Post integration is disconnected (Simulated Down)
    if (db.settings.vtpConnectionStatus === 'disconnected') {
      writeLog('system', '❌ Webhook VTP thất bại (Mất kết nối)', `Không thể xử lý cập nhật cho vận đơn ${waybillCode} do trạng thái API Viettel Post đang BỊ NGẮT KẾT NỐI.`);
      return res.status(503).json({ error: 'Viettel Post API Service Unavailable (Đang ngắt kết nối)' });
    }

    const contract = db.contracts.find((c) => c.waybillCode === waybillCode);
    if (!contract) {
      writeLog('system', 'Nhận Webhook VTP mồ côi', `Nhận mã vận đơn ${waybillCode} nhưng không tìm thấy hợp đồng tương ứng.`);
      return res.status(404).json({ error: 'Không tìm thấy hợp đồng ứng với mã vận đơn này' });
    }

    const now = new Date().toISOString();
    const oldStatus = contract.status;
    
    // Track status history from VTP
    contract.vtpStatusHistory.push({
      status,
      updatedAt: now,
      note: note || `Cập nhật bưu cục Viettel Post ${location || ''}`
    });

    let updated = false;

    // Map Viettel Post statuses to our State Machine
    if (status === 'PICKED_UP' && contract.status !== 'Đang giao') {
      contract.status = 'Đang giao';
      contract.picked_up_at = now;
      contract.lastActivityAt = now;
      contract.slaBreached = false;
      contract.slaBreachType = null;
      updated = true;

      contract.auditLog.push({
        id: Math.random().toString(36).substring(7),
        contractId: contract.id,
        fromStatus: oldStatus,
        toStatus: 'Đang giao',
        updatedBy: 'Viettel Post Webhook',
        updatedAt: now,
        note: `Viettel Post đã lấy hàng thành công tại văn phòng. Bắt đầu vận chuyển.`
      });

      notifyTeams(
        '🚚 Viettel Post đã nhận hàng',
        `Shipper Viettel Post đã nhận bưu phẩm cho hợp đồng "${contract.name}" (Vận đơn: ${waybillCode}). Trạng thái hiện tại: Đang giao hàng.`,
        contract.id,
        'Đang giao'
      );
    } else if (status === 'DELIVERED' && contract.status !== 'Chờ bản gửi lại') {
      contract.status = 'Chờ bản gửi lại';
      contract.delivered_at = now;
      contract.lastActivityAt = now;
      contract.slaBreached = false;
      contract.slaBreachType = null;
      updated = true;

      contract.auditLog.push({
        id: Math.random().toString(36).substring(7),
        contractId: contract.id,
        fromStatus: oldStatus,
        toStatus: 'Chờ bản gửi lại',
        updatedBy: 'Viettel Post Webhook',
        updatedAt: now,
        note: `Đối tác đã nhận được hợp đồng cứng. Đang chờ đối tác ký gửi lại bản scan/bản cứng bưu điện.`
      });

      notifyTeams(
        '📫 Giao hợp đồng thành công',
        `Viettel Post báo phát thành công hợp đồng "${contract.name}" đến tay đối tác (Vận đơn: ${waybillCode}). Chờ Văn thư tiếp nhận và số hóa bản khách gửi lại.`,
        contract.id,
        'Chờ bản gửi lại'
      );
    } else {
      // Just record audit log of mid-delivery status update
      contract.auditLog.push({
        id: Math.random().toString(36).substring(7),
        contractId: contract.id,
        fromStatus: contract.status,
        toStatus: contract.status,
        updatedBy: 'Viettel Post Webhook',
        updatedAt: now,
        note: `Cập nhật hành trình vận chuyển: Trạng thái VTP: ${status}. Chi tiết: ${note || ''} tại ${location || ''}`
      });
      updated = true;
    }

    if (updated) {
      writeDb(db);
    }

    writeLog('system', `Webhook Viettel Post xử lý thành công`, `Mã: ${waybillCode}, Trạng thái mới: ${status}`);
    res.json({ success: true, contract });
  });

  // Simulator Endpoint to trigger VTP Webhook easily from frontend UI
  app.post('/api/sim/vtp-webhook', async (req, res) => {
    const { waybillCode, status, note, location } = req.body;
    
    // Call the actual webhook logic internally
    try {
      const db = readDb();

      // Check if Viettel Post integration is disconnected
      if (db.settings.vtpConnectionStatus === 'disconnected') {
        return res.status(503).json({ error: 'Mô phỏng thất bại: Kết nối API Viettel Post hiện đang bị ngắt kết nối (Simulated Down).' });
      }

      const contract = db.contracts.find((c) => c.waybillCode === waybillCode);
      if (!contract) {
        return res.status(404).json({ error: `Không tìm thấy mã vận đơn ${waybillCode}` });
      }

      // We make a loopback-like request internally or directly call VTP handler logic
      const now = new Date().toISOString();
      const oldStatus = contract.status;
      
      contract.vtpStatusHistory.push({
        status,
        updatedAt: now,
        note: note || `Cập nhật giả lập bưu cục VTP ${location || ''}`
      });

      let stateChanged = false;

      if (status === 'PICKED_UP' && contract.status === 'Chờ shipper đến lấy') {
        contract.status = 'Đang giao';
        contract.picked_up_at = now;
        contract.lastActivityAt = now;
        contract.slaBreached = false;
        contract.slaBreachType = null;
        stateChanged = true;

        contract.auditLog.push({
          id: Math.random().toString(36).substring(7),
          contractId: contract.id,
          fromStatus: oldStatus,
          toStatus: 'Đang giao',
          updatedBy: 'VTP Webhook (Giả lập)',
          updatedAt: now,
          note: `[GIẢ LẬP WEBHOOK] Shipper Viettel Post đã qua văn phòng lấy hàng. Mã vận đơn: ${waybillCode}.`
        });

        notifyTeams(
          '🚚 [Giả lập Webhook] Viettel Post nhận hàng',
          `Shipper Viettel Post đã nhận hàng hợp đồng: "${contract.name}" (Mã vận đơn: ${waybillCode}).`,
          contract.id,
          'Đang giao'
        );
      } else if (status === 'DELIVERED' && contract.status === 'Đang giao') {
        contract.status = 'Chờ bản gửi lại';
        contract.delivered_at = now;
        contract.lastActivityAt = now;
        contract.slaBreached = false;
        contract.slaBreachType = null;
        stateChanged = true;

        contract.auditLog.push({
          id: Math.random().toString(36).substring(7),
          contractId: contract.id,
          fromStatus: oldStatus,
          toStatus: 'Chờ bản gửi lại',
          updatedBy: 'VTP Webhook (Giả lập)',
          updatedAt: now,
          note: `[GIẢ LẬP WEBHOOK] Đối tác đã ký nhận thành công bưu phẩm hợp đồng vật lý.`
        });

        notifyTeams(
          '📫 [Giả lập Webhook] Phát hàng thành công',
          `Bưu cục báo giao thành công hợp đồng: "${contract.name}". Hệ thống chuyển sang trạng thái chờ nhận bản đối tác ký gửi lại.`,
          contract.id,
          'Chờ bản gửi lại'
        );
      } else {
        // Simple mid delivery update
        contract.auditLog.push({
          id: Math.random().toString(36).substring(7),
          contractId: contract.id,
          fromStatus: contract.status,
          toStatus: contract.status,
          updatedBy: 'VTP Webhook (Giả lập)',
          updatedAt: now,
          note: `[GIẢ LẬP WEBHOOK] Hành trình: ${status} (${note || 'Di chuyển qua bưu cục trung chuyển'}).`
        });
        stateChanged = true;
      }

      if (stateChanged) {
        writeDb(db);
      }

      writeLog('system', 'Giả lập Webhook VTP đã kích hoạt', `Vận đơn: ${waybillCode}, Hành trình: ${status}`);
      res.json({ success: true, contract });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin settings reports & analytics api
  app.get('/api/dashboard/reports', (req, res) => {
    const db = readDb();
    const contracts = db.contracts;

    // 1. Status distribution
    const statusCounts: Record<Contract['status'], number> = {
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
      'Đã hủy': 0
    };

    contracts.forEach((c) => {
      if (statusCounts[c.status] !== undefined) {
        statusCounts[c.status]++;
      }
    });

    // 2. Average times (in hours)
    let totalUploadToPrintHours = 0;
    let countUploadToPrint = 0;

    let totalPrintToSignHours = 0;
    let countPrintToSign = 0;

    let totalCycleHours = 0;
    let countCycle = 0;

    contracts.forEach((c) => {
      if (c.uploaded_at && c.printed_at) {
        const diff = new Date(c.printed_at).getTime() - new Date(c.uploaded_at).getTime();
        totalUploadToPrintHours += diff / (1000 * 60 * 60);
        countUploadToPrint++;
      }
      if (c.printed_at && c.signed_at) {
        const diff = new Date(c.signed_at).getTime() - new Date(c.printed_at).getTime();
        totalPrintToSignHours += diff / (1000 * 60 * 60);
        countPrintToSign++;
      }
      if (c.uploaded_at && c.archived_at) {
        const diff = new Date(c.archived_at).getTime() - new Date(c.uploaded_at).getTime();
        totalCycleHours += diff / (1000 * 60 * 60);
        countCycle++;
      }
    });

    const avgUploadToPrint = countUploadToPrint ? (totalUploadToPrintHours / countUploadToPrint).toFixed(1) : '0.0';
    const avgPrintToSign = countPrintToSign ? (totalPrintToSignHours / countPrintToSign).toFixed(1) : '0.0';
    const avgTotalCycle = countCycle ? (totalCycleHours / countCycle).toFixed(1) : '0.0';

    // 3. List of overdue contracts
    const overdueContracts = contracts.filter((c) => c.slaBreached);

    res.json({
      statusCounts,
      averages: {
        avgUploadToPrintHours: parseFloat(avgUploadToPrint),
        avgPrintToSignHours: parseFloat(avgPrintToSign),
        avgTotalCycleHours: parseFloat(avgTotalCycle)
      },
      overdueContracts
    });
  });

  // Serve Frontend / Vite Middleware
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running in ${isProd ? 'production' : 'development'} on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting the unified server', err);
});
