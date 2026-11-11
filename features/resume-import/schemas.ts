import { z } from 'zod';
import { certificationSchema, educationSchema, experienceSchema, linkSchema } from '@/features/career-profile/schemas';
import { ids, optionalNumber, optionalText } from '@/lib/validation';

/**
 * O que o cliente devolve depois da revisão. O servidor não confia nele: cada item passa pelos
 * MESMOS schemas dos formulários manuais, então nada entra no banco sem a validação de sempre.
 */
export const resumeApplySchema = z.object({
  personal: z.object({
    full_name: optionalText(120),
    headline: optionalText(160),
    city: optionalText(80),
    state: optionalText(40),
  }),
  summary: optionalText(4000),
  years_experience: optionalNumber(0, 60),
  skill_ids: ids,
  experiences: z.array(experienceSchema).max(30),
  educations: z.array(educationSchema).max(10),
  certifications: z.array(certificationSchema).max(15),
  links: z.array(linkSchema).max(6),
});

export type ResumeApplyInput = z.input<typeof resumeApplySchema>;

export interface ImportSummary { added: number; skipped: number }
