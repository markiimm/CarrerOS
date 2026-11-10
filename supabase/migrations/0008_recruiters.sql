-- 0008 — Recrutadores, evidências de atividade, CRM de empresas
-- CareerOS · documentos 07 e 10 §8

create table if not exists public.recruiters (
  id                         uuid primary key default gen_random_uuid(),
  -- Nulo = identidade global compartilhada (RN-046). No uso pessoal, sempre preenchido.
  user_id                    uuid references auth.users(id) on delete cascade,
  full_name                  text not null,
  normalized_name            text not null,
  headline                   text,
  company_id                 uuid references public.companies(id) on delete set null,
  company_name_raw           text,
  profile_url                text,
  normalized_profile_url     text,
  specialties                text[] not null default '{}',
  source                     text not null default 'manual'
                             check (source in ('job_source','manual','import')),
  activity_status            public.recruiter_activity_status not null default 'no_activity_found',
  activity_status_reason     text,
  activity_status_updated_at timestamptz,
  last_activity_id           uuid,   -- FK adicionada ao fim deste arquivo
  last_activity_at           timestamptz,
  last_activity_confidence   public.confidence_level,
  next_review_at             timestamptz,
  merged_into_id             uuid references public.recruiters(id) on delete set null,
  merged_at                  timestamptz,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create unique index if not exists recruiters_profile_url_uidx
  on public.recruiters (normalized_profile_url) where normalized_profile_url is not null;
create index if not exists recruiters_user_status_idx
  on public.recruiters (user_id, activity_status, last_activity_at desc nulls last);
create index if not exists recruiters_normalized_name_trgm_idx
  on public.recruiters using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists recruiters_review_idx on public.recruiters (next_review_at)
  where next_review_at is not null;

-- RLS: o dono vê os seus; registros globais (user_id is null) são legíveis por autenticado.
alter table public.recruiters enable row level security;

drop policy if exists recruiters_select_own_or_global on public.recruiters;
create policy recruiters_select_own_or_global on public.recruiters
  for select to authenticated using (user_id = auth.uid() or user_id is null);

drop policy if exists recruiters_insert_own on public.recruiters;
create policy recruiters_insert_own on public.recruiters
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recruiters_update_own on public.recruiters;
create policy recruiters_update_own on public.recruiters
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recruiters_delete_own on public.recruiters;
create policy recruiters_delete_own on public.recruiters
  for delete to authenticated using (user_id = auth.uid());

select app_private.attach_updated_at('recruiters');

comment on column public.recruiters.activity_status is
  'Escrito exclusivamente por lib/recruiters/update-status.ts a partir de classifyRecruiter '
  '(documento 07 §3). Nunca por mutação direta da interface.';

-- ---------------------------------------------------------------------------
-- Evidências: sem evidência datada não há classificação (RN-040)
-- ---------------------------------------------------------------------------
create table if not exists public.recruiter_activities (
  id                     uuid primary key default gen_random_uuid(),
  recruiter_id           uuid not null references public.recruiters(id) on delete cascade,
  user_id                uuid references auth.users(id) on delete cascade,
  activity_type          public.recruiter_activity_type not null,
  is_recruiting_related  boolean not null,
  occurred_at            timestamptz,
  occurred_at_confidence public.confidence_level not null default 'unknown',
  observed_at            timestamptz not null default now(),
  url                    text,
  excerpt                text check (excerpt is null or length(excerpt) <= 280),
  source_id              uuid references public.job_sources(id) on delete set null,
  job_id                 uuid references public.jobs(id) on delete set null,
  created_by             text not null default 'user' check (created_by in ('system','user')),
  created_at             timestamptz not null default now(),
  -- Alguma verificabilidade é obrigatória (RN-040).
  constraint recruiter_activities_evidence_chk check (url is not null or excerpt is not null),
  -- Perfil existente/atualizado nunca é atividade de recrutamento (RN-042).
  constraint recruiter_activities_not_related_chk
    check (activity_type not in ('profile_update','generic_post') or is_recruiting_related = false),
  -- Sem data do fato, a confiança é obrigatoriamente unknown (RN-002 aplicado a atividades).
  constraint recruiter_activities_confidence_chk
    check (occurred_at is not null or occurred_at_confidence = 'unknown')
);

-- Idempotência da vinculação automática recrutador↔vaga (documento 07 §5.1).
create unique index if not exists recruiter_activities_job_uidx
  on public.recruiter_activities (recruiter_id, job_id) where job_id is not null;
create index if not exists recruiter_activities_timeline_idx
  on public.recruiter_activities (recruiter_id, occurred_at desc nulls last);
create index if not exists recruiter_activities_user_idx on public.recruiter_activities (user_id);

alter table public.recruiter_activities enable row level security;

drop policy if exists recruiter_activities_select on public.recruiter_activities;
create policy recruiter_activities_select on public.recruiter_activities
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.recruiters r
                where r.id = recruiter_activities.recruiter_id
                  and (r.user_id = auth.uid() or r.user_id is null)));

