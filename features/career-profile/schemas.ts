import { z } from 'zod';
import { t } from '@/lib/i18n/pt-BR';
import {
  checkbox, choice, choices, CONTRACT_TYPES, date, id, ids, list, optionalChoice, optionalDate, optionalId,
  optionalInt, optionalNumber, optionalText, optionalUrl, SENIORITY_LEVELS, text, url, WORK_MODELS,
} from '@/lib/validation';

const MONEY_MAX = 9_999_999;

export const personalDataSchema = z
  .object({
    full_name: text(120),
    headline: optionalText(160),
    city: optionalText(80),
    state: optionalText(40),
    country: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
      z.string().regex(/^[A-Z]{2}$/, t.errors.invalidOption),
    ),
    willing_to_relocate: checkbox,
    willing_to_travel: checkbox,
    salary_expectation_min: optionalNumber(0, MONEY_MAX),
    salary_expectation_max: optionalNumber(0, MONEY_MAX),
    accepted_work_models: choices(WORK_MODELS),
    accepted_contract_types: choices(CONTRACT_TYPES),
  })
  .refine(
    (v) => v.salary_expectation_min === null || v.salary_expectation_max === null || v.salary_expectation_max >= v.salary_expectation_min,
    { path: ['salary_expectation_max'], message: t.errors.maxBelowMin },
  );

export const careerProfileSchema = z.object({
  id: optionalId,
  name: text(80),
  target_title: optionalText(120),
  seniority: optionalChoice(SENIORITY_LEVELS),
  years_experience: optionalNumber(0, 60),
  summary: optionalText(4000),
  skill_ids: ids,
  experience_ids: ids,
});

export const experienceSchema = z
  .object({
    id: optionalId,
    company_name: text(120),
    role_title: text(120),
    start_date: date,
    end_date: optionalDate,
    is_current: checkbox,
    location: optionalText(120),
    contract_type: optionalChoice(CONTRACT_TYPES),
    description: optionalText(4000),
    achievements: list(/\r?\n/, 30, 400),
    technologies: list(/[,\n]/, 60, 60),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: t.errors.endBeforeStart })
  .refine((v) => !(v.is_current && v.end_date), { path: ['end_date'], message: t.errors.currentWithEnd });

export const EDUCATION_STATUSES = ['completed', 'in_progress', 'paused', 'dropped'] as const;

export const educationSchema = z
  .object({
    id: optionalId,
    institution: text(160),
    degree: optionalText(80),
    field: optionalText(160),
    start_date: optionalDate,
    end_date: optionalDate,
    status: choice(EDUCATION_STATUSES),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'], message: t.errors.endBeforeStart,
  });

export const certificationSchema = z
  .object({
    id: optionalId,
    name: text(160),
    issuer: optionalText(120),
    issued_at: optionalDate,
    expires_at: optionalDate,
    credential_id: optionalText(120),
    credential_url: optionalUrl,
  })
  .refine((v) => !v.issued_at || !v.expires_at || v.expires_at >= v.issued_at, {
    path: ['expires_at'], message: t.errors.endBeforeStart,
  });

export const userSkillSchema = z.object({
  skill_id: id,
  level: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number({ error: t.errors.invalidOption }).int().min(1, t.errors.invalidOption).max(5, t.errors.invalidOption)),
  years_practice: optionalNumber(0, 60),
  evidence: optionalText(300),
});

export const LINK_KINDS = ['github', 'portfolio', 'linkedin', 'article', 'other'] as const;

export const linkSchema = z.object({ kind: choice(LINK_KINDS), url, label: optionalText(80) });

export const BENEFIT_KEYS = [
  'meal_voucher', 'food_voucher', 'transport_voucher', 'health_plan', 'dental_plan', 'life_insurance',
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export const currentEmploymentSchema = z.object({
  company_name: text(120),
  role_title: text(120),
  started_at: optionalDate,
  contract_type: choice(CONTRACT_TYPES),
  work_model: optionalChoice(WORK_MODELS),
  base_salary: optionalNumber(0, MONEY_MAX),
  bonus_annual: optionalNumber(0, MONEY_MAX),
  benefit_meal_voucher: optionalNumber(0, MONEY_MAX),
  benefit_food_voucher: optionalNumber(0, MONEY_MAX),
  benefit_transport_voucher: optionalNumber(0, MONEY_MAX),
  benefit_health_plan: optionalNumber(0, MONEY_MAX),
  benefit_dental_plan: optionalNumber(0, MONEY_MAX),
  benefit_life_insurance: optionalNumber(0, MONEY_MAX),
  commute_cost_monthly: optionalNumber(0, MONEY_MAX),
  commute_minutes_daily: optionalInt(0, 600),
  satisfaction: optionalInt(1, 5),
  notes: optionalText(2000),
});

export const idSchema = z.object({ id });
