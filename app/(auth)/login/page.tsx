import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/auth-card';
import { LoginForm } from '@/features/auth/components/auth-forms';
import { safeNext } from '@/features/auth/schemas';
import { isSupabaseConfigured } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.auth.loginTitle };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  return (
    <AuthCard
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      alert={erro === 'link' ? t.auth.linkInvalid : null}
      footer={{ text: t.auth.noAccount, href: '/cadastro', link: t.auth.signUp }}
    >
      <LoginForm next={safeNext(next)} disabled={!isSupabaseConfigured()} />
    </AuthCard>
  );
}