drop policy if exists recruiter_activities_insert on public.recruiter_activities;
create policy recruiter_activities_insert on public.recruiter_activities
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recruiter_activities_update on public.recruiter_activities;
create policy recruiter_activities_update on public.recruiter_activities
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recruiter_activities_delete on public.recruiter_activities;
create policy recruiter_activities_delete on public.recruiter_activities
  for delete to authenticated using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recruiters_last_activity_fk') then
    alter table public.recruiters
      add constraint recruiters_last_activity_fk
      foreign key (last_activity_id) references public.recruiter_activities(id) on delete set null;
  end if;
end $$;

-- FK de jobs.recruiter_id, declarada aqui por dependência circular (0007).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_recruiter_fk') then
    alter table public.jobs
      add constraint jobs_recruiter_fk
      foreign key (recruiter_id) references public.recruiters(id) on delete set null;
  end if;
end $$;

create index if not exists jobs_recruiter_idx on public.jobs (recruiter_id)
  where recruiter_id is not null;

-- ---------------------------------------------------------------------------
-- Interações registradas pelo usuário (CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.recruiter_contacts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  recruiter_id   uuid not null references public.recruiters(id) on delete cascade,
  channel        public.contact_channel not null,
  direction      public.contact_direction not null,
  subject        text,
  notes          text,
  occurred_at    timestamptz not null default now(),
  outcome        text,
  follow_up_at   timestamptz,
  follow_up_done boolean not null default false,
  application_id uuid,  -- FK adicionada em 0010
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists recruiter_contacts_recruiter_idx
  on public.recruiter_contacts (user_id, recruiter_id, occurred_at desc);
-- Consulta da notificação de follow-up (RF-CRM-04).
create index if not exists recruiter_contacts_followup_idx
  on public.recruiter_contacts (user_id, follow_up_at) where follow_up_done = false;

select app_private.apply_owner_rls('recruiter_contacts');
select app_private.attach_updated_at('recruiter_contacts');

-- ---------------------------------------------------------------------------
-- Empresas vetadas (precedência absoluta — RN-013) e empresas alvo
-- ---------------------------------------------------------------------------
create table if not exists public.company_blocklist (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  company_id           uuid references public.companies(id) on delete cascade,
  company_name_pattern text,
  reason               text,
  created_at           timestamptz not null default now(),
  constraint company_blocklist_target_chk
    check (company_id is not null or company_name_pattern is not null)
);

create unique index if not exists company_blocklist_company_uidx
  on public.company_blocklist (user_id, company_id) where company_id is not null;
create index if not exists company_blocklist_user_idx on public.company_blocklist (user_id);

select app_private.apply_owner_rls('company_blocklist');

create table if not exists public.company_watchlist (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  relationship      text not null default 'target' check (relationship in ('target','neutral')),
  alert_on_new_job  boolean not null default true,
  notes             text,
  rating            smallint check (rating between 1 and 5),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint company_watchlist_uk unique (user_id, company_id)
);

select app_private.apply_owner_rls('company_watchlist');
select app_private.attach_updated_at('company_watchlist');
