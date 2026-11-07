# SCHEMA.md - Database Schema & Data Models Specification

Tài liệu này đặc tả chi tiết kiến trúc dữ liệu của **Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI**, phục vụ việc chuyển đổi từ cấu trúc JSON File Engine (`/data/database.json`) sang **PostgreSQL (Drizzle ORM)** cho môi trường Production thực thụ.

---

## 1. Sơ Đồ Thực Thể Quan Hệ (ERD - PostgreSQL 3NF)

```
       +-----------------------+              +-----------------------+
       |         USERS         |              |       SETTINGS        |
       |-----------------------|              |-----------------------|
       | * id (PK)             |              | * id (PK)             |
       | * email (UK)          |              |   sla_internal_hours  |
       |   role                |              |   default_base_pay... |
       |   name                |              |   sla_printing_hours  |
       +-----------+-----------+              |   teams_webhook_url   |
                   |                          +-----------------------+
                   | (assigned / requested)
                   v
       +--------------------------------------------------------------+
       |                          CONTRACTS                           |
       |--------------------------------------------------------------|
       | * id (PK)                                                    |
       | * contract_number (UK)                                       |
       |   name, partner_name, value, sign_date, effective_date       |
       |   status (8 main states + 3 exception states)                |
       |   processing_method ('physical' | 'digital'), print_copies   |
       |   requested_by, assigned_to (FK -> USERS.email)              |
       |   urgency_level, urgency_coef, drafting_instructions         |
       |   base_pay, punctual_coef, quality_coef, calculated_payroll   |
       |   receiver_name, receiver_phone, receiver_address            |
       |   waybill_code, sla_breached, sla_breach_type                |
       |   requested_at, deadline, draft_submitted_at, printed_at...  |
       +-----------+---------------------+--------------------+-------+
                   | 1:N                 | 1:N                | 1:N
                   v                     v                    v
+------------------------+  +------------------------+  +---------------------+
|     CONTRACT_FILES     |  |   CONTRACT_AUDIT_LOGS  |  |  VTP_TRACK_HISTORY  |
|------------------------|  |------------------------|  |---------------------|
| * id (PK)              |  | * id (PK)              |  | * id (PK)           |
| * contract_id (FK)     |  | * contract_id (FK)     |  | * contract_id (FK)  |
|   name, type, mime     |  |   from_status          |  |   status, note      |
|   file_path, size      |  |   to_status, note      |  |   location          |
|   uploaded_by, at      |  |   updated_by, at       |  |   updated_at        |
+------------------------+  +------------------------+  +---------------------+
```

---

## 2. Đặc Tả Drizzle ORM Schema (TypeScript)

Khi chuyển sang stack thực tế với TypeScript và Drizzle ORM, schema được định nghĩa trong file `src/db/schema.ts`:

