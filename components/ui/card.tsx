import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('rounded-lg border border-border bg-card text-card-foreground', className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 p-[var(--card-pad)] pb-0', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {description ? <p className="mt-1 max-w-[72ch] text-13 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-[var(--card-pad)]', className)} {...props} />;
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' }) {
  const tones = {
    neutral: 'border-border bg-secondary text-muted-foreground',
    primary: 'border-primary/40 bg-primary/15 text-primary',
    success: 'border-success/40 bg-success/15 text-success',
    warning: 'border-warning/40 bg-warning/15 text-warning',
    destructive: 'border-destructive/40 bg-destructive/15 text-destructive',
  };
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3', tones[tone], className)}
      {...props}
    />
  );
}

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;
}
