// ColumnMapping (15 §6).
import { z } from 'zod';

export const MappingTargetSchema = z
  .string()
  .regex(/^(externalId|phone|email|preferredLanguage|consentPromotional|ignore|consentPromotional:.+|attribute:.+)$/);

export const ColumnMappingSchema = z
  .object({
    version: z.literal(1),
    columns: z.record(z.string(), MappingTargetSchema),
    consentValueMap: z.object({ granted: z.array(z.string()), denied: z.array(z.string()) }).optional(),
    languageAliases: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((m, ctx) => {
    const seen = new Map<string, string>();
    for (const [col, target] of Object.entries(m.columns)) {
      if (target === 'ignore' || target.startsWith('attribute:')) continue;
      const prev = seen.get(target);
      if (prev) ctx.addIssue({ code: 'custom', path: ['columns', col], message: `target '${target}' already mapped from '${prev}'` });
      seen.set(target, col);
    }
  });

export type ColumnMapping = z.output<typeof ColumnMappingSchema>;
