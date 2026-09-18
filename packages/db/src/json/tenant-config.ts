// TenantConfig — every key in 15 §3 plus 22 §E additions implemented in M0 (12 §H). Zod 4.
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const QuietHoursSchema = z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) });

export const TenantConfigSchema = z.object({
  lenderName: z.string().min(2).max(80),
  entityType: z.enum(['bank', 'nbfc', 'hfc', 'other']).default('bank'),
  frequencyCapPerWeek: z.number().int().min(1).max(14).nullable().default(null),
  quietHours: QuietHoursSchema.nullable().default(null),
  bannedPhrases: z.array(z.string().min(1).max(80)).max(200).default([]),
  romanisedAcceptableLanguages: z.array(z.string().min(1).max(40).toLowerCase()).default([]),
  blastRadiusThreshold: z.number().int().min(100).max(10_000_000).default(10_000),
  reasonCodes: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40)).max(50).default([]),
  rulePacks: z.array(z.string().min(1)).default(['india-layer-a', 'preflight-hygiene']),
  layerBPacks: z.array(z.string().min(1)).default([]),
  mappingPresets: z.record(z.string(), z.unknown()).default({}),
  webhookUrl: z.string().url().startsWith('https://').nullable().default(null),
  advisory: z
    .object({ llmClassification: z.boolean().default(false), audienceQuality: z.boolean().default(false) })
    .default({ llmClassification: false, audienceQuality: false }),
  retention: z.object({ contactEventsMonths: z.number().int().min(6).max(120).default(24) }).default({ contactEventsMonths: 24 }),
  exceptionMaxDays: z.number().int().min(1).max(90).default(90),
  scheduleMinLeadMinutes: z.number().int().min(0).max(1440).default(5),
  // 22 §E — implemented in M0
  timezone: z.string().min(1).default('Asia/Kolkata'),
  identityPrecedence: z.array(z.enum(['externalId', 'phone', 'email'])).min(1).default(['externalId', 'phone', 'email']),
  sendWindowMaxHours: z.number().int().min(1).max(72).default(6),
  // 22 B8 (M1) — accepted now so a config round-trips; rules read it via core.classify
  classificationMarkers: z
    .object({ promotional: z.array(z.string()).default([]), service: z.array(z.string()).default([]) })
    .default({ promotional: [], service: [] }),
});

export type TenantConfigInput = z.input<typeof TenantConfigSchema>;
export type TenantConfig = z.output<typeof TenantConfigSchema>;
