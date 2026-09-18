-- Integrity triggers (03 §2, §3, §5, §6; 15 §2; 22 A7/D31). Additive only — never a DROP on the
-- append-only tables (03 §11; enforced by scripts/check-migrations.mjs).

-- circular FK deferred from the schema: campaign_versions.review_evaluation_id → evaluations (G1)
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_review_evaluation_id_fk"
  FOREIGN KEY ("review_evaluation_id") REFERENCES "evaluations"("id");
--> statement-breakpoint

-- (b) evidence_records and audit_events: append-only, no UPDATE, no DELETE
CREATE OR REPLACE FUNCTION pf_forbid_write() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'preflight: % on % is forbidden (append-only)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER evidence_records_append_only BEFORE UPDATE OR DELETE ON "evidence_records"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint
-- (e) consent_records: withdrawal is a new row
CREATE TRIGGER consent_records_append_only BEFORE UPDATE OR DELETE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint

-- (a) campaign_versions: immutable except state, state_changed_at, review_evaluation_id, progress_pct, no_change
CREATE OR REPLACE FUNCTION pf_campaign_versions_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
    OR NEW.version_no IS DISTINCT FROM OLD.version_no
    OR NEW.parent_version_id IS DISTINCT FROM OLD.parent_version_id
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
    OR NEW.send_window_end IS DISTINCT FROM OLD.send_window_end
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.borrower_segment IS DISTINCT FROM OLD.borrower_segment
    OR NEW.product IS DISTINCT FROM OLD.product
    OR NEW.template IS DISTINCT FROM OLD.template
    OR NEW.config_snapshot IS DISTINCT FROM OLD.config_snapshot
    OR NEW.audience_set_id IS DISTINCT FROM OLD.audience_set_id
    OR NEW.audience_exclusions IS DISTINCT FROM OLD.audience_exclusions
    OR NEW.audience_hash IS DISTINCT FROM OLD.audience_hash
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
  THEN
    RAISE EXCEPTION 'preflight: campaign_versions is immutable (change = new version); only state, state_changed_at, review_evaluation_id, progress_pct, no_change may change'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER campaign_versions_immutable BEFORE UPDATE ON "campaign_versions"
  FOR EACH ROW EXECUTE FUNCTION pf_campaign_versions_immutable();
--> statement-breakpoint
CREATE TRIGGER campaign_versions_no_delete BEFORE DELETE ON "campaign_versions"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint

-- (c) reviews: reviewer ≠ author (02 §7, 03 §5) — defence in depth behind the API check
CREATE OR REPLACE FUNCTION pf_reviews_not_self() RETURNS trigger AS $$
DECLARE author uuid;
BEGIN
  SELECT created_by INTO author FROM campaign_versions WHERE id = NEW.version_id;
  IF author IS NOT NULL AND author = NEW.reviewer_id THEN
    RAISE EXCEPTION 'preflight: a reviewer cannot approve a version they authored (forbidden-self-review)'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reviews_not_self BEFORE INSERT ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION pf_reviews_not_self();
--> statement-breakpoint

-- (d) audience_rows: immutable except RESOLVE columns and D31 erasure tombstones
CREATE OR REPLACE FUNCTION pf_audience_rows_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.set_id IS DISTINCT FROM OLD.set_id
    OR NEW.row_no IS DISTINCT FROM OLD.row_no
  THEN
    RAISE EXCEPTION 'preflight: audience_rows identity columns are immutable' USING ERRCODE = 'P0001';
  END IF;
  -- raw / external_id may only change by being tombstoned (set to null together with erased_at)
  IF (NEW.raw IS DISTINCT FROM OLD.raw OR NEW.external_id IS DISTINCT FROM OLD.external_id)
     AND NOT (NEW.erased_at IS NOT NULL AND NEW.raw IS NULL AND NEW.external_id IS NULL) THEN
    RAISE EXCEPTION 'preflight: audience_rows.raw/external_id may only be erased (tombstone), never edited'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audience_rows_immutable BEFORE UPDATE ON "audience_rows"
  FOR EACH ROW EXECUTE FUNCTION pf_audience_rows_immutable();
--> statement-breakpoint
CREATE TRIGGER audience_sets_immutable BEFORE UPDATE OR DELETE ON "audience_sets"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint
CREATE TRIGGER message_variants_immutable BEFORE UPDATE OR DELETE ON "message_variants"
  FOR EACH ROW EXECUTE FUNCTION pf_forbid_write();
--> statement-breakpoint
-- decisions are rows, never edits (05 §5) — resulting_version_id is filled once for `fix`
CREATE OR REPLACE FUNCTION pf_decisions_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'preflight: DELETE on decisions is forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.resulting_version_id IS NOT NULL OR NEW.type <> 'fix'
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.finding_id IS DISTINCT FROM OLD.finding_id OR NEW.version_id IS DISTINCT FROM OLD.version_id
     OR NEW.type IS DISTINCT FROM OLD.type OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
     OR NEW.reason_text IS DISTINCT FROM OLD.reason_text OR NEW.scope IS DISTINCT FROM OLD.scope
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
     OR NEW.actor_roles IS DISTINCT FROM OLD.actor_roles OR NEW.stale_evaluation IS DISTINCT FROM OLD.stale_evaluation
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'preflight: decisions are append-only (only fix.resulting_version_id may be set once)'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER decisions_append_only BEFORE UPDATE OR DELETE ON "decisions"
  FOR EACH ROW EXECUTE FUNCTION pf_decisions_append_only();
