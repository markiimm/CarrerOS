import { CareerProfilesCard, LinksCard, PersonalDataCard, SkillsCard } from '@/features/career-profile/components/overview';
import { getProfileOverview } from '@/features/career-profile/queries';
import { requireUser } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const data = await getProfileOverview(supabase, user.id);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="grid gap-4">
        <CareerProfilesCard profiles={data.careerProfiles} skills={data.skills} experiences={data.experiences} />
        <SkillsCard skills={data.skills} catalog={data.skillCatalog} />
        <LinksCard links={data.links} />
      </div>
      <PersonalDataCard personal={data.personal} />
    </div>
  );
}
