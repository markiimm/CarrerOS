import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page';
import { CounterGrid, SetupChecklist } from '@/features/dashboard/components/dashboard';
import { getDashboard } from '@/features/dashboard/queries';
import { requireUser } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.dashboard.title };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const data = await getDashboard(supabase, user.id);
  return (
    <>
      <PageHeader title={t.dashboard.title} description={t.dashboard.description} />
      <SetupChecklist setup={data.setup} />
      <CounterGrid counters={data.counters} />
    </>
  );
}
