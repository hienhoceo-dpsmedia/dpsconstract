import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  bigint,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Users
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 32 }).notNull(), // 'admin' | 'legal' | 'clerk'
  passwordHash: text('password_hash'),
  status: varchar('status', { length: 32 }).notNull().default('invited'), // 'invited' | 'active' | 'disabled'
  authVersion: integer('auth_version').notNull().default(1),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 2. Sessions (connect-pg-simple compatible)
export const sessions = pgTable('sessions', {
  sid: varchar('sid', { length: 255 }).primaryKey(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_sessions_expire').on(table.expire),
]);

// 3. Auth Tokens (Invite and Reset Tokens)
export const authTokens = pgTable('authTokens', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().references(() => users.id),
  type: varchar('type', { length: 32 }).notNull(), // 'invite' | 'reset'
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 4. Auth Rate Limits
export const authRateLimits = pgTable('authRateLimits', {
  key: varchar('key', { length: 255 }).primaryKey(),
  points: integer('points').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 5. Settings
export const settings = pgTable('settings', {
  id: varchar('id', { length: 64 }).primaryKey().default('global_default'),
  defaultBasePayLegal: bigint('default_base_pay_legal', { mode: 'number' }).notNull().default(500000),
  defaultBasePayClerk: bigint('default_base_pay_clerk', { mode: 'number' }).notNull().default(100000),
  slaInternalHours: integer('sla_internal_hours').notNull().default(24),
  slaViettelPostDays: integer('sla_viettel_post_days').notNull().default(3),
  slaPrintingHours: integer('sla_printing_hours').notNull().default(2),
  slaCourierHours: integer('sla_courier_hours').notNull().default(4),
  slaRetrievalDays: integer('sla_retrieval_days').notNull().default(7),
  slaEarlyMaxRate: integer('sla_early_max_rate').notNull().default(30),
  slaEarlyMidRate: integer('sla_early_mid_rate').notNull().default(20),
  slaEarlyMinRate: integer('sla_early_min_rate').notNull().default(10),
  slaOnTimeRate: integer('sla_on_time_rate').notNull().default(0),
  slaLateMinRate: integer('sla_late_min_rate').notNull().default(-10),
  slaLateMidRate: integer('sla_late_mid_rate').notNull().default(-20),
  slaLateMaxRate: integer('sla_late_max_rate').notNull().default(-30),
  slaEarlyMaxTimePct: integer('sla_early_max_time_pct').notNull().default(50),
  slaEarlyMidTimePct: integer('sla_early_mid_time_pct').notNull().default(25),
  slaEarlyMinTimePct: integer('sla_early_min_time_pct').notNull().default(10),
  urgencyEmergencyMaxHours: integer('urgency_emergency_max_hours').notNull().default(1),
  urgencyUrgentBeforeHours: integer('urgency_urgent_before_hours').notNull().default(3),
  urgencyPriorityBeforeHours: integer('urgency_priority_before_hours').notNull().default(24),
  urgencyEmergencyRate: integer('urgency_emergency_rate').notNull().default(30),
  urgencyUrgentRate: integer('urgency_urgent_rate').notNull().default(20),
  urgencyPriorityRate: integer('urgency_priority_rate').notNull().default(10),
  qualityZeroRate: integer('quality_zero_rate').notNull().default(0),
  qualityOneRate: integer('quality_one_rate').notNull().default(-10),
  qualityTwoRate: integer('quality_two_rate').notNull().default(-20),
  qualityThreePlusRate: integer('quality_three_plus_rate').notNull().default(-30),
  clerkPrintThresholdP1: integer('clerk_print_threshold_p1').notNull().default(50),
  clerkPrintThresholdP2: integer('clerk_print_threshold_p2').notNull().default(75),
  clerkPrintThresholdP3: integer('clerk_print_threshold_p3').notNull().default(100),
  clerkPrintThresholdP4: integer('clerk_print_threshold_p4').notNull().default(150),
  clerkPrintThresholdP5: integer('clerk_print_threshold_p5').notNull().default(200),
  clerkCourierThresholdP1: integer('clerk_courier_threshold_p1').notNull().default(50),
  clerkCourierThresholdP2: integer('clerk_courier_threshold_p2').notNull().default(100),
  clerkRetrievalThresholdP1: integer('clerk_retrieval_threshold_p1').notNull().default(50),
  clerkRetrievalThresholdP2: integer('clerk_retrieval_threshold_p2').notNull().default(100),
  teamsWebhookUrl: text('teams_webhook_url'),
  teamsPayloadTemplate: text('teams_payload_template'),
  googleDriveFolderId: text('google_drive_folder_id'),
  vtpConnectionStatus: varchar('vtp_connection_status', { length: 32 }).notNull().default('disconnected'),
  version: integer('version').notNull().default(1),
  updatedBy: varchar('updated_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 6. Settings Versions
export const settingsVersions = pgTable('settingsVersions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  version: integer('version').notNull(),
  policySnapshot: jsonb('policy_snapshot').notNull(),
  createdBy: varchar('created_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 7. Contracts Core Table
export const contracts = pgTable('contracts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractNumber: varchar('contract_number', { length: 100 }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  partnerName: varchar('partner_name', { length: 500 }).notNull(),
  valueText: varchar('value_text', { length: 255 }).notNull(),
  valueAmount: numeric('value_amount', { precision: 20, scale: 2 }),
  currency: varchar('currency', { length: 16 }).default('VND'),
  valueKind: varchar('value_kind', { length: 32 }).default('total'), // 'total' | 'recurring' | 'unit_price' | 'unknown'
  status: varchar('status', { length: 64 }).notNull(),
  version: integer('version').notNull().default(1),
  processingMethod: varchar('processing_method', { length: 32 }).notNull().default('physical'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
  statusDueAt: timestamp('status_due_at', { withTimezone: true }),
  stageInstanceId: varchar('stage_instance_id', { length: 64 }),
  requiresReview: boolean('requires_review').notNull().default(false),
  softApprovedAt: timestamp('soft_approved_at', { withTimezone: true }),
  digitalReadyAt: timestamp('digital_ready_at', { withTimezone: true }),
  printedAt: timestamp('printed_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  waybillCreatedAt: timestamp('waybill_created_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  receivedBackAt: timestamp('received_back_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  slaBreached: boolean('sla_breached').notNull().default(false),
  slaBreachType: varchar('sla_breach_type', { length: 32 }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 64 }).references(() => users.id),
  ownerId: varchar('owner_id', { length: 64 }).references(() => users.id),
  legalAssigneeId: varchar('legal_assignee_id', { length: 64 }).references(() => users.id),
  clerkAssigneeId: varchar('clerk_assignee_id', { length: 64 }).references(() => users.id),
  currentRevisionId: varchar('current_revision_id', { length: 64 }),
  currentCycleId: varchar('current_cycle_id', { length: 64 }),
  currentShipmentId: varchar('current_shipment_id', { length: 64 }),
  googleDocsLink: text('google_docs_link'),
  receiverName: varchar('receiver_name', { length: 255 }),
  receiverPhone: varchar('receiver_phone', { length: 50 }),
  receiverAddress: text('receiver_address'),
  deliveryNotes: text('delivery_notes'),
  printCopies: integer('print_copies').default(1),
  draftingInstructions: text('drafting_instructions'),
}, (table) => [
  uniqueIndex('idx_contracts_number_lower').on(sql`lower(${table.contractNumber})`),
  index('idx_contracts_status').on(table.status),
  index('idx_contracts_uploaded_at').on(table.uploadedAt),
]);

// 8. Contract Cycles
export const contractCycles = pgTable('contractCycles', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleNumber: integer('cycle_number').notNull(),
  type: varchar('type', { length: 32 }).notNull().default('initial'), // 'initial' | 'redraft'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  currentRevisionId: varchar('current_revision_id', { length: 64 }),
});

// 9. Contract Revisions
export const contractRevisions = pgTable('contractRevisions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleId: varchar('cycle_id', { length: 64 }).notNull().references(() => contractCycles.id),
  revisionNumber: integer('revision_number').notNull(),
  fileId: varchar('file_id', { length: 64 }),
  docsUrl: text('docs_url'),
  contentHash: varchar('content_hash', { length: 64 }),
  submittedBy: varchar('submitted_by', { length: 64 }).notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  approvedBy: varchar('approved_by', { length: 64 }).references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
});

// 10. Contract Files
export const contractFiles = pgTable('contractFiles', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).references(() => contracts.id),
  revisionId: varchar('revision_id', { length: 64 }),
  cycleId: varchar('cycle_id', { length: 64 }),
  type: varchar('type', { length: 32 }).notNull(), // 'original' | 'scan' | 'attachment'
  name: varchar('name', { length: 500 }).notNull(),
  storageKey: varchar('storage_key', { length: 255 }).notNull().unique(),
  detectedMime: varchar('detected_mime', { length: 128 }).notNull(),
  size: integer('size').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  availability: varchar('availability', { length: 32 }).notNull().default('present'), // 'present' | 'missing'
  uploadedBy: varchar('uploaded_by', { length: 64 }).references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

// 11. Contract Audit Logs (Append-Only)
export const contractAuditLogs = pgTable('contractAuditLogs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleId: varchar('cycle_id', { length: 64 }),
  action: varchar('action', { length: 64 }).notNull(),
  fromStatus: varchar('from_status', { length: 64 }),
  toStatus: varchar('to_status', { length: 64 }).notNull(),
  actorKind: varchar('actor_kind', { length: 32 }).notNull().default('user'), // 'user' | 'service' | 'legacy'
  actorId: varchar('actor_id', { length: 64 }),
  actorName: varchar('actor_name', { length: 255 }),
  actorEmail: varchar('actor_email', { length: 255 }),
  requestId: varchar('request_id', { length: 64 }),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 12. Contract Feedback History
export const contractFeedbackHistory = pgTable('contractFeedbackHistory', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleId: varchar('cycle_id', { length: 64 }),
  revisionId: varchar('revision_id', { length: 64 }),
  actorId: varchar('actor_id', { length: 64 }).references(() => users.id),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 13. Contract Physical Events
export const contractPhysicalEvents = pgTable('contractPhysicalEvents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleId: varchar('cycle_id', { length: 64 }),
  step: varchar('step', { length: 64 }).notNull(),
  note: text('note').notNull(),
  actorId: varchar('actor_id', { length: 64 }).references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 14. Contract Identifiers Registry
export const contractIdentifiers = pgTable('contractIdentifiers', {
  code: varchar('code', { length: 100 }).primaryKey(),
  kind: varchar('kind', { length: 32 }).notNull(), // 'id' | 'current_number' | 'legacy_number'
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 15. Uploads Staging
export const uploads = pgTable('uploads', {
  id: varchar('id', { length: 64 }).primaryKey(),
  ownerId: varchar('owner_id', { length: 64 }).notNull().references(() => users.id),
  storageKey: varchar('storage_key', { length: 255 }).notNull().unique(),
  hash: varchar('hash', { length: 64 }).notNull(),
  detectedMime: varchar('detected_mime', { length: 128 }).notNull(),
  size: integer('size').notNull(),
  extractionStatus: varchar('extraction_status', { length: 32 }).notNull().default('not_configured'),
  suggestions: jsonb('suggestions'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedContractId: varchar('consumed_contract_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 16. Work Items
export const workItems = pgTable('workItems', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  kind: varchar('kind', { length: 32 }).notNull(), // 'legal' | 'clerk'
  assigneeId: varchar('assignee_id', { length: 64 }).references(() => users.id),
  payable: boolean('payable').notNull().default(true),
  policySnapshot: jsonb('policy_snapshot').notNull(),
  basePaySnapshot: bigint('base_pay_snapshot', { mode: 'number' }).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  state: varchar('state', { length: 32 }).notNull().default('open'), // 'open' | 'finalized' | 'cancelled'
  sourceCycleId: varchar('source_cycle_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 17. Payroll Entries (Immutable)
export const payrollEntries = pgTable('payrollEntries', {
  id: varchar('id', { length: 64 }).primaryKey(),
  workItemId: varchar('work_item_id', { length: 64 }).notNull().unique().references(() => workItems.id),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  beneficiaryId: varchar('beneficiary_id', { length: 64 }).notNull().references(() => users.id),
  finalizedBy: varchar('finalized_by', { length: 64 }).notNull().references(() => users.id),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull().defaultNow(),
  engineVersion: varchar('engine_version', { length: 32 }).notNull().default('1.0'),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  coefBreakdown: jsonb('coef_breakdown').notNull(),
  amountVnd: bigint('amount_vnd', { mode: 'number' }).notNull(),
  policySnapshot: jsonb('policy_snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 18. Payroll Adjustments
export const payrollAdjustments = pgTable('payrollAdjustments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  entryId: varchar('entry_id', { length: 64 }).notNull().references(() => payrollEntries.id),
  deltaVnd: bigint('delta_vnd', { mode: 'number' }).notNull(),
  reason: text('reason').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  createdBy: varchar('created_by', { length: 64 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 19. Clerk Incidents
export const clerkIncidents = pgTable('clerkIncidents', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  workItemId: varchar('work_item_id', { length: 64 }).references(() => workItems.id),
  description: text('description').notNull(),
  responsibleId: varchar('responsible_id', { length: 64 }).references(() => users.id),
  recordedBy: varchar('recorded_by', { length: 64 }).notNull().references(() => users.id),
  confirmedBy: varchar('confirmed_by', { length: 64 }).references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 20. Shipments
export const shipments = pgTable('shipments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  cycleId: varchar('cycle_id', { length: 64 }),
  attemptNumber: integer('attempt_number').notNull().default(1),
  provider: varchar('provider', { length: 32 }).notNull().default('viettelpost'),
  waybillCode: varchar('waybill_code', { length: 100 }),
  status: varchar('status', { length: 64 }).notNull().default('created'),
  manualCreated: boolean('manual_created').notNull().default(true),
  externalRequestKey: varchar('external_request_key', { length: 128 }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 21. VTP Tracking History
export const vtpTrackingHistory = pgTable('vtpTrackingHistory', {
  id: varchar('id', { length: 64 }).primaryKey(),
  shipmentId: varchar('shipment_id', { length: 64 }).notNull().references(() => shipments.id),
  providerEventId: varchar('provider_event_id', { length: 128 }).notNull().unique(),
  rawStatus: varchar('raw_status', { length: 64 }).notNull(),
  normalizedStatus: varchar('normalized_status', { length: 64 }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  note: text('note'),
  location: varchar('location', { length: 255 }),
});

// 22. Integration Inbox
export const integrationInbox = pgTable('integrationInbox', {
  id: varchar('id', { length: 64 }).primaryKey(),
  provider: varchar('provider', { length: 32 }).notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  payload: jsonb('payload').notNull(),
  state: varchar('state', { length: 32 }).notNull().default('received'), // 'received' | 'verified' | 'processed' | 'failed'
  reason: text('reason'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

// 23. Outbox Jobs (Durable Execution)
export const outboxJobs = pgTable('outboxJobs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  payload: jsonb('payload').notNull(),
  state: varchar('state', { length: 32 }).notNull().default('queued'), // 'queued' | 'running' | 'succeeded' | 'retry' | 'awaiting_reconciliation' | 'dead' | 'skipped'
  attempts: integer('attempts').notNull().default(0),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_outbox_state_next_run').on(table.state, table.nextRunAt),
]);

// 24. Integration File Backups
export const integrationFileBackups = pgTable('integrationFileBackups', {
  id: varchar('id', { length: 64 }).primaryKey(),
  fileId: varchar('file_id', { length: 64 }).notNull().references(() => contractFiles.id),
  provider: varchar('provider', { length: 32 }).notNull().default('google_drive'),
  remoteId: varchar('remote_id', { length: 255 }),
  checksum: varchar('checksum', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_file_provider_backup').on(table.fileId, table.provider),
]);

// 25. SLA Alerts
export const slaAlerts = pgTable('slaAlerts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  contractId: varchar('contract_id', { length: 64 }).notNull().references(() => contracts.id),
  stageInstanceId: varchar('stage_instance_id', { length: 64 }).notNull(),
  ruleVersion: integer('rule_version').notNull().default(1),
  cycleId: varchar('cycle_id', { length: 64 }),
  shipmentId: varchar('shipment_id', { length: 64 }),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('idx_sla_alert_stage_rule').on(table.contractId, table.stageInstanceId, table.ruleVersion),
]);

// 26. Idempotency Requests
export const idempotencyRequests = pgTable('idempotencyRequests', {
  actorKey: varchar('actor_key', { length: 128 }).notNull(),
  key: varchar('key', { length: 128 }).notNull(),
  route: varchar('route', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  state: varchar('state', { length: 32 }).notNull().default('pending'), // 'pending' | 'completed' | 'failed'
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.actorKey, table.key] }),
]);

// 27. System Audit Logs
export const systemAuditLogs = pgTable('systemAuditLogs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  target: varchar('target', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  actorId: varchar('actor_id', { length: 64 }),
  actorName: varchar('actor_name', { length: 255 }),
  actorEmail: varchar('actor_email', { length: 255 }),
  diff: jsonb('diff'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 28. JSON Import Runs & Records (Ledger)
export const jsonImportRuns = pgTable('jsonImportRuns', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sourcePath: text('source_path').notNull(),
  sourceSha256: varchar('source_sha256', { length: 64 }).notNull(),
  isDryRun: boolean('is_dry_run').notNull().default(true),
  counts: jsonb('counts').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jsonImportRecords = pgTable('jsonImportRecords', {
  id: varchar('id', { length: 64 }).primaryKey(),
  runId: varchar('run_id', { length: 64 }).notNull().references(() => jsonImportRuns.id),
  sourceId: varchar('source_id', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 29. Worker Heartbeats
export const workerHeartbeats = pgTable('workerHeartbeats', {
  workerId: varchar('worker_id', { length: 64 }).primaryKey(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  version: varchar('version', { length: 32 }).notNull(),
  jobSummary: jsonb('job_summary'),
});