```typescript
import { pgTable, varchar, text, integer, numeric, boolean, timestamp, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 32 }).notNull().$type<'admin' | 'legal' | 'clerk' | 'requester'>(),
  name: varchar('name', { length: 255 }),
  avatar: varchar('avatar', { length: 512 }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 2. Settings Table
export const settings = pgTable('settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('global_default'),
  slaInternalHours: integer('sla_internal_hours').default(2).notNull(),
  slaViettelPostDays: integer('sla_viettel_post_days').default(3).notNull(),
  
  // Base Pay Defaults (VND)
  defaultBasePayLegal: bigint('default_base_pay_legal', { mode: 'number' }).default(500000).notNull(),
  defaultBasePayClerk: bigint('default_base_pay_clerk', { mode: 'number' }).default(100000).notNull(),

  // Clerk SLA Limits
  slaPrintingHours: integer('sla_printing_hours').default(2).notNull(),
  slaCourierHours: integer('sla_courier_hours').default(4).notNull(),
  slaRetrievalDays: integer('sla_retrieval_days').default(7).notNull(),

  // SLA Timeliness Rates (%)
  slaEarlyMaxRate: integer('sla_early_max_rate').default(30).notNull(),
  slaEarlyMidRate: integer('sla_early_mid_rate').default(20).notNull(),
  slaEarlyMinRate: integer('sla_early_min_rate').default(10).notNull(),
  slaOnTimeRate: integer('sla_on_time_rate').default(0).notNull(),
  slaLateMinRate: integer('sla_late_min_rate').default(-10).notNull(),
  slaLateMidRate: integer('sla_late_mid_rate').default(-20).notNull(),
  slaLateMaxRate: integer('sla_late_max_rate').default(-30).notNull(),

  // Time Threshold Percentages
  slaEarlyMaxTimePct: integer('sla_early_max_time_pct').default(50).notNull(),
  slaEarlyMidTimePct: integer('sla_early_mid_time_pct').default(25).notNull(),
  slaEarlyMinTimePct: integer('sla_early_min_time_pct').default(5).notNull(),
  slaLateMinHours: integer('sla_late_min_hours').default(2).notNull(),
  slaLateMidHours: integer('sla_late_mid_hours').default(6).notNull(),

  // Quality / Feedback Rates (%)
  feedback0Rate: integer('feedback_0_rate').default(0).notNull(),
  feedback1Rate: integer('feedback_1_rate').default(-10).notNull(),
  feedback2Rate: integer('feedback_2_rate').default(-20).notNull(),
  feedback3Rate: integer('feedback_3_rate').default(-30).notNull(),

  // Integration Endpoints
  teamsWebhookUrl: text('teams_webhook_url').default(''),
  teamsPayloadTemplate: text('teams_payload_template').default(''),
  aiExtractEndpoint: text('ai_extract_endpoint').default(''),
  aiExtractPayloadTemplate: text('ai_extract_payload_template').default(''),
  googleDriveFolderId: varchar('google_drive_folder_id', { length: 255 }).default('root/contracts_backup_folder'),
  vtpConnectionStatus: varchar('vtp_connection_status', { length: 32 }).default('connected').$type<'connected' | 'disconnected'>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 3. Contracts Table
export const contracts = pgTable('contracts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractNumber: varchar('contract_number', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 500 }).notNull(),
  partnerName: varchar('partner_name', { length: 500 }).notNull(),
  value: varchar('value', { length: 100 }).default('0 VND'),
  signDate: varchar('sign_date', { length: 32 }),
  effectiveDate: varchar('effective_date', { length: 32 }),
  
  // Status
  status: varchar('status', { length: 64 }).notNull().default('Chờ duyệt bản mềm'),
  processingMethod: varchar('processing_method', { length: 32 }).default('physical').$type<'physical' | 'digital'>(),
  printCopies: integer('print_copies').default(2),

  // Assigned Staff & Request Info
  requestedBy: varchar('requested_by', { length: 255 }),
  assignedTo: varchar('assigned_to', { length: 255 }),
  urgencyLevel: varchar('urgency_level', { length: 32 }).default('normal').$type<'normal' | 'priority' | 'urgent' | 'emergency'>(),
  urgencyCoef: numeric('urgency_coef', { precision: 5, scale: 2 }).default('0.00'),
  draftingInstructions: text('drafting_instructions'),
  googleDocsLink: text('google_docs_link'),

  // Logistics & Receiver
  receiverName: varchar('receiver_name', { length: 255 }),
  receiverPhone: varchar('receiver_phone', { length: 50 }),
  receiverAddress: text('receiver_address'),
  deliveryNotes: text('delivery_notes'),
  waybillCode: varchar('waybill_code', { length: 100 }).default(''),

  // SLA & Payroll Engine Results
  basePay: bigint('base_pay', { mode: 'number' }).default(500000),
  punctualCoef: numeric('punctual_coef', { precision: 5, scale: 2 }).default('0.00'),
  qualityCoef: numeric('quality_coef', { precision: 5, scale: 2 }).default('0.00'),
  calculatedPayroll: bigint('calculated_payroll', { mode: 'number' }).default(0),
  feedbackCount: integer('feedback_count').default(0),
  isPunctual: boolean('is_punctual'),

  // SLA Timestamps
  requestedAt: timestamp('requested_at', { withTimezone: true }),
  deadline: timestamp('deadline', { withTimezone: true }),
  draftSubmittedAt: timestamp('draft_submitted_at', { withTimezone: true }),
  softApprovedAt: timestamp('soft_approved_at', { withTimezone: true }),
  printedAt: timestamp('printed_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  waybillCreatedAt: timestamp('waybill_created_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  receivedBackAt: timestamp('received_back_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),

  // Breaches
  slaBreached: boolean('sla_breached').default(false),
  slaBreachType: varchar('sla_breach_type', { length: 32 }).$type<'internal' | 'viettelpost' | null>(),
  physicalNotes: text('physical_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 4. Contract Files Table
export const contractFiles = pgTable('contract_files', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 500 }).notNull(),
  type: varchar('type', { length: 32 }).notNull().$type<'original' | 'scan' | 'attachment'>(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
  size: bigint('size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
});

// 5. Contract Audit Logs Table
export const contractAuditLogs = pgTable('contract_audit_logs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 64 }),
  toStatus: varchar('to_status', { length: 64 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  note: text('note').notNull(),
});

// 6. Relations
export const contractsRelations = relations(contracts, ({ many }) => ({
  files: many(contractFiles),
  auditLogs: many(contractAuditLogs),
}));

export const contractFilesRelations = relations(contractFiles, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractFiles.contractId],
    references: [contracts.id],
  }),
}));

export const contractAuditLogsRelations = relations(contractAuditLogs, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractAuditLogs.contractId],
    references: [contracts.id],
  }),
}));
```

