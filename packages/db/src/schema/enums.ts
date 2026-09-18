// Every enumeration from 15 §1 as a Postgres enum. TypeScript unions are derived from these.
import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'operator', 'reviewer', 'approver']);
export const campaignModeEnum = pgEnum('campaign_mode', ['live', 'shadow']);
/** 22 A5 / D30 — batch campaigns; template_approval lands in M3. */
export const campaignKindEnum = pgEnum('campaign_kind', ['batch', 'template_approval']);
export const versionStateEnum = pgEnum('version_state', [
  'draft', 'resolving', 'evaluated', 'in_review', 'approved', 'rejected', 'sealed', 'handed_off', 'abandoned', 'expired',
]);
export const channelEnum = pgEnum('channel', ['whatsapp', 'sms', 'email', 'voice', 'visit']);
export const purposeEnum = pgEnum('purpose', ['collections', 'promotional', 'service']);
export const consentStateEnum = pgEnum('consent_state', ['granted', 'denied', 'unknown']);
export const eventKindEnum = pgEnum('event_kind', ['sent', 'delivered', 'read', 'failed', 'inbound', 'blocked_proxy', 'opt_out']);
export const severityEnum = pgEnum('severity', ['block', 'warn', 'info']);
export const findingCategoryEnum = pgEnum('finding_category', ['timing', 'consent', 'audience', 'content', 'identity', 'delivery']);
export const coverageStatusEnum = pgEnum('coverage_status', ['evaluated', 'cannot_evaluate', 'not_applicable']);
export const decisionTypeEnum = pgEnum('decision_type', ['accept', 'fix', 'abandon']);
export const decisionScopeEnum = pgEnum('decision_scope', ['this-finding', 'this-campaign', 'this-rule-30d']);
export const reviewOutcomeEnum = pgEnum('review_outcome', ['approved', 'rejected']);
export const sectionOutcomeEnum = pgEnum('section_outcome', ['approved', 'rejected']);
export const evidenceKindEnum = pgEnum('evidence_kind', ['seal', 'chain_attestation']);
export const connectorKindEnum = pgEnum('connector_kind', ['csv', 'wati', 'meta-graph', 'mock']);
export const connectorStatusEnum = pgEnum('connector_status', ['active', 'degraded', 'disabled']);
export const capabilityEnum = pgEnum('capability', ['templates', 'history', 'quality_rating', 'messaging_limit', 'consent', 'suppress']);
export const syncScopeEnum = pgEnum('sync_scope', ['templates', 'history', 'quality', 'consent']);
export const handoffTargetEnum = pgEnum('handoff_target', ['export', 'webhook', 'wati:suppress']);
export const pushStatusEnum = pgEnum('push_status', ['pending', 'ok', 'failed']);
export const jobKindEnum = pgEnum('job_kind', ['resolve', 'check', 'seal', 'webhook', 'push_suppress', 'sync', 'expire_sweep', 'retention']);
export const sourceConfidenceEnum = pgEnum('source_confidence', ['PRIMARY', 'SECONDARY', 'DERIVED', 'PLATFORM', 'UNVERIFIED']);
export const ruleLayerEnum = pgEnum('rule_layer', ['A', 'B', 'C', 'A→C']);
export const classificationEnum = pgEnum('classification', ['promotional', 'service', 'mixed', 'unknown']);
export const classificationConfidenceEnum = pgEnum('classification_confidence', ['high', 'low']);
export const fixKindEnum = pgEnum('fix_kind', ['reschedule', 'drop_rows', 'edit_message', 'set_config', 'add_disclosure']);
export const whatKindEnum = pgEnum('what_kind', ['schedule', 'message_text', 'rows', 'config', 'template']);
export const proposalStatusEnum = pgEnum('proposal_status', ['open', 'accepted', 'dismissed']);
/** D27 — where an immutable audience set came from. */
export const audienceSetSourceEnum = pgEnum('audience_set_source', ['inline', 'upload']);
/** D26 — contact_identifiers.kind. */
export const identifierKindEnum = pgEnum('identifier_kind', ['external_id', 'phone', 'email']);
