-- =============================================================================
-- POSTGRESQL PRODUCTION INITIALIZATION SCHEMA (init-db.sql)
-- Hệ thống Quản lý Hợp đồng Nội bộ & Tính Lương SLA/KPI
-- Đồng bộ với Drizzle ORM schema tại server/db/schema.ts
-- =============================================================================

CREATE TABLE IF NOT EXISTS "users" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "email" varchar(255) NOT NULL UNIQUE,
    "name" varchar(255),
    "role" varchar(32) NOT NULL CHECK (role IN ('admin', 'legal', 'clerk')),
    "password_hash" text,
    "status" varchar(32) DEFAULT 'invited' NOT NULL,
    "auth_version" integer DEFAULT 1 NOT NULL,
    "invited_at" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "sid" varchar(255) PRIMARY KEY NOT NULL,
    "sess" jsonb NOT NULL,
    "expire" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_sessions_expire" ON "sessions" ("expire");

CREATE TABLE IF NOT EXISTS "authTokens" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "user_id" varchar(64) NOT NULL REFERENCES "users"("id"),
    "type" varchar(32) NOT NULL,
    "token_hash" text NOT NULL UNIQUE,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "authRateLimits" (
    "key" varchar(255) PRIMARY KEY NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "settings" (
    "id" varchar(64) PRIMARY KEY DEFAULT 'global_default' NOT NULL,
    "default_base_pay_legal" bigint DEFAULT 500000 NOT NULL,
    "default_base_pay_clerk" bigint DEFAULT 100000 NOT NULL,
    "sla_internal_hours" integer DEFAULT 24 NOT NULL,
    "sla_viettel_post_days" integer DEFAULT 3 NOT NULL,
    "sla_printing_hours" integer DEFAULT 2 NOT NULL,
    "sla_courier_hours" integer DEFAULT 4 NOT NULL,
    "sla_retrieval_days" integer DEFAULT 7 NOT NULL,
    "sla_early_max_rate" integer DEFAULT 30 NOT NULL,
    "sla_early_mid_rate" integer DEFAULT 20 NOT NULL,
    "sla_early_min_rate" integer DEFAULT 10 NOT NULL,
    "sla_on_time_rate" integer DEFAULT 0 NOT NULL,
    "sla_late_min_rate" integer DEFAULT -10 NOT NULL,
    "sla_late_mid_rate" integer DEFAULT -20 NOT NULL,
    "sla_late_max_rate" integer DEFAULT -30 NOT NULL,
    "sla_early_max_time_pct" integer DEFAULT 50 NOT NULL,
    "sla_early_mid_time_pct" integer DEFAULT 25 NOT NULL,
    "sla_early_min_time_pct" integer DEFAULT 10 NOT NULL,
    "urgency_emergency_max_hours" integer DEFAULT 1 NOT NULL,
    "urgency_urgent_before_hours" integer DEFAULT 3 NOT NULL,
    "urgency_priority_before_hours" integer DEFAULT 24 NOT NULL,
    "urgency_emergency_rate" integer DEFAULT 30 NOT NULL,
    "urgency_urgent_rate" integer DEFAULT 20 NOT NULL,
    "urgency_priority_rate" integer DEFAULT 10 NOT NULL,
    "quality_zero_rate" integer DEFAULT 0 NOT NULL,
    "quality_one_rate" integer DEFAULT -10 NOT NULL,
    "quality_two_rate" integer DEFAULT -20 NOT NULL,
    "quality_three_plus_rate" integer DEFAULT -30 NOT NULL,
    "clerk_print_threshold_p1" integer DEFAULT 50 NOT NULL,
    "clerk_print_threshold_p2" integer DEFAULT 75 NOT NULL,
    "clerk_print_threshold_p3" integer DEFAULT 100 NOT NULL,
    "clerk_print_threshold_p4" integer DEFAULT 150 NOT NULL,
    "clerk_print_threshold_p5" integer DEFAULT 200 NOT NULL,
    "clerk_courier_threshold_p1" integer DEFAULT 50 NOT NULL,
    "clerk_courier_threshold_p2" integer DEFAULT 100 NOT NULL,
    "clerk_retrieval_threshold_p1" integer DEFAULT 50 NOT NULL,
    "clerk_retrieval_threshold_p2" integer DEFAULT 100 NOT NULL,
    "teams_webhook_url" text,
    "teams_payload_template" text,
    "google_drive_folder_id" text,
    "vtp_connection_status" varchar(32) DEFAULT 'disconnected' NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_by" varchar(64),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "settingsVersions" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "version" integer NOT NULL,
    "policy_snapshot" jsonb NOT NULL,
    "created_by" varchar(64),
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contracts" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_number" varchar(100) NOT NULL,
    "name" varchar(500) NOT NULL,
    "partner_name" varchar(500) NOT NULL,
    "value_text" varchar(255) NOT NULL,
    "value_amount" numeric(20, 2),
    "currency" varchar(16) DEFAULT 'VND',
    "value_kind" varchar(32) DEFAULT 'total',
    "status" varchar(64) NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "processing_method" varchar(32) DEFAULT 'physical' NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
    "status_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
    "status_due_at" timestamp with time zone,
    "stage_instance_id" varchar(64),
    "requires_review" boolean DEFAULT false NOT NULL,
    "soft_approved_at" timestamp with time zone,
    "digital_ready_at" timestamp with time zone,
    "printed_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "waybill_created_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "received_back_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "sla_breached" boolean DEFAULT false NOT NULL,
    "sla_breach_type" varchar(32),
    "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" varchar(64) REFERENCES "users"("id"),
    "owner_id" varchar(64) REFERENCES "users"("id"),
    "legal_assignee_id" varchar(64) REFERENCES "users"("id"),
    "clerk_assignee_id" varchar(64) REFERENCES "users"("id"),
    "current_revision_id" varchar(64),
    "current_cycle_id" varchar(64),
    "current_shipment_id" varchar(64),
    "google_docs_link" text,
    "receiver_name" varchar(255),
    "receiver_phone" varchar(50),
    "receiver_address" text,
    "delivery_notes" text,
    "print_copies" integer DEFAULT 1,
    "drafting_instructions" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_contracts_number_lower" ON "contracts" (lower("contract_number"));
CREATE INDEX IF NOT EXISTS "idx_contracts_status" ON "contracts" ("status");
CREATE INDEX IF NOT EXISTS "idx_contracts_uploaded_at" ON "contracts" ("uploaded_at");

CREATE TABLE IF NOT EXISTS "contractCycles" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_number" integer NOT NULL,
    "type" varchar(32) DEFAULT 'initial' NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "approved_at" timestamp with time zone,
    "current_revision_id" varchar(64)
);

CREATE TABLE IF NOT EXISTS "contractRevisions" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_id" varchar(64) NOT NULL REFERENCES "contractCycles"("id"),
    "revision_number" integer NOT NULL,
    "file_id" varchar(64),
    "docs_url" text,
    "content_hash" varchar(64),
    "submitted_by" varchar(64) NOT NULL REFERENCES "users"("id"),
    "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "approved_by" varchar(64) REFERENCES "users"("id"),
    "approved_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "contractFiles" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) REFERENCES "contracts"("id"),
    "revision_id" varchar(64),
    "cycle_id" varchar(64),
    "type" varchar(32) NOT NULL,
    "name" varchar(500) NOT NULL,
    "storage_key" varchar(255) NOT NULL UNIQUE,
    "detected_mime" varchar(128) NOT NULL,
    "size" integer NOT NULL,
    "sha256" varchar(64) NOT NULL,
    "availability" varchar(32) DEFAULT 'present' NOT NULL,
    "uploaded_by" varchar(64) REFERENCES "users"("id"),
    "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contractAuditLogs" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_id" varchar(64),
    "action" varchar(64) NOT NULL,
    "from_status" varchar(64),
    "to_status" varchar(64) NOT NULL,
    "actor_kind" varchar(32) DEFAULT 'user' NOT NULL,
    "actor_id" varchar(64),
    "actor_name" varchar(255),
    "actor_email" varchar(255),
    "request_id" varchar(64),
    "reason" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contractFeedbackHistory" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_id" varchar(64),
    "revision_id" varchar(64),
    "actor_id" varchar(64) REFERENCES "users"("id"),
    "note" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contractPhysicalEvents" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_id" varchar(64),
    "step" varchar(64) NOT NULL,
    "note" text NOT NULL,
    "actor_id" varchar(64) REFERENCES "users"("id"),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contractIdentifiers" (
    "code" varchar(100) PRIMARY KEY NOT NULL,
    "kind" varchar(32) NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "uploads" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "owner_id" varchar(64) NOT NULL REFERENCES "users"("id"),
    "storage_key" varchar(255) NOT NULL UNIQUE,
    "hash" varchar(64) NOT NULL,
    "detected_mime" varchar(128) NOT NULL,
    "size" integer NOT NULL,
    "extraction_status" varchar(32) DEFAULT 'not_configured' NOT NULL,
    "suggestions" jsonb,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_contract_id" varchar(64),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workItems" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "kind" varchar(32) NOT NULL,
    "assignee_id" varchar(64) REFERENCES "users"("id"),
    "payable" boolean DEFAULT true NOT NULL,
    "policy_snapshot" jsonb NOT NULL,
    "base_pay_snapshot" bigint NOT NULL,
    "deadline" timestamp with time zone,
    "started_at" timestamp with time zone,
    "state" varchar(32) DEFAULT 'open' NOT NULL,
    "source_cycle_id" varchar(64),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payrollEntries" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "work_item_id" varchar(64) NOT NULL UNIQUE REFERENCES "workItems"("id"),
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "beneficiary_id" varchar(64) NOT NULL REFERENCES "users"("id"),
    "finalized_by" varchar(64) NOT NULL REFERENCES "users"("id"),
    "finalized_at" timestamp with time zone DEFAULT now() NOT NULL,
    "engine_version" varchar(32) DEFAULT '1.0' NOT NULL,
    "input_snapshot" jsonb NOT NULL,
    "coef_breakdown" jsonb NOT NULL,
    "amount_vnd" bigint NOT NULL,
    "policy_snapshot" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payrollAdjustments" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "entry_id" varchar(64) NOT NULL REFERENCES "payrollEntries"("id"),
    "delta_vnd" bigint NOT NULL,
    "reason" text NOT NULL,
    "idempotency_key" varchar(128) NOT NULL UNIQUE,
    "created_by" varchar(64) NOT NULL REFERENCES "users"("id"),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clerkIncidents" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "work_item_id" varchar(64) REFERENCES "workItems"("id"),
    "description" text NOT NULL,
    "responsible_id" varchar(64) REFERENCES "users"("id"),
    "recorded_by" varchar(64) NOT NULL REFERENCES "users"("id"),
    "confirmed_by" varchar(64) REFERENCES "users"("id"),
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shipments" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "cycle_id" varchar(64),
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "provider" varchar(32) DEFAULT 'viettelpost' NOT NULL,
    "waybill_code" varchar(100),
    "status" varchar(64) DEFAULT 'created' NOT NULL,
    "manual_created" boolean DEFAULT true NOT NULL,
    "external_request_key" varchar(128),
    "superseded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vtpTrackingHistory" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "shipment_id" varchar(64) NOT NULL REFERENCES "shipments"("id"),
    "provider_event_id" varchar(128) NOT NULL UNIQUE,
    "raw_status" varchar(64) NOT NULL,
    "normalized_status" varchar(64) NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "received_at" timestamp with time zone DEFAULT now() NOT NULL,
    "note" text,
    "location" varchar(255)
);

