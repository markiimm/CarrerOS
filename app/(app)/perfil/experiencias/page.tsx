import { CertificationsCard, EducationsCard, ExperiencesCard } from '@/features/career-profile/components/history';
import { getHistory } from '@/features/career-profile/queries';
import { requireUser } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const { supabase, user } = await requireUser();
  const data = await getHistory(supabase, user.id);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <ExperiencesCard items={data.experiences} />
      <div className="grid gap-4">
        <EducationsCard items={data.educations} />
        <CertificationsCard items={data.certifications} today={new Date().toISOString().slice(0, 10)} />
      </div>
    </div>
  );
}
