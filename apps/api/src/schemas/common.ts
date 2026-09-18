// 06 §1 common shapes + 15 §1 enums. These Zod schemas are the source for packages/api-types and /v1/openapi.json.
import { z } from 'zod';

export const Role = z.enum(['admin', 'operator', 'reviewer', 'approver']);
export const CampaignMode = z.enum(['live', 'shadow']);
export const CampaignKind = z.enum(['batch', 'template_approval']);
export const VersionState = z.enum(['draft', 'resolving', 'evaluated', 'in_review', 'approved', 'rejected', 'sealed', 'handed_off', 'abandoned', 'expired']);
export const Channel = z.enum(['whatsapp', 'sms', 'email', 'voice', 'visit']);
export const Purpose = z.enum(['collections', 'promotional', 'service']);
export const ConsentState = z.enum(['granted', 'denied', 'unknown']);
export const Severity = z.enum(['block', 'warn', 'info']);
export const FindingCategory = z.enum(['timing', 'consent', 'audience', 'content', 'identity', 'delivery']);
export const CoverageStatus = z.enum(['evaluated', 'cannot_evaluate', 'not_applicable']);
export const DecisionType = z.enum(['accept', 'fix', 'abandon']);
export const DecisionScope = z.enum(['this-finding', 'this-campaign', 'this-rule-30d']);
export const SourceConfidence = z.enum(['PRIMARY', 'SECONDARY', 'DERIVED', 'PLATFORM', 'UNVERIFIED']);
export const FixKind = z.enum(['reschedule', 'drop_rows', 'edit_message', 'set_config', 'add_disclosure']);
export const WhatKind = z.enum(['schedule', 'message_text', 'rows', 'config', 'template']);
export const ClassificationValue = z.enum(['promotional', 'service', 'mixed', 'unknown']);

export const Uuid = z.string().uuid();
export const ISO = z.string().datetime({ offset: true });

export const UserRef = z.object({ id: Uuid, displayName: z.string(), roles: z.array(Role) });
export const Citation = z.object({ instrument: z.string(), title: z.string(), confidence: SourceConfidence, graphNodeId: z.string(), url: z.string().optional() });
export const What = z.object({ kind: WhatKind, excerpt: z.string().optional(), field: z.string().optional() });
export const SuggestedFix = z.object({ kind: FixKind, label: z.string(), payload: z.record(z.string(), z.unknown()) });
export const Classification = z.object({
  classification: ClassificationValue,
  evaluateAs: z.enum(['promotional', 'service']),
  confidence: z.enum(['high', 'low']),
  promotionalMarkers: z.array(z.string()),
  serviceMarkers: z.array(z.string()),
  reason: z.string(),
  advisory: z
    .object({ classification: ClassificationValue, confidence: z.number(), rationale: z.string(), provider: z.string(), model: z.string(), promptVersion: z.string() })
    .optional(),
});
export const Coverage = z.object({
  rulesInBook: z.number().int(),
  applicable: z.number().int(),
  evaluated: z.number().int(),
  cannotEvaluate: z.array(z.object({ ruleId: z.string(), title: z.string(), reason: z.string(), missing: z.array(z.string()) })),
  notApplicable: z.array(z.object({ ruleId: z.string(), title: z.string(), reason: z.string().optional() })),
  statement: z.string(),
});
export const Summary = z.object({
  blockers: z.number().int(),
  warnings: z.number().int(),
  info: z.number().int(),
  cannotEvaluate: z.number().int(),
  audienceSize: z.number().int(),
  verdict: z.null(),
});
export const Decision = z.object({
  id: Uuid,
  findingId: Uuid,
  versionId: Uuid,
  type: DecisionType,
  reasonCode: z.string(),
  reasonText: z.string(),
  scope: DecisionScope,
  expiresAt: ISO.nullable(),
  actor: UserRef,
  resultingVersionId: Uuid.nullable(),
  staleEvaluation: z.boolean(),
  createdAt: ISO,
});
export const Finding = z.object({
  id: Uuid,
  evaluationId: Uuid,
  ruleId: z.string(),
  severity: Severity,
  category: FindingCategory,
  title: z.string(),
  explanation: z.string(),
  what: What,
  suggestedFix: SuggestedFix.nullable(),
  affectedCount: z.number().int(),
  affectedSample: z.array(z.string()),
  affectedRowsTruncated: z.boolean(),
  citation: Citation,
  suppressedBy: Uuid.nullable(),
  variantKey: z.string(),
  decisions: z.array(Decision),
});
export const Template = z.object({
  body: z.string().min(1).max(1024),
  variables: z.array(z.string()).max(20),
  externalId: z.string().nullable().optional(),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).nullable().optional(),
});
export const VersionSummary = z.object({
  id: Uuid,
  campaignId: Uuid,
  versionNo: z.number().int(),
  parentVersionId: Uuid.nullable(),
  state: VersionState,
  stateChangedAt: ISO,
  channel: Channel,
  scheduledAt: ISO,
  sendWindowEnd: ISO.nullable(),
  sentAt: ISO.nullable(),
  purpose: Purpose.nullable(),
  borrowerSegment: z.string().nullable(),
  product: z.string().nullable(),
  audienceSize: z.number().int(),
  latestEvaluation: z.object({ id: Uuid, asOf: ISO, rulebookHash: z.string(), summary: Summary }).nullable(),
  supersededBy: z.array(Uuid),
  progressPct: z.number().int().nullable(),
  queuePosition: z.number().int().nullable(),
  configDrift: z.boolean(),
  noChange: z.boolean(),
  createdBy: UserRef,
  createdAt: ISO,
});
export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string(),
  requestId: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const Paged = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export const PageQuery = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(50) });
