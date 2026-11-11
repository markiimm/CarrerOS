'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n/pt-BR';
import { MobileNav } from './nav';

const item =
  'flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-secondary [&_svg]:size-4';

type SaveTheme = (input: { theme: 'dark' | 'light' }) => Promise<unknown>;

export function ThemeToggle({ saveTheme }: { saveTheme?: SaveTheme }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === 'light';
  function toggle() {
    const next = isLight ? 'dark' : 'light';
    setTheme(next);
    // Persiste na conta para a preferência acompanhar o usuário em outro navegador.
    void saveTheme?.({ theme: next });
  }
  return (
    <Button variant="ghost" size="icon" aria-label={t.theme.toggle} title={t.theme.toggle} onClick={toggle}>
      {isLight ? <Moon /> : <Sun />}
    </Button>
  );
}

export function Topbar({
  email,
  displayName,
  signOut,
  saveTheme,
}: {
  email: string;
  displayName: string | null;
  signOut: () => Promise<void>;
  saveTheme: SaveTheme;
}) {
  const initial = (displayName || email).trim().charAt(0).toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
      <MobileNav />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle saveTheme={saveTheme} />
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label={t.nav.account} className="rounded-full">
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-foreground">
                {initial}
              </span>
            </Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-lg border border-border bg-popover p-1 shadow-xl animate-fade-in">
              <div className="px-2 py-2">
                {displayName ? <p className="truncate text-sm font-medium">{displayName}</p> : null}
                <p className="truncate text-13 text-muted-foreground">{email}</p>
              </div>
              <Menu.Separator className="my-1 h-px bg-border" />
              <Menu.Item asChild className={item}>
                <Link href="/configuracoes">
                  <Settings />
                  {t.nav.settings}
                </Link>
              </Menu.Item>
              <Menu.Item className={item} onSelect={() => void signOut()}>
                <LogOut />
                {t.auth.signOut}
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}
