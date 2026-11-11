import { ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';

// O aviso de configuração depende do ambiente em execução, não do momento do build.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary font-mono text-base font-semibold text-primary-foreground">
            {t.app.name.slice(0, 1)}
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold">{t.app.name}</p>
            <p className="text-13 text-muted-foreground">{t.app.tagline}</p>
          </div>
        </div>
        {isSupabaseConfigured() ? null : (
          <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-13 text-warning">
            {t.auth.notConfigured}
          </p>
        )}
        <div className="rounded-lg border border-border bg-card p-6">{children}</div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
          {t.auth.privacyNote}
        </p>
      </div>
    </main>
  );
}
