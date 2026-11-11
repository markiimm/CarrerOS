import {
  AlarmClock, Bot, Briefcase, CalendarClock, CheckCircle2, ChevronRight, Circle, Hourglass, Radar, ScanSearch, Target,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { UnknownValue } from '@/components/layout/page';
import { Card, CardContent, CardHeader, Progress } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';
import type { DashboardData } from '../queries';

function CounterCard({
  icon: Icon, label, value, empty, detail, tone,
}: {
  icon: LucideIcon;
  label: string;
  /** Texto já formatado, ou null quando não há base para medir. */
  value: string | null;
  empty: string;
  detail?: string;
  tone?: 'warning';
}) {
  return (
    <Card className="grid content-between gap-3 p-[var(--card-pad)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-13 font-medium text-muted-foreground">{label}</h3>
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {value === null ? (
        <div>
          <p className="flex items-baseline gap-2 text-2xl font-semibold">
            <UnknownValue hint={empty} />
            <span className="text-13 font-normal text-unknown">{t.dashboard.noData}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <div>
          <p className={cn('tabular font-mono text-2xl font-semibold', tone === 'warning' && 'text-warning')}>{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      )}
    </Card>
  );
}

export function CounterGrid({ counters }: { counters: DashboardData['counters'] }) {
  const c = t.dashboard.cards;
  const n = (value: number | null) => (value === null ? null : formatNumber(value));
  const warn = (value: number | null) => (value ? ('warning' as const) : undefined);
  return (
    <section aria-label={t.dashboard.counters} className="grid gap-2">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CounterCard icon={Radar} label={c.newJobs.label} value={n(counters.newJobs24h)} empty={c.newJobs.empty} />
        <CounterCard icon={Target} label={c.highScore.label} value={n(counters.highScoreJobs)} empty={c.highScore.empty} />
        <CounterCard icon={Briefcase} label={c.activeApplications.label} value={n(counters.activeApplications)} empty={c.activeApplications.empty} />
        <CounterCard icon={CalendarClock} label={c.interviews.label} value={n(counters.interviewsNext7d)} empty={c.interviews.empty} />
        <CounterCard icon={AlarmClock} label={c.overdue.label} value={n(counters.overdueActions)} empty={c.overdue.empty} tone={warn(counters.overdueActions)} />
        <CounterCard icon={Hourglass} label={c.stale.label} value={n(counters.staleApplications)} empty={c.stale.empty} tone={warn(counters.staleApplications)} />
        <CounterCard icon={ScanSearch} label={c.linkedin.label} value={n(counters.pendingLinkedinFindings)} empty={c.linkedin.empty} />
        <CounterCard
          icon={Bot}
          label={c.aiCost.label}
          value={counters.aiCostUsd === null ? null : formatCurrency(counters.aiCostUsd, 'USD')}
          empty={c.aiCost.empty}
          detail={counters.aiCapUsd === null ? undefined : c.aiCost.of(formatCurrency(counters.aiCapUsd, 'USD'))}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t.dashboard.source}</p>
    </section>
  );
}

const STEPS: Array<{ key: keyof DashboardData['setup']; href: string }> = [
  { key: 'personal', href: '/perfil' },
  { key: 'careerProfile', href: '/perfil' },
  { key: 'skills', href: '/perfil' },
  { key: 'experience', href: '/perfil/experiencias' },
  { key: 'employment', href: '/perfil/emprego-atual' },
];

/** Estado vazio guiado: some quando todos os passos estão concluídos. */
export function SetupChecklist({ setup }: { setup: DashboardData['setup'] }) {
  const s = t.dashboard.setup;
  const done = STEPS.filter((step) => setup[step.key]).length;
  if (done === STEPS.length) return null;
  return (
    <Card>
      <CardHeader title={s.title} description={s.description} />
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <p className="tabular text-13 text-muted-foreground">{s.progress(done, STEPS.length)}</p>
          <Progress value={(done / STEPS.length) * 100} label={s.title} />
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {STEPS.map((step) => {
            const complete = setup[step.key];
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="flex h-full items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {complete ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" /> : <Circle aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.steps[step.key].title}</span>
                    <span className="block text-13 text-muted-foreground">{s.steps[step.key].body}</span>
                  </span>
                  <span className="sr-only">{complete ? s.done : s.pending}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
