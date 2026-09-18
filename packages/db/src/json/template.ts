import { z } from 'zod';

export const TemplateSchema = z.object({
  body: z.string().min(1).max(1024),
  variables: z.array(z.string()).max(20),
  externalId: z.string().optional(),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
});
export type Template = z.output<typeof TemplateSchema>;
