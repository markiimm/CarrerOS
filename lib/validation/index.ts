import { z } from 'zod';
import { t } from '@/lib/i18n/pt-BR';

// Blocos compartilhados de schema. Os valores chegam de FormData (texto), então cada bloco
// normaliza "" → null e converte o tipo antes de validar.

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : (v ?? null));

export const text = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string({ error: t.errors.required }).min(1, t.errors.required).max(max, t.errors.tooLong(max)),
  );

export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null)),
    z.string().max(max, t.errors.tooLong(max)).nullable(),
  );

/** Aceita "4.500,50", "4500.50" e número. */
export function parseDecimal(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().replace(/\s/g, '');
  if (s === '') return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => parseDecimal(emptyToNull(v)),
    z.number({ error: t.errors.invalidNumber }).min(min, t.errors.range(min, max)).max(max, t.errors.range(min, max)).nullable(),
  );

export const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => parseDecimal(emptyToNull(v)),
    z.number({ error: t.errors.invalidNumber }).int(t.errors.invalidNumber).min(min, t.errors.range(min, max)).max(max, t.errors.range(min, max)).nullable(),
  );

const isoDate = z.string({ error: t.errors.invalidDate }).regex(/^\d{4}-\d{2}-\d{2}$/, t.errors.invalidDate)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), t.errors.invalidDate);

export const date = z.preprocess((v) => (v == null ? '' : v), isoDate);
export const optionalDate = z.preprocess(emptyToNull, isoDate.nullable());

export const checkbox = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

export const optionalId = z.preprocess(emptyToNull, z.uuid({ error: t.errors.invalidOption }).nullable());
export const id = z.uuid({ error: t.errors.invalidOption });

export const choice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { error: t.errors.invalidOption });

export const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToNull, z.enum(values, { error: t.errors.invalidOption }).nullable());

export const choices = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v == null ? [] : v), z.array(z.enum(values, { error: t.errors.invalidOption })));

export const ids = z.preprocess((v) => (v == null ? [] : v), z.array(id).max(200));

export const url = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string({ error: t.errors.required }).min(1, t.errors.required).max(2000, t.errors.tooLong(2000)).regex(/^https?:\/\/\S+$/i, t.errors.invalidUrl),
);

export const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().trim().max(2000, t.errors.tooLong(2000)).regex(/^https?:\/\/\S+$/i, t.errors.invalidUrl).nullable(),
);

export const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email({ error: t.errors.invalidEmail }).max(254, t.errors.invalidEmail),
);

/** Texto multilinha ou separado por vírgula → lista sem vazios nem repetidos. */
export const list = (separator: RegExp, maxItems: number, maxLength: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? [...new Set(v.split(separator).map((s) => s.trim()).filter(Boolean))] : (v ?? [])),
    z.array(z.string().max(maxLength, t.errors.tooLong(maxLength))).max(maxItems),
  );

export const WORK_MODELS = ['onsite', 'hybrid', 'remote'] as const;
export const CONTRACT_TYPES = ['clt', 'pj', 'internship', 'temporary', 'freelance', 'other'] as const;
export const SENIORITY_LEVELS = ['intern', 'junior', 'mid', 'senior', 'specialist', 'lead', 'manager'] as const;
