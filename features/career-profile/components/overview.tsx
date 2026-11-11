'use client';

import { CheckCircle2, ExternalLink, Layers, Link2, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { ActionForm, ConfirmAction, FormDialog } from '@/components/form/action-form';
import {
  CheckboxField, CheckboxGroup, FieldRow, NumberField, SelectField, TextareaField, TextField, type Option,
} from '@/components/form/fields';
import { EmptyState } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, Progress } from '@/components/ui/card';
import { COMPLETENESS_MIN_SKILLS, COMPLETENESS_MIN_SUMMARY_CHARS, type CompletenessCriterion } from '@/lib/config/rules';
import type { Tables } from '@/lib/db/database.types';
import { t } from '@/lib/i18n/pt-BR';
import {
  deleteCareerProfile, deleteLink, deleteUserSkill, saveCareerProfile, saveLink, savePersonalData,
  saveUserSkill, setPrimaryCareerProfile,
} from '../actions';
import type { CareerProfileView, UserSkillView } from '../queries';
import { careerProfileSchema, linkSchema, personalDataSchema, userSkillSchema } from '../schemas';

export const toOptions = (labels: Record<string, string>): Option[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));

function missingLabel(criterion: CompletenessCriterion): string {
  const m = t.profile.missing;
  if (criterion === 'summary') return m.summary(COMPLETENESS_MIN_SUMMARY_CHARS);
  if (criterion === 'skills') return m.skills(COMPLETENESS_MIN_SKILLS);
  return m[criterion];
}

// ─── Dados pessoais ──────────────────────────────────────────────────────────

