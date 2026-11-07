CREATE TABLE "authRateLimits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "authTokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "authTokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "clerkIncidents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"work_item_id" varchar(64),
	"description" text NOT NULL,
	"responsible_id" varchar(64),
	"recorded_by" varchar(64) NOT NULL,
	"confirmed_by" varchar(64),
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractAuditLogs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "contractCycles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"cycle_number" integer NOT NULL,
	"type" varchar(32) DEFAULT 'initial' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"current_revision_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "contractFeedbackHistory" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"cycle_id" varchar(64),
	"revision_id" varchar(64),
	"actor_id" varchar(64),
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractFiles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64),
	"revision_id" varchar(64),
	"cycle_id" varchar(64),
	"type" varchar(32) NOT NULL,
	"name" varchar(500) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"detected_mime" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"availability" varchar(32) DEFAULT 'present' NOT NULL,
	"uploaded_by" varchar(64),
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contractFiles_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "contractIdentifiers" (
	"code" varchar(100) PRIMARY KEY NOT NULL,
	"kind" varchar(32) NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractPhysicalEvents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"cycle_id" varchar(64),
	"step" varchar(64) NOT NULL,
	"note" text NOT NULL,
	"actor_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractRevisions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"cycle_id" varchar(64) NOT NULL,
	"revision_number" integer NOT NULL,
	"file_id" varchar(64),
	"docs_url" text,
	"content_hash" varchar(64),
	"submitted_by" varchar(64) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" varchar(64),
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contracts" (
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
	"created_by" varchar(64),
	"owner_id" varchar(64),
	"legal_assignee_id" varchar(64),
	"clerk_assignee_id" varchar(64),
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
--> statement-breakpoint
CREATE TABLE "idempotencyRequests" (
	"actor_key" varchar(128) NOT NULL,
	"key" varchar(128) NOT NULL,
	"route" varchar(255) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"state" varchar(32) DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotencyRequests_actor_key_key_pk" PRIMARY KEY("actor_key","key")
);
--> statement-breakpoint
CREATE TABLE "integrationFileBackups" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"provider" varchar(32) DEFAULT 'google_drive' NOT NULL,
	"remote_id" varchar(255),
	"checksum" varchar(64),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrationInbox" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"state" varchar(32) DEFAULT 'received' NOT NULL,
	"reason" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrationInbox_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "jsonImportRecords" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"target_id" varchar(64),
	"status" varchar(32) NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jsonImportRuns" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"source_path" text NOT NULL,
	"source_sha256" varchar(64) NOT NULL,
	"is_dry_run" boolean DEFAULT true NOT NULL,
	"counts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outboxJobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"aggregate_id" varchar(64) NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"state" varchar(32) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outboxJobs_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "payrollAdjustments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"entry_id" varchar(64) NOT NULL,
	"delta_vnd" bigint NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payrollAdjustments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payrollEntries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"work_item_id" varchar(64) NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"beneficiary_id" varchar(64) NOT NULL,
	"finalized_by" varchar(64) NOT NULL,
	"finalized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engine_version" varchar(32) DEFAULT '1.0' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"coef_breakdown" jsonb NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payrollEntries_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar(255) PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
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
--> statement-breakpoint
CREATE TABLE "settingsVersions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"created_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "slaAlerts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"stage_instance_id" varchar(64) NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"cycle_id" varchar(64),
	"shipment_id" varchar(64),
	"deadline" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "systemAuditLogs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"target" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"actor_id" varchar(64),
	"actor_name" varchar(255),
	"actor_email" varchar(255),
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"detected_mime" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"extraction_status" varchar(32) DEFAULT 'not_configured' NOT NULL,
	"suggestions" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_contract_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" varchar(32) NOT NULL,
	"password_hash" text,
	"status" varchar(32) DEFAULT 'invited' NOT NULL,
	"auth_version" integer DEFAULT 1 NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vtpTrackingHistory" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"shipment_id" varchar(64) NOT NULL,
	"provider_event_id" varchar(128) NOT NULL,
	"raw_status" varchar(64) NOT NULL,
	"normalized_status" varchar(64) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"location" varchar(255),
	CONSTRAINT "vtpTrackingHistory_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "workItems" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contract_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"assignee_id" varchar(64),
	"payable" boolean DEFAULT true NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"base_pay_snapshot" bigint NOT NULL,
	"deadline" timestamp with time zone,
	"started_at" timestamp with time zone,
	"state" varchar(32) DEFAULT 'open' NOT NULL,
	"source_cycle_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workerHeartbeats" (
	"worker_id" varchar(64) PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" varchar(32) NOT NULL,
	"job_summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "authTokens" ADD CONSTRAINT "authTokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerkIncidents" ADD CONSTRAINT "clerkIncidents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerkIncidents" ADD CONSTRAINT "clerkIncidents_work_item_id_workItems_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."workItems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerkIncidents" ADD CONSTRAINT "clerkIncidents_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerkIncidents" ADD CONSTRAINT "clerkIncidents_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerkIncidents" ADD CONSTRAINT "clerkIncidents_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractAuditLogs" ADD CONSTRAINT "contractAuditLogs_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractCycles" ADD CONSTRAINT "contractCycles_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractFeedbackHistory" ADD CONSTRAINT "contractFeedbackHistory_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractFeedbackHistory" ADD CONSTRAINT "contractFeedbackHistory_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractFiles" ADD CONSTRAINT "contractFiles_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractFiles" ADD CONSTRAINT "contractFiles_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractIdentifiers" ADD CONSTRAINT "contractIdentifiers_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractPhysicalEvents" ADD CONSTRAINT "contractPhysicalEvents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractPhysicalEvents" ADD CONSTRAINT "contractPhysicalEvents_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractRevisions" ADD CONSTRAINT "contractRevisions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractRevisions" ADD CONSTRAINT "contractRevisions_cycle_id_contractCycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."contractCycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractRevisions" ADD CONSTRAINT "contractRevisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractRevisions" ADD CONSTRAINT "contractRevisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_legal_assignee_id_users_id_fk" FOREIGN KEY ("legal_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clerk_assignee_id_users_id_fk" FOREIGN KEY ("clerk_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrationFileBackups" ADD CONSTRAINT "integrationFileBackups_file_id_contractFiles_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."contractFiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jsonImportRecords" ADD CONSTRAINT "jsonImportRecords_run_id_jsonImportRuns_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."jsonImportRuns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollAdjustments" ADD CONSTRAINT "payrollAdjustments_entry_id_payrollEntries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payrollEntries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollAdjustments" ADD CONSTRAINT "payrollAdjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollEntries" ADD CONSTRAINT "payrollEntries_work_item_id_workItems_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."workItems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollEntries" ADD CONSTRAINT "payrollEntries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollEntries" ADD CONSTRAINT "payrollEntries_beneficiary_id_users_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrollEntries" ADD CONSTRAINT "payrollEntries_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaAlerts" ADD CONSTRAINT "slaAlerts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vtpTrackingHistory" ADD CONSTRAINT "vtpTrackingHistory_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workItems" ADD CONSTRAINT "workItems_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workItems" ADD CONSTRAINT "workItems_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contracts_number_lower" ON "contracts" USING btree (lower("contract_number"));--> statement-breakpoint
CREATE INDEX "idx_contracts_status" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contracts_uploaded_at" ON "contracts" USING btree ("uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_file_provider_backup" ON "integrationFileBackups" USING btree ("file_id","provider");--> statement-breakpoint
CREATE INDEX "idx_outbox_state_next_run" ON "outboxJobs" USING btree ("state","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sla_alert_stage_rule" ON "slaAlerts" USING btree ("contract_id","stage_instance_id","rule_version");