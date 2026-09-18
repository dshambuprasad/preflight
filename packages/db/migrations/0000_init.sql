CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TYPE "public"."audience_set_source" AS ENUM('inline', 'upload');--> statement-breakpoint
CREATE TYPE "public"."campaign_kind" AS ENUM('batch', 'template_approval');--> statement-breakpoint
CREATE TYPE "public"."campaign_mode" AS ENUM('live', 'shadow');--> statement-breakpoint
CREATE TYPE "public"."capability" AS ENUM('templates', 'history', 'quality_rating', 'messaging_limit', 'consent', 'suppress');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('whatsapp', 'sms', 'email', 'voice', 'visit');--> statement-breakpoint
CREATE TYPE "public"."classification_confidence" AS ENUM('high', 'low');--> statement-breakpoint
CREATE TYPE "public"."classification" AS ENUM('promotional', 'service', 'mixed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."connector_kind" AS ENUM('csv', 'wati', 'meta-graph', 'mock');--> statement-breakpoint
CREATE TYPE "public"."connector_status" AS ENUM('active', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."consent_state" AS ENUM('granted', 'denied', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."coverage_status" AS ENUM('evaluated', 'cannot_evaluate', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."decision_scope" AS ENUM('this-finding', 'this-campaign', 'this-rule-30d');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('accept', 'fix', 'abandon');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('sent', 'delivered', 'read', 'failed', 'inbound', 'blocked_proxy', 'opt_out');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('seal', 'chain_attestation');--> statement-breakpoint
CREATE TYPE "public"."finding_category" AS ENUM('timing', 'consent', 'audience', 'content', 'identity', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."fix_kind" AS ENUM('reschedule', 'drop_rows', 'edit_message', 'set_config', 'add_disclosure');--> statement-breakpoint
CREATE TYPE "public"."handoff_target" AS ENUM('export', 'webhook', 'wati:suppress');--> statement-breakpoint
CREATE TYPE "public"."identifier_kind" AS ENUM('external_id', 'phone', 'email');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('resolve', 'check', 'seal', 'webhook', 'push_suppress', 'sync', 'expire_sweep', 'retention');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('open', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."purpose" AS ENUM('collections', 'promotional', 'service');--> statement-breakpoint
CREATE TYPE "public"."push_status" AS ENUM('pending', 'ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_outcome" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'operator', 'reviewer', 'approver');--> statement-breakpoint
CREATE TYPE "public"."rule_layer" AS ENUM('A', 'B', 'C', 'A→C');--> statement-breakpoint
CREATE TYPE "public"."section_outcome" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('block', 'warn', 'info');--> statement-breakpoint
CREATE TYPE "public"."source_confidence" AS ENUM('PRIMARY', 'SECONDARY', 'DERIVED', 'PLATFORM', 'UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."sync_scope" AS ENUM('templates', 'history', 'quality', 'consent');--> statement-breakpoint
CREATE TYPE "public"."version_state" AS ENUM('draft', 'resolving', 'evaluated', 'in_review', 'approved', 'rejected', 'sealed', 'handed_off', 'abandoned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."what_kind" AS ENUM('schedule', 'message_text', 'rows', 'config', 'template');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"sealing_frozen" boolean DEFAULT false NOT NULL,
	"frozen_reason" text,
	"identity_hmac_key_enc" "bytea",
	"identity_hmac_key_iv" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text NOT NULL,
	"roles" "role"[] NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"parent_version_id" uuid,
	"state" "version_state" DEFAULT 'draft' NOT NULL,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message" text NOT NULL,
	"channel" "channel" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"send_window_end" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"purpose" "purpose",
	"borrower_segment" text,
	"product" text,
	"template" jsonb,
	"config_snapshot" jsonb NOT NULL,
	"audience_set_id" uuid NOT NULL,
	"audience_exclusions" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"audience_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"review_evaluation_id" uuid,
	"progress_pct" smallint,
	"no_change" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mode" "campaign_mode" NOT NULL,
	"kind" "campaign_kind" DEFAULT 'batch' NOT NULL,
	"latest_version_state" "version_state",
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"selector" jsonb NOT NULL,
	"message" text NOT NULL,
	"template" jsonb,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"row_no" integer NOT NULL,
	"external_id" text,
	"raw" jsonb,
	"phone_e164" text,
	"email_norm" "citext",
	"identity_key" text NOT NULL,
	"identity_hmac" text NOT NULL,
	"preferred_language" text,
	"consent_promotional" "consent_state",
	"consent_source" text,
	"duplicate_of_row_id" uuid,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audience_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"upload_id" uuid,
	"source" "audience_set_source" NOT NULL,
	"row_count" integer NOT NULL,
	"set_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"storage_ref" text,
	"column_mapping" jsonb,
	"row_count" integer DEFAULT 0 NOT NULL,
	"sha256" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"channel" "channel",
	"state" "consent_state" NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence" jsonb,
	"expires_at" timestamp with time zone,
	"contract_ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contact_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" "event_kind" NOT NULL,
	"channel" "channel" NOT NULL,
	"purpose" "purpose",
	"occurred_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"campaign_version_id" uuid,
	"external_ref" text
);
--> statement-breakpoint
CREATE TABLE "contact_identifiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" "identifier_kind" NOT NULL,
	"value" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"identity_key" text NOT NULL,
	"phone_e164" text,
	"email_norm" "citext",
	"preferred_language" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_items" (
	"tenant_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"status" "coverage_status" NOT NULL,
	"missing" text[] DEFAULT '{}' NOT NULL,
	"reason" text,
	CONSTRAINT "coverage_items_evaluation_id_rule_id_pk" PRIMARY KEY("evaluation_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"rulebook_hash" text NOT NULL,
	"rule_pack_ids" text[] NOT NULL,
	"classification" jsonb NOT NULL,
	"effective_purpose" "purpose" NOT NULL,
	"coverage" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"exceptions_hash" text NOT NULL,
	"rulebook_hash_at_seal" text,
	"advisory" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"severity" "severity" NOT NULL,
	"category" "finding_category" NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"what" jsonb NOT NULL,
	"suggested_fix" jsonb,
	"affected_count" integer NOT NULL,
	"affected_row_ids" uuid[] NOT NULL,
	"affected_sample" text[] NOT NULL,
	"affected_rows_truncated" boolean DEFAULT false NOT NULL,
	"citation" jsonb NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variant_key" text DEFAULT 'default' NOT NULL,
	"suppressed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"type" "decision_type" NOT NULL,
	"reason_code" text NOT NULL,
	"reason_text" text NOT NULL,
	"scope" "decision_scope" NOT NULL,
	"expires_at" timestamp with time zone,
	"actor_id" uuid NOT NULL,
	"actor_roles" "role"[] NOT NULL,
	"resulting_version_id" uuid,
	"stale_evaluation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"scope" "decision_scope" NOT NULL,
	"campaign_id" uuid,
	"decision_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"sections" jsonb NOT NULL,
	"outcome" "review_outcome" NOT NULL,
	"notes" text,
	"blast_radius_approver_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_proposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"decision_ids" uuid[] NOT NULL,
	"proposal" jsonb NOT NULL,
	"status" "proposal_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_roles" "role"[] DEFAULT '{}' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"kind" "evidence_kind" DEFAULT 'seal' NOT NULL,
	"version_id" uuid,
	"evaluation_id" uuid,
	"payload" jsonb NOT NULL,
	"payload_canonical" text NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"sealed_by" uuid NOT NULL,
	"sealed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "connector_kind" NOT NULL,
	"label" text NOT NULL,
	"status" "connector_status" DEFAULT 'active' NOT NULL,
	"capabilities" "capability"[] DEFAULT '{}' NOT NULL,
	"credentials_enc" "bytea",
	"credentials_iv" "bytea",
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cursor" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosign_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"token_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_pushes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"target" "handoff_target" NOT NULL,
	"identity_key" text NOT NULL,
	"status" "push_status" DEFAULT 'pending' NOT NULL,
	"provider_ref" text,
	"error" text,
	"pushed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "platform_state" (
	"connector_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quality_rating" text,
	"messaging_limit_tier" text,
	"name_status" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"category" text,
	"body" text NOT NULL,
	"variable_count" integer DEFAULT 0 NOT NULL,
	"rejection_reason" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rulebook_versions" (
	"hash" text PRIMARY KEY NOT NULL,
	"pack_ids" text[] NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"git_ref" text,
	"node_count" integer NOT NULL,
	"rule_count" integer NOT NULL,
	"attestation" text
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_parent_version_id_campaign_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_audience_set_id_audience_sets_id_fk" FOREIGN KEY ("audience_set_id") REFERENCES "public"."audience_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_variants" ADD CONSTRAINT "message_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_variants" ADD CONSTRAINT "message_variants_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_rows" ADD CONSTRAINT "audience_rows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_rows" ADD CONSTRAINT "audience_rows_set_id_audience_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."audience_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_rows" ADD CONSTRAINT "audience_rows_duplicate_of_row_id_audience_rows_id_fk" FOREIGN KEY ("duplicate_of_row_id") REFERENCES "public"."audience_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_sets" ADD CONSTRAINT "audience_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_sets" ADD CONSTRAINT "audience_sets_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_sets" ADD CONSTRAINT "audience_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_identifiers" ADD CONSTRAINT "contact_identifiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_identifiers" ADD CONSTRAINT "contact_identifiers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_items" ADD CONSTRAINT "coverage_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_items" ADD CONSTRAINT "coverage_items_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_blast_radius_approver_id_users_id_fk" FOREIGN KEY ("blast_radius_approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_proposals" ADD CONSTRAINT "rule_proposals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_sealed_by_users_id_fk" FOREIGN KEY ("sealed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosign_requests" ADD CONSTRAINT "cosign_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosign_requests" ADD CONSTRAINT "cosign_requests_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosign_requests" ADD CONSTRAINT "cosign_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosign_requests" ADD CONSTRAINT "cosign_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_pushes" ADD CONSTRAINT "handoff_pushes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_pushes" ADD CONSTRAINT "handoff_pushes_version_id_campaign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_pushes" ADD CONSTRAINT "handoff_pushes_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_state" ADD CONSTRAINT "platform_state_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_state" ADD CONSTRAINT "platform_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_templates" ADD CONSTRAINT "platform_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_templates" ADD CONSTRAINT "platform_templates_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_uq" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_uq" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_versions_tenant_campaign_no_uq" ON "campaign_versions" USING btree ("tenant_id","campaign_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_versions_tenant_idem_uq" ON "campaign_versions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "campaign_versions_expiry_idx" ON "campaign_versions" USING btree ("tenant_id","state","scheduled_at") WHERE state IN ('in_review', 'approved');--> statement-breakpoint
CREATE INDEX "campaign_versions_tenant_campaign_idx" ON "campaign_versions" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_created_idx" ON "campaigns" USING btree ("tenant_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_variants_version_key_uq" ON "message_variants" USING btree ("version_id","key");--> statement-breakpoint
CREATE INDEX "message_variants_tenant_idx" ON "message_variants" USING btree ("tenant_id","version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audience_rows_tenant_set_rowno_uq" ON "audience_rows" USING btree ("tenant_id","set_id","row_no");--> statement-breakpoint
CREATE INDEX "audience_rows_tenant_set_identity_idx" ON "audience_rows" USING btree ("tenant_id","set_id","identity_key");--> statement-breakpoint
CREATE INDEX "audience_rows_tenant_identity_idx" ON "audience_rows" USING btree ("tenant_id","identity_key");--> statement-breakpoint
CREATE INDEX "audience_sets_tenant_idx" ON "audience_sets" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "uploads_tenant_idx" ON "uploads" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "consent_records_current_idx" ON "consent_records" USING btree ("tenant_id","contact_id","purpose","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contact_events_window_idx" ON "contact_events" USING btree ("tenant_id","contact_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "contact_events_source_ref_uq" ON "contact_events" USING btree ("source","external_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_identifiers_tenant_kind_value_uq" ON "contact_identifiers" USING btree ("tenant_id","kind","value");--> statement-breakpoint
CREATE INDEX "contact_identifiers_tenant_contact_idx" ON "contact_identifiers" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_identity_uq" ON "contacts" USING btree ("tenant_id","identity_key");--> statement-breakpoint
CREATE INDEX "coverage_items_tenant_idx" ON "coverage_items" USING btree ("tenant_id","evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_idempotent_uq" ON "evaluations" USING btree ("version_id","as_of","rulebook_hash","exceptions_hash");--> statement-breakpoint
CREATE INDEX "evaluations_tenant_version_idx" ON "evaluations" USING btree ("tenant_id","version_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "findings_screen_idx" ON "findings" USING btree ("tenant_id","evaluation_id","severity","rule_id");--> statement-breakpoint
CREATE INDEX "decisions_finding_idx" ON "decisions" USING btree ("tenant_id","finding_id","created_at");--> statement-breakpoint
CREATE INDEX "decisions_version_idx" ON "decisions" USING btree ("tenant_id","version_id");--> statement-breakpoint
CREATE INDEX "exceptions_active_idx" ON "exceptions" USING btree ("tenant_id","campaign_id","expires_at");--> statement-breakpoint
CREATE INDEX "reviews_version_idx" ON "reviews" USING btree ("tenant_id","version_id");--> statement-breakpoint
CREATE INDEX "rule_proposals_tenant_rule_idx" ON "rule_proposals" USING btree ("tenant_id","rule_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("tenant_id","entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_tenant_created_idx" ON "audit_events" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_records_tenant_seq_uq" ON "evidence_records" USING btree ("tenant_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_records_version_uq" ON "evidence_records" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "connectors_tenant_idx" ON "connectors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cosign_requests_tenant_code_idx" ON "cosign_requests" USING btree ("tenant_id","code","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "handoff_pushes_version_connector_key_uq" ON "handoff_pushes" USING btree ("version_id","connector_id","identity_key");--> statement-breakpoint
CREATE INDEX "handoff_pushes_tenant_version_idx" ON "handoff_pushes" USING btree ("tenant_id","version_id");--> statement-breakpoint
CREATE INDEX "platform_state_tenant_idx" ON "platform_state" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_templates_connector_external_uq" ON "platform_templates" USING btree ("connector_id","external_id");--> statement-breakpoint
CREATE INDEX "platform_templates_tenant_idx" ON "platform_templates" USING btree ("tenant_id","connector_id");