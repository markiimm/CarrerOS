'use client';

import { LayoutDashboard, Menu, Settings, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Documento 12 §1: ordem fixa. Um item só entra aqui na fase em que a tela passa a existir —
// nenhum link abre tela "em breve". Fases 2–5 acrescentam linhas a esta lista.
const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: t.nav.groups.overview, items: [{ href: '/painel', label: t.nav.dashboard, icon: LayoutDashboard }] },
  { group: t.nav.groups.positioning, items: [{ href: '/perfil', label: t.nav.profile, icon: UserRound }] },
  { group: t.nav.groups.system, items: [{ href: '/configuracoes', label: t.nav.settings, icon: Settings }] },
];

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/painel" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
        {t.app.name.slice(0, 1)}
      </span>
      <span className={cn('min-w-0 leading-tight', compact && 'lg:hidden xl:block')}>
        <span className="block text-sm font-semibold">{t.app.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{t.app.tagline}</span>
      </span>
    </Link>
  );
}

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t.nav.main} className="grid gap-5">
      {NAV.map((section) => (
        <div key={section.group} className="grid gap-1">
          <p className={cn('px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/80', compact && 'lg:sr-only xl:not-sr-only xl:px-3')}>
            {section.group}
          </p>
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  compact && 'lg:justify-center lg:px-0 xl:justify-start xl:px-3',
                  active && 'bg-secondary font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn(compact && 'lg:sr-only xl:not-sr-only')}>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** ≥ 1280 px: 260 px; 1024–1279 px: só ícones; < 1024 px: gaveta (MobileNav). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-border bg-card px-3 py-4 lg:flex lg:w-16 xl:w-[260px]">
      <div className="px-1 lg:flex lg:justify-center xl:block">
        <Brand compact />
      </div>
      <NavList compact />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.common.openMenu}>
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent title={t.common.menu} side="left" className="grid content-start gap-6 px-3 py-4">
        <div className="px-1">
          <Brand />
        </div>
        <NavList onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