export function PersonalDataCard({ personal }: { personal: Tables<'profiles'> | null }) {
  const p = t.profile.personal;
  return (
    <Card>
      <CardHeader title={p.title} description={p.description} />
      <CardContent>
        <ActionForm schema={personalDataSchema} action={savePersonalData}>
          <FieldRow>
            <TextField name="full_name" label={p.fullName} defaultValue={personal?.full_name ?? ''} autoComplete="name" required />
            <TextField name="headline" label={p.headline} placeholder={p.headlinePlaceholder} defaultValue={personal?.headline ?? ''} optional />
          </FieldRow>
          <FieldRow className="sm:grid-cols-3">
            <TextField name="city" label={p.city} defaultValue={personal?.city ?? ''} optional />
            <TextField name="state" label={p.state} defaultValue={personal?.state ?? ''} maxLength={40} optional />
            <TextField name="country" label={p.country} defaultValue={personal?.country ?? 'BR'} maxLength={2} required />
          </FieldRow>
          <FieldRow>
            <NumberField name="salary_expectation_min" label={p.salaryMin} defaultValue={num(personal?.salary_expectation_min)} optional />
            <NumberField name="salary_expectation_max" label={p.salaryMax} defaultValue={num(personal?.salary_expectation_max)} optional />
          </FieldRow>
          <CheckboxGroup name="accepted_work_models" label={p.workModels} options={toOptions(t.enums.workModel)} defaultValues={personal?.accepted_work_models ?? []} />
          <CheckboxGroup name="accepted_contract_types" label={p.contractTypes} options={toOptions(t.enums.contractType)} defaultValues={personal?.accepted_contract_types ?? []} />
          <div className="flex flex-wrap gap-x-6">
            <CheckboxField name="willing_to_relocate" label={p.relocate} defaultChecked={personal?.willing_to_relocate} />
            <CheckboxField name="willing_to_travel" label={p.travel} defaultChecked={personal?.willing_to_travel} />
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

// ─── Perfis profissionais ────────────────────────────────────────────────────

interface CareerFormProps {
  profile?: CareerProfileView;
  skillOptions: Option[];
  experienceOptions: Option[];
  trigger: React.ReactNode;
}

function CareerProfileDialog({ profile, skillOptions, experienceOptions, trigger }: CareerFormProps) {
  const c = t.profile.career;
  return (
    <FormDialog trigger={trigger} title={profile ? c.edit : c.new} schema={careerProfileSchema} action={saveCareerProfile}>
      <input type="hidden" name="id" value={profile?.id ?? ''} />
      <FieldRow>
        <TextField name="name" label={c.name} placeholder={c.namePlaceholder} defaultValue={profile?.name ?? ''} required />
        <TextField name="target_title" label={c.targetTitle} placeholder={c.targetTitlePlaceholder} defaultValue={profile?.target_title ?? ''} optional />
      </FieldRow>
      <FieldRow>
        <SelectField name="seniority" label={c.seniority} options={toOptions(t.enums.seniority)} defaultValue={profile?.seniority ?? ''} optional />
        <NumberField name="years_experience" label={c.years} defaultValue={num(profile?.years_experience)} optional />
      </FieldRow>
      <TextareaField name="summary" label={c.summary} hint={c.summaryHint} defaultValue={profile?.summary ?? ''} rows={5} optional />
      <CheckboxGroup name="skill_ids" label={c.skills} options={skillOptions} defaultValues={profile?.skillIds} emptyText={c.skillsEmpty} />
      <CheckboxGroup name="experience_ids" label={c.experiences} options={experienceOptions} defaultValues={profile?.experienceIds} emptyText={c.experiencesEmpty} />
    </FormDialog>
  );
}

export function CareerProfilesCard({
  profiles,
  skills,
  experiences,
}: {
  profiles: CareerProfileView[];
  skills: UserSkillView[];
  experiences: Array<Pick<Tables<'experiences'>, 'id' | 'role_title' | 'company_name'>>;
}) {
  const c = t.profile.career;
  const skillOptions = skills.map((s) => ({ value: s.skill_id, label: s.name }));
  const experienceOptions = experiences.map((e) => ({ value: e.id, label: `${e.role_title} · ${e.company_name}` }));
  const create = (
    <CareerProfileDialog
      skillOptions={skillOptions}
      experienceOptions={experienceOptions}
      trigger={<Button size="sm"><Plus />{c.new}</Button>}
    />
  );

  return (
    <Card>
      <CardHeader title={c.title} description={c.description} action={profiles.length ? create : null} />
      <CardContent className="grid gap-3">
        {profiles.length === 0 ? <EmptyState icon={Layers} title={c.empty} body={c.emptyBody} action={create} /> : null}
        {profiles.map((profile) => (
          <article key={profile.id} className="grid gap-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 font-medium">
                  {profile.name}
                  {profile.is_primary ? <Badge tone="primary"><Star />{c.primary}</Badge> : null}
                </h3>
                <p className="text-13 text-muted-foreground">
                  {[profile.target_title, profile.seniority ? t.enums.seniority[profile.seniority] : null].filter(Boolean).join(' · ') || t.common.unknown}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {profile.is_primary ? null : (
                  <form action={async () => { await setPrimaryCareerProfile({ id: profile.id }); }}>
                    <Button type="submit" variant="ghost" size="sm">{c.makePrimary}</Button>
                  </form>
                )}
                <CareerProfileDialog
                  profile={profile}
                  skillOptions={skillOptions}
                  experienceOptions={experienceOptions}
                  trigger={<Button variant="ghost" size="icon" aria-label={c.edit}><Pencil /></Button>}
                />
                <ConfirmAction
                  title={c.deleteTitle}
                  body={c.deleteBody}
                  action={() => deleteCareerProfile({ id: profile.id })}
                  trigger={<Button variant="ghost" size="icon" aria-label={t.common.remove}><Trash2 /></Button>}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-13">
                <span className="text-muted-foreground">{c.completeness}</span>
                <span className="tabular font-mono font-medium">{profile.computed.score}%</span>
              </div>
              <Progress value={profile.computed.score} label={c.completeness} />
            </div>
            {profile.computed.missing.length === 0 ? (
              <p className="flex items-center gap-1.5 text-13 text-success"><CheckCircle2 className="size-4" />{c.complete}</p>
            ) : (
              <div className="text-13">
                <p className="font-medium">{c.missing}</p>
                <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-muted-foreground sm:grid-cols-2">
                  {profile.computed.missing.map((criterion) => <li key={criterion}>{missingLabel(criterion)}</li>)}
                </ul>
              </div>
            )}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Competências ────────────────────────────────────────────────────────────

function SkillDialog({
  skill,
  catalog,
  trigger,
}: {
  skill?: UserSkillView;
  catalog: Array<Pick<Tables<'skills'>, 'id' | 'name' | 'category'>>;
  trigger: React.ReactNode;
}) {
  const s = t.profile.skills;
  const options: Option[] = catalog.map((item) => ({
    value: item.id,
    label: item.name,
    group: t.enums.skillCategory[item.category] ?? t.enums.skillCategory.other,
  }));
  return (
    <FormDialog trigger={trigger} title={skill ? s.edit : s.add} schema={userSkillSchema} action={saveUserSkill}>
      {skill ? (
        <>
          <input type="hidden" name="skill_id" value={skill.skill_id} />
          <p className="font-medium">{skill.name}</p>
        </>
      ) : (
        <SelectField name="skill_id" label={s.skill} options={options} required />
      )}
      <FieldRow>
        <SelectField name="level" label={s.level} options={toOptions(s.levels)} defaultValue={String(skill?.level ?? 3)} placeholder={null} required />
        <NumberField name="years_practice" label={s.years} defaultValue={num(skill?.years_practice)} optional />
      </FieldRow>
      <TextField name="evidence" label={s.evidence} hint={s.evidenceHint} defaultValue={skill?.evidence ?? ''} optional />
    </FormDialog>
  );
}

export function SkillsCard({
  skills,
  catalog,
}: {
  skills: UserSkillView[];
  catalog: Array<Pick<Tables<'skills'>, 'id' | 'name' | 'category'>>;
}) {
  const s = t.profile.skills;
  const owned = new Set(skills.map((skill) => skill.skill_id));
  const available = catalog.filter((item) => !owned.has(item.id));
  const add = available.length ? (
    <SkillDialog catalog={available} trigger={<Button size="sm"><Plus />{s.add}</Button>} />
  ) : null;

  return (
    <Card>
      <CardHeader title={s.title} description={s.description} action={skills.length ? add : null} />
      <CardContent>
        {catalog.length === 0 ? (
          <p role="alert" className="text-13 text-warning">{s.catalogEmpty}</p>
        ) : skills.length === 0 ? (
          <EmptyState icon={Sparkles} title={s.empty} body={s.emptyBody} action={add} />
        ) : (
          <ul className="divide-y divide-border">
            {skills.map((skill) => (
              <li key={skill.skill_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium">{skill.name}</span>
                <Badge>{s.levels[skill.level]}</Badge>
                {skill.years_practice !== null ? (
                  <span className="tabular text-13 text-muted-foreground">{s.yearsShort(skill.years_practice)}</span>
                ) : null}
                {skill.evidence ? <span className="min-w-0 truncate text-13 text-muted-foreground">{skill.evidence}</span> : null}
                <span className="ml-auto flex">
                  <SkillDialog skill={skill} catalog={catalog} trigger={<Button variant="ghost" size="icon" aria-label={s.edit}><Pencil /></Button>} />
                  <ConfirmAction
                    title={s.deleteTitle}
                    body={s.deleteBody}
                    action={() => deleteUserSkill({ id: skill.skill_id })}
                    trigger={<Button variant="ghost" size="icon" aria-label={t.common.remove}><Trash2 /></Button>}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Links ───────────────────────────────────────────────────────────────────

export function LinksCard({ links }: { links: Tables<'profile_links'>[] }) {
  const l = t.profile.links;
  const add = (
    <FormDialog trigger={<Button size="sm"><Plus />{l.add}</Button>} title={l.add} schema={linkSchema} action={saveLink}>
      <FieldRow>
        <SelectField name="kind" label={l.kind} options={toOptions(l.kinds)} defaultValue="github" placeholder={null} required />
        <TextField name="label" label={l.label} optional />
      </FieldRow>
      <TextField name="url" label={l.url} type="url" placeholder="https://" required />
    </FormDialog>
  );
  return (
    <Card>
      <CardHeader title={l.title} description={l.description} action={links.length ? add : null} />
      <CardContent>
        {links.length === 0 ? (
          <EmptyState icon={Link2} title={l.empty} body={l.emptyBody} action={add} />
        ) : (
          <ul className="divide-y divide-border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-3 py-2">
                <Badge>{l.kinds[link.kind] ?? l.kinds.other}</Badge>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 text-primary underline-offset-4 hover:underline">
                  <span className="truncate">{link.label || link.url}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
                <span className="ml-auto">
                  <ConfirmAction
                    title={l.deleteTitle}
                    body={l.deleteBody}
                    action={() => deleteLink({ id: link.id })}
                    trigger={<Button variant="ghost" size="icon" aria-label={t.common.remove}><Trash2 /></Button>}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
