'use client';

import { Crown, FileUp, Loader2, Lock, Sparkles } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatMonthYear } from '@/lib/format';
import { t } from '@/lib/i18n/pt-BR';
import { applyResumeImport, analyzeResume } from '../actions';
import type { ResumeDraft } from '../parse';

const r = t.profile.resumeImport;

const period = (start: string | null, end: string | null, current = false) =>
  [start ? formatMonthYear(start) : null, end ? formatMonthYear(end) : current ? t.common.current : null]
    .filter(Boolean).join(' – ');

interface Selection {
  personal: boolean;
  summary: boolean;
  skills: Set<string>;
  experiences: Set<number>;
  educations: Set<number>;
  certifications: Set<number>;
  links: Set<number>;
}

const allIndexes = (n: number) => new Set(Array.from({ length: n }, (_, i) => i));

function initialSelection(d: ResumeDraft): Selection {
  return {
    personal: true,
    summary: true,
    skills: new Set(d.skills.map((s) => s.skill_id)),
    experiences: allIndexes(d.experiences.length),
    educations: allIndexes(d.educations.length),
    certifications: allIndexes(d.certifications.length),
    links: allIndexes(d.links.length),
  };
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Check({
  checked, onChange, children, warn,
}: { checked: boolean; onChange: () => void; children: React.ReactNode; warn?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span className="min-w-0 flex-1">{children}</span>
      {warn ? <Badge tone="warning">{r.incomplete}</Badge> : null}
    </label>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-13 font-semibold">{title}</h3>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function ResumeImportCard({ premium }: { premium: boolean }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [draft, setDraft] = React.useState<ResumeDraft | null>(null);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [phase, setPhase] = React.useState<'analyze' | 'apply' | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const header = (
    <CardHeader
      title={r.title}
      description={r.description}
      action={<Badge tone="primary"><Crown />{r.premium}</Badge>}
    />
  );

  if (!premium) {
    return (
      <Card>
        {header}
        <CardContent>
          <EmptyState icon={Lock} title={r.lockedTitle} body={r.lockedBody} />
        </CardContent>
      </Card>
    );
  }

  function reset() {
    setDraft(null);
    setSelection(null);
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function analyze() {
    if (!file) { setError(r.errors.noFile); return; }
    setError(null);
    setPhase('analyze');
    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);
      const result = await analyzeResume(body);
      setPhase(null);
      if (!result.ok) { setError(result.error.message); return; }
      setDraft(result.data);
      setSelection(initialSelection(result.data));
    });
  }

  function apply() {
    if (!draft || !selection) return;
    const picked = <T,>(items: T[], set: Set<number>) => items.filter((_, i) => set.has(i));
    const personal = selection.personal ? draft.personal : { full_name: null, headline: null, city: null, state: null };
    const experiences = picked(draft.experiences, selection.experiences);
    const payload = {
      personal,
      summary: selection.summary ? draft.summary : null,
      years_experience: experiences.length ? draft.years_experience : null,
      skill_ids: [...selection.skills],
      experiences,
      educations: picked(draft.educations, selection.educations),
      certifications: picked(draft.certifications, selection.certifications),
      links: picked(draft.links, selection.links),
    };
    const nothing = !payload.summary && !payload.skill_ids.length && !experiences.length
      && !payload.educations.length && !payload.certifications.length && !payload.links.length
      && Object.values(personal).every((v) => !v);
    if (nothing) { setError(r.nothingSelected); return; }

    setError(null);
    setPhase('apply');
    startTransition(async () => {
      const result = await applyResumeImport(payload);
      setPhase(null);
      if (!result.ok) { setError(result.error.message); return; }
      toast.success(r.applied(result.data.added, result.data.skipped));
      reset();
    });
  }

  const hasPersonal = draft ? Object.values(draft.personal).some(Boolean) : false;
  const isEmpty = draft
    ? !hasPersonal && !draft.summary && !draft.skills.length && !draft.experiences.length
      && !draft.educations.length && !draft.certifications.length && !draft.links.length
    : false;

  return (
    <Card>
      {header}
      <CardContent className="grid gap-4">
        {!draft ? (
          <div className="grid gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              aria-label={r.pickFile}
              disabled={pending}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
              className="block w-full max-w-md text-13 text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-13 file:font-medium file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">{r.fileHint}</p>
            <div>
              <Button onClick={analyze} disabled={pending || !file}>
                {phase === 'analyze' ? <Loader2 className="animate-spin" /> : <FileUp />}
                {phase === 'analyze' ? r.analyzing : r.analyze}
              </Button>
            </div>
          </div>
        ) : isEmpty || !selection ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{r.emptyDraft}</p>
            {draft.warnings.map((w) => <p key={w} className="text-13 text-warning">{w}</p>)}
            <div><Button variant="secondary" onClick={reset}>{r.discard}</Button></div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div>
              <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" />{r.reviewTitle}</h3>
              <p className="mt-1 text-13 text-muted-foreground">{r.reviewHint}</p>
              {draft.years_experience !== null ? (
                <p className="mt-1 text-13 text-muted-foreground">{r.yearsLabel}: <strong>{r.years(draft.years_experience)}</strong></p>
              ) : null}
              {draft.warnings.map((w) => <p key={w} className="mt-1 text-13 text-warning">{w}</p>)}
            </div>

            {hasPersonal ? (
              <Group title={r.sections.personal}>
                <Check checked={selection.personal} onChange={() => setSelection({ ...selection, personal: !selection.personal })}>
                  <span className="text-sm">
                    {[draft.personal.full_name, draft.personal.headline, [draft.personal.city, draft.personal.state].filter(Boolean).join(' / ')]
                      .filter(Boolean).join(' · ')}
                  </span>
                </Check>
              </Group>
            ) : null}

            {draft.summary ? (
              <Group title={r.sections.summary}>
                <Check checked={selection.summary} onChange={() => setSelection({ ...selection, summary: !selection.summary })}>
                  <span className="line-clamp-3 text-sm text-muted-foreground">{draft.summary}</span>
                </Check>
              </Group>
            ) : null}

            {draft.experiences.length ? (
              <Group title={`${r.sections.experiences} (${draft.experiences.length})`}>
                {draft.experiences.map((x, i) => (
                  <Check
                    key={`${x.company_name}-${x.start_date}`}
                    checked={selection.experiences.has(i)}
                    onChange={() => setSelection({ ...selection, experiences: toggle(selection.experiences, i) })}
                    warn={x.incomplete}
                  >
                    <span className="block text-sm font-medium">{x.role_title}{' · '}{x.company_name}</span>
                    <span className="block text-xs text-muted-foreground">{period(x.start_date, x.end_date, x.is_current)}</span>
                  </Check>
                ))}
              </Group>
            ) : null}

            {draft.educations.length ? (
              <Group title={`${r.sections.educations} (${draft.educations.length})`}>
                {draft.educations.map((x, i) => (
                  <Check
                    key={`${x.institution}-${x.degree}`}
                    checked={selection.educations.has(i)}
                    onChange={() => setSelection({ ...selection, educations: toggle(selection.educations, i) })}
                    warn={x.incomplete}
                  >
                    <span className="block text-sm font-medium">{x.institution}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[x.degree, x.field].filter(Boolean).join(' em ')}{x.end_date ? ` · ${period(x.start_date, x.end_date)}` : ''}
                    </span>
                  </Check>
                ))}
              </Group>
            ) : null}

            {draft.certifications.length ? (
              <Group title={`${r.sections.certifications} (${draft.certifications.length})`}>
                {draft.certifications.map((x, i) => (
                  <Check
                    key={x.name}
                    checked={selection.certifications.has(i)}
                    onChange={() => setSelection({ ...selection, certifications: toggle(selection.certifications, i) })}
                  >
                    <span className="block text-sm">{x.name}</span>
                    {x.issuer ? <span className="block text-xs text-muted-foreground">{x.issuer}</span> : null}
                  </Check>
                ))}
              </Group>
            ) : null}

            {draft.links.length ? (
              <Group title={r.sections.links}>
                {draft.links.map((x, i) => (
                  <Check
                    key={x.url}
                    checked={selection.links.has(i)}
                    onChange={() => setSelection({ ...selection, links: toggle(selection.links, i) })}
                  >
                    <span className="break-all text-sm">{x.url}</span>
                  </Check>
                ))}
              </Group>
            ) : null}

            {draft.skills.length ? (
              <Group title={`${r.sections.skills} (${selection.skills.size}/${draft.skills.length})`} note={r.skillsNote}>
                <div className="flex flex-wrap gap-2 py-2">
                  {draft.skills.map((s) => {
                    const on = selection.skills.has(s.skill_id);
                    return (
                      <button
                        key={s.skill_id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSelection({ ...selection, skills: toggle(selection.skills, s.skill_id) })}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-secondary text-muted-foreground line-through'}`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </Group>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={apply} disabled={pending}>
                {phase === 'apply' ? <Loader2 className="animate-spin" /> : null}
                {phase === 'apply' ? r.applying : r.apply}
              </Button>
              <Button variant="secondary" onClick={reset} disabled={pending}>{r.discard}</Button>
            </div>
          </div>
        )}
        {error ? <p role="alert" className="text-13 text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
