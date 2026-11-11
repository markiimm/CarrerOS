import { Sidebar } from '@/components/layout/nav';
import { Topbar } from '@/components/layout/topbar';
import { signOut } from '@/features/auth/actions';
import { saveAppearance } from '@/features/settings/actions';
import { ThemeSync } from '@/features/settings/components/appearance';
import { getAppearance } from '@/features/settings/queries';
import { requireUser } from '@/lib/db/server';

// Dado pessoal nunca é cacheado por tempo (documento 04 §2.1).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const [appearance, profile] = await Promise.all([
    getAppearance(supabase, user.id),
    supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
  ]);

  return (
    <div className="flex min-h-dvh" data-density={appearance.density}>
      <ThemeSync theme={appearance.theme} />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          email={user.email ?? ''}
          displayName={profile.data?.full_name?.trim() || null}
          signOut={signOut}
          saveTheme={saveAppearance}
        />
        <main className="mx-auto grid w-full max-w-[1400px] flex-1 content-start gap-6 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
