import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { signOut } from '@/features/auth/actions';
import { NewPasswordForm } from '@/features/auth/components/auth-forms';
import { requireUser } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const { user } = await requireUser();
  const a = t.settings.account;
  return (
    <>
      <Card>
        <CardHeader title={a.title} description={a.description} />
        <CardContent>
          <dl className="grid gap-1">
            <dt className="text-13 text-muted-foreground">{a.email}</dt>
            <dd className="font-medium">{user.email}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={a.passwordTitle} description={a.passwordDescription} />
        <CardContent>
          <NewPasswordForm submitLabel={a.changePassword} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader
          title={a.sessionTitle}
          description={a.sessionDescription}
          action={
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                <LogOut />
                {t.auth.signOut}
              </Button>
            </form>
          }
        />
        <div className="h-[var(--card-pad)]" />
      </Card>
    </>
  );
}
