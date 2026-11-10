-- =============================================================================
-- CareerOS — 0008 — Competências, metas, planos de estudo e inteligência de mercado
-- Referência: docs/10-modelo-de-dados.md §12 | RN-004
-- =============================================================================

-- -----------------------------------------------------------------------------
-- skills — catálogo global. aliases alimentam a extração determinística.
-- -----------------------------------------------------------------------------
create table if not exists public.skills (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  kind            skill_kind not null default 'technical',
  aliases         text[] not null default '{}',
  category        text,
  parent_skill_id uuid references public.skills (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists skills_aliases_idx  on public.skills using gin (aliases);
create index if not exists skills_category_idx on public.skills (category);
create index if not exists skills_name_trgm
  on public.skills using gin (public.canon(name) extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- job_skills — extraído por dicionário, SEM IA (RNF-COST-03)
-- -----------------------------------------------------------------------------
create table if not exists public.job_skills (
  job_id       uuid not null references public.jobs (id) on delete cascade,
  skill_id     uuid not null references public.skills (id) on delete cascade,
  requirement  text not null default 'unknown'
                 check (requirement in ('required', 'nice_to_have', 'unknown')),
  extracted_by text not null default 'dictionary' check (extracted_by in ('dictionary', 'user')),
  confidence   confidence_level not null default 'approximate',
  created_at   timestamptz not null default now(),
  primary key (job_id, skill_id)
);

create index if not exists job_skills_skill_idx on public.job_skills (skill_id);

-- -----------------------------------------------------------------------------
-- user_skills
-- career_profile_id nullable: competência pode ser do usuário (geral) ou de um perfil.
-- PK não aceita NULL, então usamos id + índice único com coalesce.
-- -----------------------------------------------------------------------------
create table if not exists public.user_skills (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid references public.career_profiles (id) on delete cascade,
  skill_id          uuid not null references public.skills (id) on delete cascade,
  level             skill_level not null default 'intermediate',
  years_experience  numeric(4,1) check (years_experience >= 0),
  last_used_on      date,
  -- Competência que o usuário QUER desenvolver (alimenta Career Growth)
  is_target         boolean not null default false,
  evidence          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists user_skills_unique
  on public.user_skills (user_id,
                         coalesce(career_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
                         skill_id);
create index if not exists user_skills_profile_idx on public.user_skills (career_profile_id);
create index if not exists user_skills_target_idx  on public.user_skills (user_id) where is_target;

-- -----------------------------------------------------------------------------
-- career_goals
-- -----------------------------------------------------------------------------
create table if not exists public.career_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid references public.career_profiles (id) on delete set null,
  title             text not null,
  description       text,
  target_role       text,
  target_date       date,
  status            goal_status not null default 'active',
  progress_pct      integer not null default 0 check (progress_pct between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists career_goals_user_idx on public.career_goals (user_id, status);

-- -----------------------------------------------------------------------------
-- study_plans / study_plan_items
-- -----------------------------------------------------------------------------
create table if not exists public.study_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  career_goal_id uuid references public.career_goals (id) on delete set null,
  name           text not null,
  target_role    text,
  start_date     date,
  target_date    date,
  status         goal_status not null default 'active',
  source         text not null default 'user_created'
                   check (source in ('ai_suggested', 'user_created')),
  ai_run_id      uuid,    -- FK adicionada em 0010
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint study_plans_dates check (target_date is null or start_date is null or target_date >= start_date)
);

create index if not exists study_plans_user_idx on public.study_plans (user_id, status);

create table if not exists public.study_plan_items (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  plan_id              uuid not null references public.study_plans (id) on delete cascade,
  skill_id             uuid references public.skills (id) on delete set null,
  title                text not null,
  kind                 text not null default 'course'
                         check (kind in ('course', 'certification', 'project', 'reading', 'practice')),
  provider             text,
  url                  text,
  estimated_hours      numeric(6,1) check (estimated_hours >= 0),
  priority             integer not null default 0,
  status               text not null default 'todo'
                         check (status in ('todo', 'doing', 'done', 'dropped')),
  started_at           timestamptz,
  completed_at         timestamptz,
  evidence_document_id uuid,   -- FK adicionada em 0009
  display_order        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint study_plan_items_done_coherence check (status <> 'done' or completed_at is not null)
);

create index if not exists study_plan_items_plan_idx
  on public.study_plan_items (plan_id, display_order);
create index if not exists study_plan_items_open_idx
  on public.study_plan_items (user_id, status) where status in ('todo', 'doing');

-- -----------------------------------------------------------------------------
-- market_insights — agregados, SEM user_id. Exibição exige amostra mínima (RN-004).
-- -----------------------------------------------------------------------------
create table if not exists public.market_insights (
  id           uuid primary key default gen_random_uuid(),
  metric       text not null check (metric in
                 ('salary_range', 'skill_demand', 'work_model_share', 'seniority_share',
                  'contract_share', 'top_companies')),
  -- {role, area, city, state, seniority} — a dimensão do recorte
  dimension    jsonb not null,
  period_start date not null,
  period_end   date not null,
  -- n é obrigatório: estatística sem amostra declarada não existe (RN-004)
  sample_size  integer not null check (sample_size >= 1),
  value        jsonb not null,
  computed_at  timestamptz not null default now(),
  source_note  text,
  constraint market_insights_period check (period_end >= period_start),
  constraint market_insights_unique unique (metric, dimension, period_start, period_end)
);

create index if not exists market_insights_lookup_idx
  on public.market_insights (metric, period_end desc);
create index if not exists market_insights_dimension_idx
  on public.market_insights using gin (dimension);

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['user_skills', 'career_goals', 'study_plans', 'study_plan_items'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;
