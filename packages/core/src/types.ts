// Types for the rule contract (04 §1), the context (04 §2) and the evaluation result (04 §3),
// amended by 22 (D26–D32) and recorded in 12 §H (D43, D46, D47, D48).

export type ISODate = string; // 'YYYY-MM-DD'
export type ISOInstant = string; // ISO-8601 with offset
export type RowId = string;
export type DataPath = string;

export type Severity = 'block' | 'warn' | 'info';
export type SourceConfidence = 'PRIMARY' | 'SECONDARY' | 'DERIVED' | 'PLATFORM' | 'UNVERIFIED';
export type Channel = 'whatsapp' | 'sms' | 'email' | 'voice' | 'visit';
export type Purpose = 'collections' | 'promotional' | 'service';
export type ConsentState = 'granted' | 'denied' | 'unknown';
export type FindingCategory = 'timing' | 'consent' | 'audience' | 'content' | 'identity' | 'delivery';
export type RuleLayer = 'A' | 'B' | 'C' | 'A→C';
export type RuleTier = 0 | 1 | 2;
export type WhatKind = 'schedule' | 'message_text' | 'rows' | 'config' | 'template';
export type FixKind = 'reschedule' | 'drop_rows' | 'edit_message' | 'set_config' | 'add_disclosure';
export type DecisionScope = 'this-finding' | 'this-campaign' | 'this-rule-30d';
export type ClassificationValue = 'promotional' | 'service' | 'mixed' | 'unknown';
export type IdentityKind = 'externalId' | 'phone' | 'email';

export interface Citation {
  instrument: string;
  title: string;
  confidence: SourceConfidence;
  graphNodeId: string;
  url?: string;
}

/** Part 1 of the four-part anatomy (04 §1). */
export interface What {
  kind: WhatKind;
  excerpt?: string;
  field?: string;
}

/** Part 4 of the four-part anatomy (04 §1, §9). */
export interface SuggestedFix {
  kind: FixKind;
  label: string;
  payload: Record<string, unknown>;
}

export interface Template {
  body: string;
  variables: string[];
  externalId?: string | null;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | null;
}

/** D28 — message variants are v1 core; `default` is the only variant until M5. */
export interface MessageVariant {
  key: string;
  message: string;
  template?: Template | null;
  selector?: Record<string, unknown> | null;
}

export interface CampaignInput {
  message: string;
  channel: Channel;
  scheduledAt: ISOInstant;
  /** D29 — end of the send window; null/absent means a single instant. */
  sendWindowEnd?: ISOInstant | null;
  purpose?: Purpose | null;
  borrowerSegment?: string | null;
  product?: string | null;
  template?: Template | null;
  variants?: MessageVariant[];
}

/** One audience row after RESOLVE (05 §3). Duplicates are NOT in `contacts` (D47). */
export interface Contact {
  id: RowId;
  externalId?: string | null;
  phoneE164?: string | null;
  emailNorm?: string | null;
  identityKey?: string;
  preferredLanguage?: string | null;
  /** null = field absent in the upload (≠ 'unknown'). */
  consentPromotional?: ConsentState | null;
  consentSource?: string | null;
  variantKey?: string | null;
  attributes?: Record<string, unknown>;
}

export interface AudienceStats {
  /** rows in the effective audience (set − exclusions), including duplicates */
  rows: number;
  duplicates: { rowId: RowId; duplicateOf: RowId }[];
  /** rows with `row:` identity keys — no phone, email or external id */
  unresolvable: RowId[];
}

/** Layer C. The core reads only the keys it needs; the Zod schema in db/api is the authority (15 §3). */
export interface TenantConfig {
  lenderName?: string | null;
  entityType?: 'bank' | 'nbfc' | 'hfc' | 'other';
  frequencyCapPerWeek?: number | null;
  quietHours?: { start: string; end: string } | null;
  bannedPhrases?: string[];
  romanisedAcceptableLanguages?: string[];
  blastRadiusThreshold?: number;
  reasonCodes?: string[];
  rulePacks?: string[];
  layerBPacks?: string[];
  timezone?: string;
  identityPrecedence?: IdentityKind[];
  sendWindowMaxHours?: number;
  classificationMarkers?: { promotional?: string[]; service?: string[] };
  [key: string]: unknown;
}

export interface Classification {
  classification: ClassificationValue;
  evaluateAs: 'promotional' | 'service';
  confidence: 'high' | 'low';
  promotionalMarkers: string[];
  serviceMarkers: string[];
  reason: string;
}

export interface LocalTime {
  hhmm: string;
  hour: number;
  minute: number;
  /** 0 = Sunday */
  weekday: number;
}

export interface ContactEvent {
  kind: 'sent' | 'delivered' | 'read' | 'failed' | 'inbound' | 'blocked_proxy' | 'opt_out';
  channel: Channel;
  purpose?: Purpose | null;
  occurredAt: ISOInstant;
  source: string;
}

export interface ConsentRecord {
  purpose: string;
  channel: Channel | null;
  state: 'granted' | 'denied';
  source: string;
  recordedAt: ISOInstant;
}

