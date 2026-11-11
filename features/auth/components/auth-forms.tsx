'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ActionForm } from '@/components/form/action-form';
import { TextField } from '@/components/form/fields';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n/pt-BR';
import { requestPasswordReset, sendMagicLink, signIn, signUp, updatePassword } from '../actions';
import { emailOnlySchema, newPasswordSchema, signInSchema, signUpSchema } from '../schemas';

function Sent({ message }: { message: string }) {
  return (
    <div role="status" className="grid justify-items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-5 text-center">
      <MailCheck aria-hidden className="size-6 text-success" />
      <p className="text-sm">{message}</p>
      <Button asChild variant="link">
        <Link href="/login">{t.auth.backToLogin}</Link>
      </Button>
    </div>
  );
}

const emailField = <TextField name="email" label={t.auth.email} type="email" autoComplete="email" required />;

export function LoginForm({ next, disabled }: { next: string; disabled?: boolean }) {
  const [mode, setMode] = React.useState<'password' | 'magic'>('password');
  const [sent, setSent] = React.useState(false);
  if (sent) return <Sent message={t.auth.magicSent} />;

  return (
    <fieldset disabled={disabled} className="grid gap-4">
      {mode === 'password' ? (
        <ActionForm
          key="password"
          schema={signInSchema}
          action={signIn}
          submitLabel={t.auth.signIn}
          pendingLabel={t.auth.signingIn}
          successMessage={null}
          className="[&>div:last-child>button]:w-full"
        >
          <input type="hidden" name="next" value={next} />
          {emailField}
          <TextField name="password" label={t.auth.password} type="password" autoComplete="current-password" required />
        </ActionForm>
      ) : (
        <ActionForm
          key="magic"
          schema={emailOnlySchema}
          action={sendMagicLink}
          submitLabel={t.auth.magicLink}
          pendingLabel={t.auth.sending}
          successMessage={null}
          onSuccess={() => setSent(true)}
          className="[&>div:last-child>button]:w-full"
        >
          <input type="hidden" name="next" value={next} />
          {emailField}
        </ActionForm>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-13">
        <Button variant="link" onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}>
          {mode === 'password' ? t.auth.magicLink : t.auth.signIn}
        </Button>
        <Link href="/recuperar-senha" className="text-primary underline-offset-4 hover:underline">
          {t.auth.forgot}
        </Link>
      </div>
    </fieldset>
  );
}

export function SignupForm({ disabled }: { disabled?: boolean }) {
  const [sent, setSent] = React.useState(false);
  if (sent) return <Sent message={t.auth.signupSent} />;
  return (
    <fieldset disabled={disabled}>
      <ActionForm
        schema={signUpSchema}
        action={signUp}
        submitLabel={t.auth.signUp}
        pendingLabel={t.auth.signingUp}
        successMessage={null}
        onSuccess={() => setSent(true)}
        className="[&>div:last-child>button]:w-full"
      >
        <TextField name="full_name" label={t.auth.fullName} autoComplete="name" required />
        {emailField}
        <TextField name="password" label={t.auth.password} type="password" autoComplete="new-password" hint={t.auth.passwordHint} required />
      </ActionForm>
    </fieldset>
  );
}

export function RecoverForm({ disabled }: { disabled?: boolean }) {
  const [sent, setSent] = React.useState(false);
  if (sent) return <Sent message={t.auth.recoverSent} />;
  return (
    <fieldset disabled={disabled}>
      <ActionForm
        schema={emailOnlySchema}
        action={requestPasswordReset}
        submitLabel={t.auth.sendRecover}
        pendingLabel={t.auth.sending}
        successMessage={null}
        onSuccess={() => setSent(true)}
        className="[&>div:last-child>button]:w-full"
      >
        {emailField}
      </ActionForm>
    </fieldset>
  );
}

/** Usado em /nova-senha (redireciona ao painel) e em Configurações → Conta (permanece na tela). */
export function NewPasswordForm({ redirectTo, submitLabel = t.auth.saveNewPassword }: { redirectTo?: string; submitLabel?: string }) {
  const router = useRouter();
  const [version, setVersion] = React.useState(0);
  return (
    <ActionForm
      key={version}
      schema={newPasswordSchema}
      action={updatePassword}
      submitLabel={submitLabel}
      successMessage={t.auth.passwordChanged}
      onSuccess={() => (redirectTo ? router.replace(redirectTo) : setVersion((v) => v + 1))}
    >
      <TextField name="password" label={t.settings.account.newPassword} type="password" autoComplete="new-password" hint={t.auth.passwordHint} required />
      <TextField name="password_confirm" label={t.auth.passwordConfirm} type="password" autoComplete="new-password" required />
    </ActionForm>
  );
}
