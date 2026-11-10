-- 0005 — Perfil profissional: perfis, experiências, formação, competências, emprego atual
-- CareerOS · documento 10 §4.4

create table if not exists public.career_profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  target_title            text,
  normalized_target_title text,
  seniority               public.seniority_level,
  summary                 text,
  years_experience        numeric(4,1) check (years_experience >= 0),
  is_primary              boolean not null default false,
  completeness            smallint not null default 0 check (completeness between 0 and 100),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists career_profiles_one_primary_uidx
  on public.career_profiles (user_id) where is_primary;
create index if not exists career_profiles_user_idx on public.career_profiles (user_id, created_at desc);

select app_private.apply_owner_rls('career_profiles');
select app_private.attach_updated_at('career_profiles');

create table if not exists public.experiences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  company_name  text not null,
  role_title    text not null,
  start_date    date not null,
  end_date      date,
  is_current    boolean not null default false,
  description   text,
  achievements  text[] not null default '{}',
  technologies  text[] not null default '{}',
  location      text,
  contract_type public.contract_type,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint experiences_period_chk check (end_date is null or end_date >= start_date),
  constraint experiences_current_chk check (not is_current or end_date is null)
);

create index if not exists experiences_user_idx on public.experiences (user_id, start_date desc);

select app_private.apply_owner_rls('experiences');
select app_private.attach_updated_at('experiences');

-- Uma experiência pode compor vários perfis profissionais, com ordem própria em cada um.
create table if not exists public.career_profile_experiences (
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  experience_id     uuid not null references public.experiences(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  display_order     smallint not null default 0,
  primary key (career_profile_id, experience_id)
);

create index if not exists career_profile_experiences_user_idx
  on public.career_profile_experiences (user_id);

select app_private.apply_owner_rls('career_profile_experiences');

create table if not exists public.educations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  degree      text,
  field       text,
  start_date  date,
  end_date    date,
  status      text not null default 'completed'
              check (status in ('completed','in_progress','paused','dropped')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint educations_period_chk check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists educations_user_idx on public.educations (user_id);

select app_private.apply_owner_rls('educations');
select app_private.attach_updated_at('educations');

create table if not exists public.certifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  issuer         text,
  issued_at      date,
  expires_at     date,
  credential_id  text,
  credential_url text,
  document_id    uuid references public.documents(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint certifications_period_chk check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

-- Consulta da notificação de vencimento (RF-BIB-05).
create index if not exists certifications_expiring_idx
  on public.certifications (user_id, expires_at) where expires_at is not null;

select app_private.apply_owner_rls('certifications');
select app_private.attach_updated_at('certifications');

create table if not exists public.user_skills (
  user_id       uuid not null references auth.users(id) on delete cascade,
  skill_id      uuid not null references public.skills(id) on delete cascade,
  level         smallint not null check (level between 1 and 5),
  years_practice numeric(4,1) check (years_practice >= 0),
  evidence      text,
  last_used_at  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, skill_id)
);

select app_private.apply_owner_rls('user_skills');
select app_private.attach_updated_at('user_skills');

create table if not exists public.career_profile_skills (
  career_profile_id uuid not null references public.career_profiles(id) on delete cascade,
  skill_id          uuid not null references public.skills(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  importance        smallint not null default 2 check (importance between 1 and 3),
  primary key (career_profile_id, skill_id)
);

create index if not exists career_profile_skills_user_idx on public.career_profile_skills (user_id);

select app_private.apply_owner_rls('career_profile_skills');

create table if not exists public.profile_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('github','portfolio','linkedin','article','other')),
  url        text not null,
  label      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_links_url_scheme_chk check (url ~* '^https?://')
);

create index if not exists profile_links_user_idx on public.profile_links (user_id, kind);

select app_private.apply_owner_rls('profile_links');
select app_private.attach_updated_at('profile_links');

-- ---------------------------------------------------------------------------
-- Emprego atual: linha de base do Offer Comparator (RN-084). Dado SENSÍVEL.
-- ---------------------------------------------------------------------------
create table if not exists public.current_employment (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  company_id            uuid references public.companies(id) on delete set null,
  company_name          text not null,
  role_title            text not null,
  started_at            date,
  contract_type         public.contract_type not null default 'clt',
  base_salary           numeric(12,2) check (base_salary >= 0),
  currency              char(3) not null default 'BRL',
  salary_period         public.salary_period not null default 'month',
  bonus_annual          numeric(12,2),
  benefits              jsonb not null default '{}'::jsonb,
  work_model            public.work_model,
  commute_cost_monthly  numeric(10,2),
  commute_minutes_daily smallint,
  satisfaction          smallint check (satisfaction between 1 and 5),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

select app_private.apply_owner_rls('current_employment');
select app_private.attach_updated_at('current_employment');

comment on table public.current_employment is
  'Campo sensível (RNF-SEC-11): excluído de exportação não solicitada e de qualquer contexto enviado à IA (RN-072).';
