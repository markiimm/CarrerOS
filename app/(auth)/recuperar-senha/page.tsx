import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/auth-card';
import { RecoverForm } from '@/features/auth/components/auth-forms';
import { isSupabaseConfigured } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.auth.recoverTitle };

export default function RecoverPage() {
  return (
    <AuthCard
      title={t.auth.recoverTitle}
      subtitle={t.auth.recoverSubtitle}
      footer={{ href: '/login', link: t.auth.backToLogin }}
    >
      <RecoverForm disabled={!isSupabaseConfigured()} />
    </AuthCard>
  );
}
