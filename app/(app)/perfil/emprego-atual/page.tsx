import { CurrentEmploymentCard } from '@/features/career-profile/components/employment-form';
import { getCurrentEmployment } from '@/features/career-profile/queries';
import { requireUser } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export default async function CurrentEmploymentPage() {
  const { supabase, user } = await requireUser();
  const employment = await getCurrentEmployment(supabase, user.id);
  return (
    <div className="max-w-3xl">
      <CurrentEmploymentCard employment={employment} />
    </div>
  );
}
