import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/auth-card';
import { NewPasswordForm } from '@/features/auth/components/auth-forms';
import { createServerClient, isSupabaseConfigured } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.auth.newPasswordTitle };
export const dynamic = 'force-dynamic';

export default async function NewPasswordPage() {
  // Só há o que redefinir com a sessão criada pelo link de recuperação.
  let hasSession = false;
  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    hasSession = Boolean((await supabase.auth.getUser()).data.user);
  }
  return (
    <AuthCard
      title={t.auth.newPasswordTitle}
      subtitle={t.auth.newPasswordSubtitle}
      alert={hasSession ? null : t.auth.recoverySessionMissing}
      footer={{ href: hasSession ? '/painel' : '/recuperar-senha', link: hasSession ? t.errors.backToPanel : t.auth.recoverTitle }}
    >
      {hasSession ? <NewPasswordForm redirectTo="/painel" /> : null}
    </AuthCard>
  );
}
