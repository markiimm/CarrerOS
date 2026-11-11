'use client';

import { Award, Briefcase, ExternalLink, GraduationCap, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { ConfirmAction, FormDialog } from '@/components/form/action-form';
import { CheckboxField, FieldRow, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { EmptyState } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Tables } from '@/lib/db/database.types';
import { formatDate, formatMonthYear } from '@/lib/format';
import { t } from '@/lib/i18n/pt-BR';
import type { ActionResult } from '@/lib/utils/result';
import {
  deleteCertification, deleteEducation, deleteExperience, saveCertification, saveEducation, saveExperience,
} from '../actions';
import { certificationSchema, educationSchema, experienceSchema } from '../schemas';
import { toOptions } from './overview';

const period = (start: string | null, end: string | null, open: boolean) =>
  [start ? formatMonthYear(start) : null, end ? formatMonthYear(end) : open ? t.common.current : null]
    .filter(Boolean).join(' – ');

/** Cartão de lista com os estados vazio e preenchido e as ações de linha. */
function Section<T extends { id: string }>({
  copy, icon, items, form, remove, children,
}: {
  copy: { title: string; description: string; add: string; edit: string; empty: string; emptyBody: string; deleteTitle: string; deleteBody: string };
  icon: LucideIcon;
  items: T[];
  form: (item: T | undefined, trigger: React.ReactNode) => React.ReactNode;
  remove: (input: { id: string }) => Promise<ActionResult<void>>;
  children: (item: T) => React.ReactNode;
}) {
  const add = form(undefined, <Button size="sm"><Plus />{copy.add}</Button>);
  return (
    <Card>
      <CardHeader title={copy.title} description={copy.description} action={items.length ? add : null} />
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={icon} title={copy.empty} body={copy.emptyBody} action={add} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">{children(item)}</div>
                <div className="flex shrink-0">
                  {form(item, <Button variant="ghost" size="icon" aria-label={copy.edit}><Pencil /></Button>)}
                  <ConfirmAction
                    title={copy.deleteTitle}
                    body={copy.deleteBody}
                    action={() => remove({ id: item.id })}
                    trigger={<Button variant="ghost" size="icon" aria-label={t.common.remove}><Trash2 /></Button>}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ExperiencesCard({ items }: { items: Tables<'experiences'>[] }) {
  const e = t.profile.experiences;
  return (
    <Section
      copy={e}
      icon={Briefcase}
      items={items}
      remove={deleteExperience}
      form={(item, trigger) => (
        <FormDialog trigger={trigger} title={item ? e.edit : e.add} description={e.description} schema={experienceSchema} action={saveExperience}>
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <FieldRow>
            <TextField name="role_title" label={e.role} defaultValue={item?.role_title ?? ''} required />
            <TextField name="company_name" label={e.company} defaultValue={item?.company_name ?? ''} required />
          </FieldRow>
          <FieldRow>
            <TextField name="start_date" label={e.start} type="date" defaultValue={item?.start_date ?? ''} required />
            <TextField name="end_date" label={e.end} type="date" defaultValue={item?.end_date ?? ''} optional />
          </FieldRow>
          <CheckboxField name="is_current" label={e.isCurrent} defaultChecked={item?.is_current} />
          <FieldRow>
            <TextField name="location" label={e.location} defaultValue={item?.location ?? ''} optional />
            <SelectField name="contract_type" label={e.contractType} options={toOptions(t.enums.contractType)} defaultValue={item?.contract_type ?? ''} optional />
          </FieldRow>
          <TextareaField name="description" label={e.descriptionField} defaultValue={item?.description ?? ''} rows={3} optional />
          <TextareaField name="achievements" label={e.achievements} hint={e.achievementsHint} defaultValue={item?.achievements.join('\n') ?? ''} rows={3} optional />
          <TextField name="technologies" label={e.technologies} hint={e.technologiesHint} defaultValue={item?.technologies.join(', ') ?? ''} optional />
        </FormDialog>
      )}
    >
      {(item) => (
        <>
          <p className="font-medium">{item.role_title}</p>
          <p className="text-13 text-muted-foreground">
            {[item.company_name, period(item.start_date, item.end_date, item.is_current), item.location].filter(Boolean).join(' · ')}
          </p>
          {item.description ? <p className="mt-1.5 max-w-[72ch] whitespace-pre-line text-13">{item.description}</p> : null}
          {item.achievements.length ? (
            <ul className="mt-1.5 max-w-[72ch] list-disc pl-5 text-13">
              {item.achievements.map((a) => <li key={a}>{a}</li>)}
            </ul>
          ) : null}
          {item.technologies.length ? (
            <div className="mt-2 flex flex-wrap gap-1">{item.technologies.map((tech) => <Badge key={tech}>{tech}</Badge>)}</div>
          ) : null}
        </>
      )}
    </Section>
  );
}

export function EducationsCard({ items }: { items: Tables<'educations'>[] }) {
  const e = t.profile.education;
  return (
    <Section
      copy={e}
      icon={GraduationCap}
      items={items}
      remove={deleteEducation}
      form={(item, trigger) => (
        <FormDialog trigger={trigger} title={item ? e.edit : e.add} schema={educationSchema} action={saveEducation}>
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <TextField name="institution" label={e.institution} defaultValue={item?.institution ?? ''} required />
          <FieldRow>
            <TextField name="degree" label={e.degree} placeholder={e.degreePlaceholder} defaultValue={item?.degree ?? ''} optional />
            <TextField name="field" label={e.field} defaultValue={item?.field ?? ''} optional />
          </FieldRow>
          <FieldRow className="sm:grid-cols-3">
            <TextField name="start_date" label={e.start} type="date" defaultValue={item?.start_date ?? ''} optional />
            <TextField name="end_date" label={e.end} type="date" defaultValue={item?.end_date ?? ''} optional />
            <SelectField name="status" label={e.status} options={toOptions(e.statuses)} defaultValue={item?.status ?? 'completed'} placeholder={null} required />
          </FieldRow>
        </FormDialog>
      )}
    >
      {(item) => (
        <>
          <p className="font-medium">{[item.degree, item.field].filter(Boolean).join(' · ') || item.institution}</p>
          <p className="text-13 text-muted-foreground">
            {[item.degree || item.field ? item.institution : null, period(item.start_date, item.end_date, false), e.statuses[item.status]]
              .filter(Boolean).join(' · ')}
          </p>
        </>
      )}
    </Section>
  );
}

export function CertificationsCard({ items, today }: { items: Tables<'certifications'>[]; today: string }) {
  const c = t.profile.certifications;
  return (
    <Section
      copy={c}
      icon={Award}
      items={items}
      remove={deleteCertification}
      form={(item, trigger) => (
        <FormDialog trigger={trigger} title={item ? c.edit : c.add} schema={certificationSchema} action={saveCertification}>
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <FieldRow>
            <TextField name="name" label={c.name} defaultValue={item?.name ?? ''} required />
            <TextField name="issuer" label={c.issuer} defaultValue={item?.issuer ?? ''} optional />
          </FieldRow>
          <FieldRow>
            <TextField name="issued_at" label={c.issuedAt} type="date" defaultValue={item?.issued_at ?? ''} optional />
            <TextField name="expires_at" label={c.expiresAt} type="date" defaultValue={item?.expires_at ?? ''} optional />
          </FieldRow>
          <FieldRow>
            <TextField name="credential_id" label={c.credentialId} defaultValue={item?.credential_id ?? ''} optional />
            <TextField name="credential_url" label={c.credentialUrl} type="url" placeholder="https://" defaultValue={item?.credential_url ?? ''} optional />
          </FieldRow>
        </FormDialog>
      )}
    >
      {(item) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {item.name}
            {item.expires_at && item.expires_at < today ? <Badge tone="destructive">{c.expired}</Badge> : null}
          </p>
          <p className="text-13 text-muted-foreground">
            {[item.issuer, item.issued_at ? formatMonthYear(item.issued_at) : null, item.expires_at ? c.validUntil(formatDate(item.expires_at)) : c.noExpiry]
              .filter(Boolean).join(' · ')}
          </p>
          {item.credential_url ? (
            <a href={item.credential_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-13 text-primary underline-offset-4 hover:underline">
              {c.credentialUrl}
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </>
      )}
    </Section>
  );
}
