import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Vazio por falta de dado: diz o que fazer e oferece a ação (RNF-UX-05). */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid justify-items-center gap-2 rounded-lg border border-dashed border-border px-6 py-8 text-center', className)}>
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="max-w-[52ch] text-13 text-muted-foreground">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Dado ausente tem forma própria e nunca se parece com zero (RNF-UX-07, RN-001). */
export function UnknownValue({ hint = t.common.unknownHint, className }: { hint?: string; className?: string }) {
  return (
    <span title={hint} className={cn('cursor-help text-unknown', className)}>
      <span aria-hidden>—</span>
      <span className="sr-only">{t.common.unknown}</span>
    </span>
  );
}
