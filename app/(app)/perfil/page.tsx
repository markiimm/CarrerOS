import { CareerProfilesCard, LinksCard, PersonalDataCard, SkillsCard } from '@/features/career-profile/components/overview';
import { getProfileOverview } from '@/features/career-profile/queries';
import { ResumeImportCard } from '@/features/resume-import/components/resume-import';
import { requireUser } from '@/lib/db/server';
import { getPlanInfo } from '@/lib/plan';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const [data, plan] = await Promise.all([getProfileOverview(supabase, user.id), getPlanInfo(supabase, user.id)]);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <ResumeImportCard premium={plan.isPremium} />
      </div>
      <div className="grid gap-4">
        <CareerProfilesCard profiles={data.careerProfiles} skills={data.skills} experiences={data.experiences} />
        <SkillsCard skills={data.skills} catalog={data.skillCatalog} />
        <LinksCard links={data.links} />
      </div>
      <PersonalDataCard personal={data.personal} />
    </div>
  );
}