/** 16 §2.1 — Tier-1 access. Absent at Tier 0. */
export interface HistoryAccess {
  events(identityKey: string, from: ISOInstant, to: ISOInstant): ContactEvent[];
  hasAnyHistory(identityKey: string): boolean;
  earliestKnown: ISOInstant | null;
}
export interface ConsentAccess {
  current(identityKey: string, purpose: string, channel: Channel | null): ConsentRecord | null;
  /** Optional capabilities; rules that need them list `consent.dnd` / `consent.productScoped` in `requires`. */
  dnd?(identityKey: string): boolean | null;
  productScoped?: boolean;
}
export interface PlatformTemplate {
  externalId: string;
  name: string;
  status: string;
  category: string | null;
  body: string;
  variableCount: number;
}
export interface PlatformState {
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | null;
  messagingLimitTier: string | null;
  templates: PlatformTemplate[] | null;
  fetchedAt: ISOInstant;
}
export interface Exception {
  id: string;
  ruleId: string;
  scope: DecisionScope;
  campaignId?: string;
  expiresAt: ISOInstant;
}

export interface Context {
  campaign: CampaignInput;
  contacts: Contact[];
  config: TenantConfig;
  /** injected. NEVER Date.now() */
  asOf: ISOInstant;
  classification: Classification;
  effectivePurpose: Purpose;
  /** D32/D46 — IANA zone from config; default Asia/Kolkata */
  timezone: string;
  /** scheduledAt in the tenant timezone, or null when unparseable */
  local: LocalTime | null;
  /** sendWindowEnd in the tenant timezone (D29), or null */
  localEnd: LocalTime | null;
  /** minutes from scheduledAt to sendWindowEnd; 0 when no window */
  sendWindowMinutes: number | null;
  /** the variant being evaluated (D28); `default` when the campaign has none */
  variant: MessageVariant;
  audience: AudienceStats;
  history?: HistoryAccess;
  consent?: ConsentAccess;
  platform?: PlatformState;
  exceptions: Exception[];
}

export type Result =
  | { status: 'pass'; detail?: Record<string, unknown> }
  | FailResult
  | { status: 'cannot_evaluate'; missing: DataPath[]; reason?: string }
  | { status: 'not_applicable'; reason: string };

export interface FailResult {
  status: 'fail';
  affected: RowId[];
  what?: What;
  detail?: Record<string, unknown>;
}

export interface Rule {
  /** 'A-RBI-001' — stable forever; never reuse */
  id: string;
  pack: string;
  layer: RuleLayer;
  tier: RuleTier;
  category: FindingCategory;
  title: string;
  severity: Severity;
  effectiveFrom?: ISODate;
  severityBefore?: Severity;
  citation: Citation;
  /** declared data dependencies; validated at pack load (04 §1 invariant 2) */
  requires: DataPath[];
  note?: string;
  /** D28 — evaluate once per message variant. Default: category === 'content'. */
  perVariant?: boolean;
  appliesTo(ctx: Context): true | false | 'unknown';
  evaluate(ctx: Context): Result;
  /** D43 — every rule owns its explanation; never shared (04 §8). */
  explain(ctx: Context, result: FailResult): string;
  suggestFix?(ctx: Context, result: FailResult): SuggestedFix | null;
}

export interface RulePack {
  id: string;
  version: string;
  rules: Rule[];
  /** sha256 of compiled rule sources; computed at build, checked at boot (16 §2.2) */
  sourceHash: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  citation: Citation;
  note?: string;
  affectedCount: number;
  affectedSample: RowId[];
  detail: Record<string, unknown>;
  explanation: string;
  category: FindingCategory;
  what: What;
  suggestedFix: SuggestedFix | null;
  affectedRowIds: RowId[];
  variantKey: string;
  suppressedBy: string | null;
}

export interface CoverageItem {
  ruleId: string;
  title: string;
  reason: string;
  missing: DataPath[];
}

export interface Coverage {
  rulesInBook: number;
  applicable: number;
  evaluated: number;
  cannotEvaluate: CoverageItem[];
  notApplicable: { ruleId: string; title: string; reason?: string }[];
  statement: string;
}

export interface Summary {
  blockers: number;
  warnings: number;
  info: number;
  cannotEvaluate: number;
  audienceSize: number;
  /** Deliberately null. The product finds gaps for human review; it never certifies (01 §7, 04 §3). */
  verdict: null;
}

export interface EvaluationResult {
  findings: Finding[];
  classification: Classification;
  effectivePurpose: Purpose;
  coverage: Coverage;
  summary: Summary;
  variants: { key: string; recipientCount: number }[];
  ruleErrors: { ruleId: string; error: string }[];
}

export interface EvaluateInput {
  campaign: CampaignInput;
  contacts: Contact[];
  config: TenantConfig;
  asOf: ISOInstant;
  packs: RulePack[];
  audience?: AudienceStats;
  history?: HistoryAccess;
  consent?: ConsentAccess;
  platform?: PlatformState;
  exceptions?: Exception[];
}
