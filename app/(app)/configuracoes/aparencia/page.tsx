import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AppearanceForm } from '@/features/settings/components/appearance';
import { getAppearance } from '@/features/settings/queries';
import { requireUser } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const dynamic = 'force-dynamic';

export default async function AppearanceSettingsPage() {
  const { supabase, user } = await requireUser();
  const appearance = await getAppearance(supabase, user.id);
  return (
    <Card>
      <CardHeader title={t.settings.appearance.title} description={t.settings.appearance.description} />
      <CardContent>
        <AppearanceForm theme={appearance.theme} density={appearance.density} />
      </CardContent>
    </Card>
  );
}
