import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@/lib/config/rules';
import { t } from '@/lib/i18n/pt-BR';
import { email, optionalText, text } from '@/lib/validation';

const newPassword = z
  .string({ error: t.errors.required })
  .min(PASSWORD_MIN_LENGTH, t.auth.passwordTooShort)
  .max(72, t.errors.tooLong(72));

export const signInSchema = z.object({
  email,
  password: z.string({ error: t.errors.required }).min(1, t.errors.required).max(72, t.errors.tooLong(72)),
  next: optionalText(500),
});

export const emailOnlySchema = z.object({ email, next: optionalText(500) });

export const signUpSchema = z.object({ full_name: text(120), email, password: newPassword });

export const newPasswordSchema = z
  .object({ password: newPassword, password_confirm: z.string({ error: t.errors.required }) })
  .refine((v) => v.password === v.password_confirm, { path: ['password_confirm'], message: t.auth.passwordMismatch });

/** Só caminho interno: impede redirecionamento aberto via ?next=. */
export function safeNext(next: string | null | undefined, fallback = '/painel'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
