import { z } from 'zod';
import {
  CampaignMode, Channel, Classification, Coverage, Finding, ISO, Purpose, Role, Summary, Template, UserRef, Uuid, VersionState, VersionSummary,
} from './common.js';

export * from './common.js';

// ---- auth & identity (06 §2)
export const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
export const Me = z.object({
  user: UserRef,
  tenant: z.object({ id: Uuid, slug: z.string(), name: z.string(), entityType: z.string() }),
  sealingFrozen: z.boolean(),
  mockConnectors: z.boolean(),
});
export const CreateUserBody = z.object({ email: z.string().email(), displayName: z.string().min(1).max(80), roles: z.array(Role).min(1), password: z.string().min(8) });

// ---- campaigns (06 §4)
export const CreateCampaignBody = z.object({ name: z.string().min(1).max(120), mode: CampaignMode });
export const Campaign = z.object({ id: Uuid, name: z.string(), mode: CampaignMode, latestVersionState: VersionState.nullable(), createdBy: UserRef, createdAt: ISO });
export const CampaignListItem = z.object({ id: Uuid, name: z.string(), mode: CampaignMode, latestVersion: VersionSummary.nullable(), createdAt: ISO });
export const CampaignListQuery = z.object({
  state: VersionState.optional(),
  mode: CampaignMode.optional(),
  q: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export const CampaignDetail = z.object({ id: Uuid, name: z.string(), mode: CampaignMode, versions: z.array(VersionSummary), createdBy: UserRef, createdAt: ISO });

export const InlineRow = z.record(z.string(), z.string());
export const CreateVersionBody = z.object({
  message: z.string().min(1).max(4096),
  channel: Channel.refine((c) => c !== 'voice' && c !== 'visit', 'voice/visit are not selectable in v1'),
  scheduledAt: ISO,
  sendWindowEnd: ISO.optional(),
  sentAt: ISO.optional(),
  purpose: Purpose.optional(),
  borrowerSegment: z.string().min(1).max(40).optional(),
  product: z.string().min(1).max(80).optional(),
  template: Template.optional(),
  audience: z.union([
    z.object({ uploadId: Uuid, mapping: z.record(z.string(), z.unknown()).optional() }),
    z.object({ rows: z.array(InlineRow).min(1).max(5000) }),
  ]),
  parentVersionId: Uuid.optional(),
});
export const CreateVersionResponse = z.object({ version: VersionSummary, jobs: z.array(z.literal('resolve')) });

export const VersionDetail = VersionSummary.extend({
  message: z.string(),
  template: Template.nullable(),
  configSnapshot: z.record(z.string(), z.unknown()),
  review: z.unknown().nullable(),
  evidence: z.object({ id: Uuid, seq: z.number().int(), hash: z.string() }).nullable(),
  audience: z.object({
    size: z.number().int(),
    duplicates: z.number().int(),
    unresolvable: z.number().int(),
    consent: z.object({ granted: z.number().int(), denied: z.number().int(), unknown: z.number().int(), absent: z.number().int() }),
  }),
  campaignName: z.string(),
  campaignMode: CampaignMode,
  lastError: z.string().nullable(),
});

export const EvaluateBody = z.object({ asOf: ISO.optional() });
export const EvaluateQueued = z.object({ evaluationId: z.null(), job: z.literal('check'), advisory: z.boolean() });
export const EvaluateExisting = z.object({ evaluationId: Uuid, advisory: z.boolean() });

export const EvaluationDetail = z.object({
  id: Uuid,
  versionId: Uuid,
  asOf: ISO,
  rulebookHash: z.string(),
  rulePackIds: z.array(z.string()),
  engineVersion: z.string(),
  durationMs: z.number().int(),
  advisory: z.boolean(),
  classification: Classification,
  effectivePurpose: Purpose,
  coverage: Coverage,
  summary: Summary,
  findings: z.array(Finding),
  createdAt: ISO,
});
export const EvaluationListItem = z.object({ id: Uuid, asOf: ISO, rulebookHash: z.string(), exceptionsHash: z.string(), advisory: z.boolean(), summary: Summary, createdAt: ISO });

// ---- rulebook (06 §7)
export const RulebookInfo = z.object({
  hash: z.string(),
  graphHash: z.string(),
  packs: z.array(z.object({ id: z.string(), version: z.string(), ruleCount: z.number().int(), sourceHash: z.string() })),
  loadedAt: ISO,
  gitRef: z.string().nullable(),
});
export const RuleListItem = z.object({
  id: z.string(),
  pack: z.string(),
  layer: z.string(),
  tier: z.number().int().nullable(),
  category: z.string().nullable(),
  title: z.string(),
  severity: z.string(),
  severityBefore: z.string().nullable(),
  effectiveFrom: z.string().nullable(),
  requires: z.array(z.string()),
  sendTimeCheck: z.boolean(),
  citation: z.object({ instrument: z.string(), title: z.string(), confidence: z.string(), graphNodeId: z.string(), url: z.string().optional() }),
});

// ---- health (06 §10)
export const Health = z.object({ ok: z.boolean(), db: z.enum(['ok', 'down']), queue: z.enum(['ok', 'down']), rulebookHash: z.string(), version: z.string() });

export type CreateVersionBody = z.infer<typeof CreateVersionBody>;
export type CreateCampaignBody = z.infer<typeof CreateCampaignBody>;
export type VersionSummaryT = z.infer<typeof VersionSummary>;
export type FindingT = z.infer<typeof Finding>;
