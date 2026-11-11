'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

/** Abas de segundo nível; cada aba é uma rota. */
export function RouteTabs({ label, tabs }: { label: string; tabs: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active && 'border-primary font-medium text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
