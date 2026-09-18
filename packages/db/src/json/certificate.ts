// The certificate payload (03 §8 + 06 §6 rulebookHashAtSeal). What gets sealed; frozen; no metrics.
import { z } from 'zod';

const UserRef = z.object({ id: z.string(), displayName: z.string(), roles: z.array(z.string()) });

export const CERTIFICATE_DISCLAIMER =
  'This record evidences that a pre-send review was performed and what it found. It does not certify compliance and is not legal advice.';

export const CertificatePayloadSchema = z.object({
  schema: z.literal('preflight.evidence/1'),
  tenant: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  campaign: z.object({ id: z.string(), name: z.string(), mode: z.enum(['live', 'shadow']) }),
  version: z.object({
    id: z.string(),
    no: z.number().int(),
    contentHash: z.string(),
    audienceHash: z.string(),
    scheduledAt: z.string(),
    sendWindowEnd: z.string().nullable().optional(),
    channel: z.string(),
    purpose: z.string().nullable(),
    segment: z.string().nullable(),
    message: z.string(),
    template: z.unknown().optional(),
    configSnapshot: z.record(z.string(), z.unknown()),
  }),
  audience: z.object({ size: z.number().int(), identityKeysHash: z.string() }),
  evaluation: z.object({
    id: z.string(),
    asOf: z.string(),
    rulebookHash: z.string(),
    rulePackIds: z.array(z.string()),
    engineVersion: z.string(),
    classification: z.record(z.string(), z.unknown()),
    coverage: z.record(z.string(), z.unknown()),
    summary: z.object({
      blockers: z.number().int(),
      warnings: z.number().int(),
      info: z.number().int(),
      cannotEvaluate: z.number().int(),
      audienceSize: z.number().int(),
      verdict: z.null(),
    }),
  }),
  findings: z.array(
    z.object({
      ruleId: z.string(),
      severity: z.string(),
      category: z.string(),
      title: z.string(),
      what: z.record(z.string(), z.unknown()),
      explanation: z.string(),
      citation: z.record(z.string(), z.unknown()),
      affectedCount: z.number().int(),
      variantKey: z.string().optional(),
    }),
  ),
  decisions: z.array(
    z.object({
      findingRuleId: z.string(),
      type: z.string(),
      reasonCode: z.string(),
      reasonText: z.string(),
      scope: z.string(),
      expiresAt: z.string().nullable(),
      actor: UserRef,
      at: z.string(),
    }),
  ),
  review: z.object({
    reviewer: UserRef,
    sections: z.record(z.string(), z.unknown()),
    outcome: z.string(),
    notes: z.string().nullable(),
    blastRadiusApprover: UserRef.nullable().optional(),
    at: z.string(),
  }),
  variants: z.array(z.object({ key: z.string(), contentHash: z.string(), recipientCount: z.number().int() })).optional(),
  rulebookHashAtSeal: z.string().optional(),
  sealedAt: z.string(),
  sealedBy: UserRef,
  disclaimer: z.literal(CERTIFICATE_DISCLAIMER),
});
export type CertificatePayload = z.output<typeof CertificatePayloadSchema>;
