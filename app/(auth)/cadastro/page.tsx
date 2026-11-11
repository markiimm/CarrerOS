import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/auth-card';
import { SignupForm } from '@/features/auth/components/auth-forms';
import { isSupabaseConfigured } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.auth.signupTitle };

export default function SignupPage() {
  return (
    <AuthCard
      title={t.auth.signupTitle}
      subtitle={t.auth.signupSubtitle}
      footer={{ text: t.auth.hasAccount, href: '/login', link: t.auth.signIn }}
    >
      <SignupForm disabled={!isSupabaseConfigured()} />
    </AuthCard>
  );
}
