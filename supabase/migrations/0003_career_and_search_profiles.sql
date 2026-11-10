-- =============================================================================
-- CareerOS — 0003 — Perfis profissionais e perfis de busca
-- Referência: docs/10-modelo-de-dados.md §5, §6 | RN-010 a RN-017
-- =============================================================================

-- -----------------------------------------------------------------------------
-- career_profiles — QUEM O USUÁRIO É
-- -----------------------------------------------------------------------------
create table if not exists public.career_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  name                     text not null,
  target_role              text,
  target_areas             text[] not null default '{}',
  seniority                seniority_level,
  years_experience         numeric(4,1) check (years_experience >= 0 and years_experience <= 70),
  summary                  text,
  salary_expectation_min   numeric(14,2) check (salary_expectation_min >= 0),
  salary_expectation_max   numeric(14,2) check (salary_expectation_max >= 0),
  currency                 char(3) not null default 'BRL',
  preferred_work_models    work_model[] not null default '{}',
  preferred_contract_types contract_type[] not null default '{}',
  preferred_locations      jsonb not null default '[]'::jsonb,
  linkedin_url             text,
  github_url               text,
  portfolio_url            text,
  is_primary               boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint career_profiles_name_unique unique (user_id, name),
  constraint career_profiles_salary_range check (
    salary_expectation_min is null or salary_expectation_max is null
    or salary_expectation_max >= salary_expectation_min)
);

-- Apenas um perfil primário por usuário
create unique index if not exists career_profiles_one_primary
  on public.career_profiles (user_id) where is_primary;

create index if not exists career_profiles_user_idx on public.career_profiles (user_id);

-- -----------------------------------------------------------------------------
-- profile_experiences
-- -----------------------------------------------------------------------------
create table if not exists public.profile_experiences (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles (id) on delete cascade,
  company_name      text not null,
  role_title        text not null,
  employment_type   contract_type,
  started_on        date not null,
  ended_on          date,
  is_current        boolean not null default false,
  location          text,
  description       text,
  achievements      text[] not null default '{}',
  skills_used       text[] not null default '{}',
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profile_experiences_dates check (ended_on is null or ended_on >= started_on),
  constraint profile_experiences_current check (not (is_current and ended_on is not null))
);

create index if not exists profile_experiences_profile_idx
  on public.profile_experiences (career_profile_id, display_order);

-- -----------------------------------------------------------------------------
-- profile_education
-- -----------------------------------------------------------------------------
create table if not exists public.profile_education (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles (id) on delete cascade,
  institution       text not null,
  degree            text,
  field_of_study    text,
  started_on        date,
  ended_on          date,
  is_ongoing        boolean not null default false,
  description       text,
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profile_education_dates check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index if not exists profile_education_profile_idx
  on public.profile_education (career_profile_id, display_order);

-- -----------------------------------------------------------------------------
-- profile_certifications
-- -----------------------------------------------------------------------------
create table if not exists public.profile_certifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles (id) on delete cascade,
  name              text not null,
  issuer            text,
  issued_on         date,
  expires_on        date,
  credential_id     text,
  credential_url    text,
  document_id       uuid,     -- FK adicionada em 0009 (documents)
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profile_certifications_dates check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

create index if not exists profile_certifications_profile_idx
  on public.profile_certifications (career_profile_id, display_order);

-- -----------------------------------------------------------------------------
-- profile_projects
-- -----------------------------------------------------------------------------
create table if not exists public.profile_projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid not null references public.career_profiles (id) on delete cascade,
  name              text not null,
  description       text,
  role              text,
  url               text,
  repo_url          text,
  started_on        date,
  ended_on          date,
  tech_stack        text[] not null default '{}',
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profile_projects_profile_idx
  on public.profile_projects (career_profile_id, display_order);

-- -----------------------------------------------------------------------------
-- search_profiles — O QUE O USUÁRIO PROCURA
-- -----------------------------------------------------------------------------
create table if not exists public.search_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  -- NULL ⇒ componente "fit" do score fica indisponível (RN-010), não zerado
  career_profile_id uuid references public.career_profiles (id) on delete set null,
  name              text not null,
  keywords          text[] not null,
  excluded_keywords text[] not null default '{}',
  locations         jsonb not null default '[]'::jsonb,
  work_models       work_model[] not null default '{}',
  contract_types    contract_type[] not null default '{}',
  seniorities       seniority_level[] not null default '{}',
  salary_min        numeric(14,2) check (salary_min >= 0),
  currency          char(3) not null default 'BRL',
  -- Janela de recência: somente valores homologados (RN-017)
  recency_hours     integer not null default 24 check (recency_hours in (24, 72, 168, 360)),
  notify_min_score  integer check (notify_min_score between 0 and 100),
  is_active         boolean not null default true,
  last_run_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint search_profiles_name_unique unique (user_id, name),
  constraint search_profiles_keywords_not_empty check (array_length(keywords, 1) >= 1)
);

create index if not exists search_profiles_active_idx
  on public.search_profiles (user_id) where is_active;

-- -----------------------------------------------------------------------------
-- enforce_active_search_profile_limit() — RN-015
-- -----------------------------------------------------------------------------
create or replace function public.enforce_active_search_profile_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active then
    return new;                       -- já estava ativo, não muda a contagem
  end if;

  select max_active_search_profiles into v_limit
    from public.user_limits where user_id = new.user_id;
  v_limit := coalesce(v_limit, 10);

  select count(*) into v_count
    from public.search_profiles
   where user_id = new.user_id and is_active and id <> new.id;

  if v_count >= v_limit then
    raise exception
      'Limite de perfis de busca ativos atingido (%). Desative um perfil antes de ativar outro.',
      v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_search_profiles_limit on public.search_profiles;
create trigger trg_search_profiles_limit
  before insert or update of is_active on public.search_profiles
  for each row execute function public.enforce_active_search_profile_limit();

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['career_profiles', 'profile_experiences', 'profile_education',
                           'profile_certifications', 'profile_projects', 'search_profiles'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;