---

## 3. Từ Điển Dữ Liệu & Quy Tắc Ràng Buộc (Data Dictionary)

### 3.1. Các Trạng Thái Hợp Đồng Hợp Lệ (`contracts.status`)
| Mã Trạng Thái | Ý Nghĩa Nghiệp Vụ | Vai Trò Chịu Trách Nhiệm |
|---|---|---|
| `Chờ soạn thảo` | Task vừa được giao cho Legal, chờ Legal bắt đầu soạn thảo | Legal |
| `Chờ duyệt bản mềm` | Legal đã tải draft (.docx/Google Docs), chờ Ban Giám Đốc duyệt | Admin / Lãnh đạo |
| `Chờ in` | Bản mềm đã duyệt, chờ Văn thư in bản cứng | Clerk (Văn thư) |
| `Đang chờ ký` | Bản cứng đã in xong, đang trình Lãnh đạo ký tay đóng dấu | Ban Giám Đốc |
| `Chờ tạo vận đơn` | Đã ký đóng dấu, chờ Văn thư tạo bưu gửi Viettel Post | Clerk (Văn thư) |
| `Chờ shipper đến lấy` | Đã có mã bưu gửi Viettel Post, chờ bưu tá qua bốc hàng | Viettel Post |
| `Đang giao` | Bưu tá đã lấy hàng, bưu phẩm đang trên đường vận chuyển | Viettel Post |
| `Chờ bản gửi lại` | Đối tác đã nhận hàng; chờ đối tác ký gửi lại bản cứng/scan | Clerk (Văn thư) |
| `Hoàn tất` | Đã đính kèm bản scan lưu trữ số hóa, khép kín 100% vòng đời | Hệ thống / Lưu trữ |
| `Bị từ chối ký` | Đối tác từ chối ký do bất đồng điều khoản | Ngoại lệ / Legal |
| `Sự cố vận chuyển` | Bưu phẩm bị mất, rách, ướt hỏng dọc đường | Ngoại lệ / Clerk |
| `Đã hủy` | Hợp đồng bị hủy bởi cấp thẩm quyền | Ngoại lệ / Admin |

### 3.2. Mức Độ Gấp & Hệ Số Khẩn Cấp (`contracts.urgency_level`)
- `normal` (+0%): Hạn chót $\ge 24$ giờ.
- `priority` (+10%): Hạn chót trong ngày $\ge 3$ giờ.
- `urgent` (+20%): Hạn chót gấp $< 3$ giờ.
- `emergency` (+30%): Khẩn cấp $\le 1$ giờ hoặc ngoài giờ làm việc.

---

## 4. Ma Trận Chuyển Đổi Dữ Liệu (JSON ➔ SQL Mapping)

Khi chạy script `npm run migrate:json-to-pg`:
- `database.json -> contracts[i].files[]` ➔ Tách thành các bản ghi riêng trong bảng `contract_files` với khóa ngoại `contract_id = contracts.id`.
- `database.json -> contracts[i].auditLog[]` ➔ Tách thành các bản ghi riêng trong bảng `contract_audit_logs`.
- `database.json -> contracts[i].feedback_history[]` ➔ Tách vào bảng `contract_feedback_history`.
- `database.json -> contracts[i].vtpStatusHistory[]` ➔ Tách vào bảng `vtp_tracking_history`.
- `database.json -> settings` ➔ Nạp vào bảng `settings` với khóa chính `id = 'global_default'`.
- `database.json -> settings.users[]` ➔ Nạp vào bảng `users`.
- `data/logs.json` ➔ Nạp vào bảng `sim_logs`.
