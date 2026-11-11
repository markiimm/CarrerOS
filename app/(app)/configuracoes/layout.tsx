import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page';
import { RouteTabs } from '@/components/layout/tabs';
import { t } from '@/lib/i18n/pt-BR';

export const metadata: Metadata = { title: t.settings.title };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={t.settings.title} description={t.settings.description} />
      <RouteTabs
        label={t.settings.title}
        tabs={[
          { href: '/configuracoes', label: t.settings.tabs.account },
          { href: '/configuracoes/aparencia', label: t.settings.tabs.appearance },
        ]}
      />
      <div className="grid max-w-3xl gap-4">{children}</div>
    </>
  );
}
