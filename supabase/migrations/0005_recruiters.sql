-- =============================================================================
-- CareerOS — 0005 — Recrutadores, evidências de atividade e CRM
-- Referência: docs/07-monitoramento-recrutadores.md | RN-040 a RN-046
-- =============================================================================

-- -----------------------------------------------------------------------------
-- recruiters — user_id NULL = identidade global (RN-046)
-- -----------------------------------------------------------------------------
create table if not exists public.recruiters (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references public.profiles (id) on delete cascade,
  full_name                 text not null,
  normalized_name           text generated always as (public.canon(full_name)) stored,
  headline                  text,
  company_id                uuid references public.companies (id) on delete set null,
  company_name_raw          text,
  profile_url               text,
  -- Contato só existe se o usuário o informou após interação real (RN-045)
  email                     citext,
  phone                     text,
  city                      text,
  country                   char(2),
  specialties               text[] not null default '{}',
  is_agency                 boolean not null default false,
  -- SEMPRE derivado pelo classificador. Nunca editado à mão.
  activity_status           recruiter_activity_status not null default 'no_activity_found',
  last_activity_at          timestamptz,
  last_activity_confidence  confidence_level,
  status_computed_at        timestamptz,
  status_reason             text,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on column public.recruiters.activity_status is
  'Derivado de recruiter_activities por classifyRecruiter(). Perfil existente NÃO é atividade (RN-042).';

-- Unicidade por URL de perfil, por dono (o uuid zero representa "global")
create unique index if not exists recruiters_profile_url_unique
  on public.recruiters (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        lower(profile_url))
  where profile_url is not null;
create index if not exists recruiters_user_status_idx on public.recruiters (user_id, activity_status);
create index if not exists recruiters_recompute_idx   on public.recruiters (status_computed_at nulls first);
create index if not exists recruiters_company_idx     on public.recruiters (company_id);
create index if not exists recruiters_name_trgm
  on public.recruiters using gin (normalized_name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- recruiter_activities — EVIDÊNCIAS. Somente inserção (RN-040).
-- -----------------------------------------------------------------------------
create table if not exists public.recruiter_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  recruiter_id  uuid not null references public.recruiters (id) on delete cascade,
  activity_type recruiter_activity_type not null,
  -- NULL permitido: então observed_at manda e a confiança cai para 'unknown'
  occurred_at   timestamptz,
  observed_at   timestamptz not null default now(),
  confidence    confidence_level not null,
  evidence_url  text,
  excerpt       varchar(500),
  source        activity_source not null,
  job_id        uuid references public.jobs (id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Coerência: sem occurred_at a confiança só pode ser unknown
  constraint recruiter_activities_confidence_coherence check (
    occurred_at is not null or confidence = 'unknown'),
  -- Evidência automática exige URL
  constraint recruiter_activities_auto_needs_url check (
    source = 'user_manual' or evidence_url is not null)
);

-- Idempotência da evidência derivada de vaga (RN-043)
create unique index if not exists recruiter_activities_job_unique
  on public.recruiter_activities (recruiter_id, job_id, activity_type)
  where job_id is not null;
create index if not exists recruiter_activities_recent_idx
  on public.recruiter_activities (recruiter_id, occurred_at desc nulls last);
create index if not exists recruiter_activities_user_idx on public.recruiter_activities (user_id);

-- -----------------------------------------------------------------------------
-- recruiter_jobs — vaga ↔ recrutador
-- -----------------------------------------------------------------------------
create table if not exists public.recruiter_jobs (
  recruiter_id uuid not null references public.recruiters (id) on delete cascade,
  job_id       uuid not null references public.jobs (id) on delete cascade,
  role         text not null default 'unknown'
                 check (role in ('recruiter', 'hiring_manager', 'unknown')),
  created_at   timestamptz not null default now(),
  primary key (recruiter_id, job_id)
);

create index if not exists recruiter_jobs_job_idx on public.recruiter_jobs (job_id);

-- -----------------------------------------------------------------------------
-- recruiter_contacts — interações do usuário (sempre pessoal)
-- -----------------------------------------------------------------------------
create table if not exists public.recruiter_contacts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  recruiter_id   uuid not null references public.recruiters (id) on delete cascade,
  channel        text not null
                   check (channel in ('linkedin', 'email', 'phone', 'whatsapp', 'event', 'other')),
  direction      text not null check (direction in ('inbound', 'outbound')),
  occurred_at    timestamptz not null default now(),
  subject        text,
  notes          text,
  application_id uuid,    -- FK adicionada em 0006
  next_action    text,
  next_action_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Próxima ação é data, não intenção (RN-056)
  constraint recruiter_contacts_next_action check (next_action is null or next_action_at is not null)
);

create index if not exists recruiter_contacts_recruiter_idx
  on public.recruiter_contacts (recruiter_id, occurred_at desc);
create index if not exists recruiter_contacts_due_idx
  on public.recruiter_contacts (user_id, next_action_at) where next_action_at is not null;

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['recruiters', 'recruiter_contacts'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;
