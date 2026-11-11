'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { createServerClient } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';
import { issuesToErrors } from '@/lib/utils/form';
import { logger } from '@/lib/utils/logger';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { emailOnlySchema, newPasswordSchema, safeNext, signInSchema, signUpSchema } from './schemas';

function invalid(error: z.ZodError): ActionResult<never> {
  const [field, message] = Object.entries(issuesToErrors(error))[0] ?? ['_form', t.errors.generic];
  return fail('VALIDATION_FAILED', message, field === '_form' ? undefined : field);
}

/** Traduz o erro do serviço de autenticação sem repassar a mensagem original ao usuário. */
function authFailure(error: { code?: string; status?: number; message: string }, where: string): ActionResult<never> {
  const code = error.code ?? '';
  if (code === 'invalid_credentials') return fail('UNAUTHENTICATED', t.auth.invalidCredentials);
  if (code === 'email_not_confirmed') return fail('UNAUTHENTICATED', t.auth.emailNotConfirmed);
  if (code === 'weak_password') return fail('VALIDATION_FAILED', t.auth.weakPassword, 'password');
  if (code === 'same_password') return fail('VALIDATION_FAILED', t.auth.samePassword, 'password');
  if (code === 'session_not_found' || error.message === 'Auth session missing!') {
    return fail('UNAUTHENTICATED', t.auth.recoverySessionMissing);
  }
  if (error.status === 429 || code.startsWith('over_')) return fail('RATE_LIMITED', t.auth.rateLimited);
  const requestId = crypto.randomUUID();
  logger.error('auth.failed', { where, code, status: error.status, requestId });
  return fail('INTERNAL', t.errors.internal(requestId));
}

async function confirmUrl(next: string): Promise<string> {
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || h.get('origin') || `http://${h.get('host')}`;
  return `${origin.replace(/\/$/, '')}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signIn(input: unknown): Promise<ActionResult<void>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return authFailure(error, 'signIn');
  redirect(safeNext(parsed.data.next));
}

export async function sendMagicLink(input: unknown): Promise<ActionResult<void>> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: await confirmUrl(safeNext(parsed.data.next)) },
  });
  // Conta inexistente não é revelada: a resposta é a mesma (anti-enumeração).
  if (error && error.code !== 'otp_disabled' && error.code !== 'user_not_found') {
    return authFailure(error, 'sendMagicLink');
  }
  return ok(undefined);
}

export async function signUp(input: unknown): Promise<ActionResult<void>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: await confirmUrl('/painel') },
  });
  if (error) return authFailure(error, 'signUp');
  return ok(undefined);
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult<void>> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await confirmUrl('/nova-senha'),
  });
  if (error) return authFailure(error, 'requestPasswordReset');
  return ok(undefined);
}

export async function updatePassword(input: unknown): Promise<ActionResult<void>> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return authFailure(error, 'updatePassword');
  return ok(undefined);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