CREATE TABLE IF NOT EXISTS "integrationInbox" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "provider" varchar(32) NOT NULL,
    "dedupe_key" varchar(255) NOT NULL UNIQUE,
    "payload" jsonb NOT NULL,
    "state" varchar(32) DEFAULT 'received' NOT NULL,
    "reason" text,
    "received_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "outboxJobs" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "event_type" varchar(64) NOT NULL,
    "aggregate_id" varchar(64) NOT NULL,
    "dedupe_key" varchar(255) NOT NULL UNIQUE,
    "payload" jsonb NOT NULL,
    "state" varchar(32) DEFAULT 'queued' NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
    "locked_until" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_outbox_state_next_run" ON "outboxJobs" ("state", "next_run_at");

CREATE TABLE IF NOT EXISTS "integrationFileBackups" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "file_id" varchar(64) NOT NULL REFERENCES "contractFiles"("id"),
    "provider" varchar(32) DEFAULT 'google_drive' NOT NULL,
    "remote_id" varchar(255),
    "checksum" varchar(64),
    "status" varchar(32) DEFAULT 'pending' NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_file_provider_backup" ON "integrationFileBackups" ("file_id", "provider");

CREATE TABLE IF NOT EXISTS "slaAlerts" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "contract_id" varchar(64) NOT NULL REFERENCES "contracts"("id"),
    "stage_instance_id" varchar(64) NOT NULL,
    "rule_version" integer DEFAULT 1 NOT NULL,
    "cycle_id" varchar(64),
    "shipment_id" varchar(64),
    "deadline" timestamp with time zone NOT NULL,
    "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
    "resolved_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sla_alert_stage_rule" ON "slaAlerts" ("contract_id", "stage_instance_id", "rule_version");

