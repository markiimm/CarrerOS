import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page';
import { RouteTabs } from '@/components/layout/tabs';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.profile.title };

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={t.profile.title} description={t.profile.description} />
      <RouteTabs
        label={t.profile.title}
        tabs={[
          { href: '/perfil', label: t.profile.tabs.overview },
          { href: '/perfil/experiencias', label: t.profile.tabs.history },
          { href: '/perfil/emprego-atual', label: t.profile.tabs.employment },
        ]}
      />
      {children}
    </>
  );
}