CREATE TABLE IF NOT EXISTS "idempotencyRequests" (
    "actor_key" varchar(128) NOT NULL,
    "key" varchar(128) NOT NULL,
    "route" varchar(255) NOT NULL,
    "request_hash" varchar(64) NOT NULL,
    "state" varchar(32) DEFAULT 'pending' NOT NULL,
    "response_status" integer,
    "response_body" jsonb,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("actor_key", "key")
);

CREATE TABLE IF NOT EXISTS "systemAuditLogs" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "target" varchar(64) NOT NULL,
    "action" varchar(64) NOT NULL,
    "actor_id" varchar(64),
    "actor_name" varchar(255),
    "actor_email" varchar(255),
    "diff" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jsonImportRuns" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "source_path" text NOT NULL,
    "source_sha256" varchar(64) NOT NULL,
    "is_dry_run" boolean DEFAULT true NOT NULL,
    "counts" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jsonImportRecords" (
    "id" varchar(64) PRIMARY KEY NOT NULL,
    "run_id" varchar(64) NOT NULL REFERENCES "jsonImportRuns"("id"),
    "source_id" varchar(64) NOT NULL,
    "entity_type" varchar(32) NOT NULL,
    "target_id" varchar(64),
    "status" varchar(32) NOT NULL,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workerHeartbeats" (
    "worker_id" varchar(64) PRIMARY KEY NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "version" varchar(32) NOT NULL,
    "job_summary" jsonb
);
