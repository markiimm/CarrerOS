-- =============================================================================
-- CareerOS — 0007 — Auditorias de LinkedIn, recomendações e currículos
-- Referência: docs/09-linkedin-analyzer.md | RN-060 a RN-067
-- =============================================================================

-- -----------------------------------------------------------------------------
-- linkedin_audits — imutável após completed (RN-066)
-- -----------------------------------------------------------------------------
create table if not exists public.linkedin_audits (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  career_profile_id    uuid references public.career_profiles (id) on delete set null,
  input_type           audit_input_type not null,
  -- URL pública ou caminho no Storage (bucket privado linkedin-exports)
  source_ref           text,
  status               audit_status not null default 'draft',
  overall_score        integer check (overall_score between 0 and 100),
  coverage             numeric(4,3) check (coverage between 0 and 1),
  evaluated_sections   linkedin_section[] not null default '{}',
  unavailable_sections linkedin_section[] not null default '{}',
  previous_audit_id    uuid references public.linkedin_audits (id) on delete set null,
  -- Pesos usados nesta auditoria: comparação histórica exige saber a régua
  weights              jsonb not null default '{}'::jsonb,
  model                text,
  prompt_version       text,
  ai_run_id            uuid,    -- FK adicionada em 0010
  error_message        text,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz,
  -- Auditoria concluída tem score e data de conclusão
  constraint linkedin_audits_completed_coherence check (
    status <> 'completed' or (overall_score is not null and completed_at is not null)),
  constraint linkedin_audits_not_self check (previous_audit_id is null or previous_audit_id <> id)
);

create index if not exists linkedin_audits_user_idx on public.linkedin_audits (user_id, created_at desc);
create index if not exists linkedin_audits_previous_idx on public.linkedin_audits (previous_audit_id);

-- -----------------------------------------------------------------------------
-- linkedin_audit_sections
-- -----------------------------------------------------------------------------
create table if not exists public.linkedin_audit_sections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  audit_id      uuid not null references public.linkedin_audits (id) on delete cascade,
  section       linkedin_section not null,
  was_evaluated boolean not null,
  score_0_10    numeric(3,1) check (score_0_10 between 0 and 10),
  weight        integer not null check (weight >= 0),
  -- Array de Finding: {checkId, severity, passed, evidence}
  findings      jsonb not null default '[]'::jsonb,
  raw_excerpt   text,
  created_at    timestamptz not null default now(),
  constraint linkedin_audit_sections_unique unique (audit_id, section),
  -- Seção não avaliada não tem nota (RN-060); avaliada tem
  constraint linkedin_audit_sections_score_coherence check (
    (was_evaluated and score_0_10 is not null) or (not was_evaluated and score_0_10 is null))
);

create index if not exists linkedin_audit_sections_audit_idx
  on public.linkedin_audit_sections (audit_id);

-- -----------------------------------------------------------------------------
-- linkedin_recommendations — as CINCO partes são obrigatórias (RN-063)
-- -----------------------------------------------------------------------------
create table if not exists public.linkedin_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  audit_id           uuid not null references public.linkedin_audits (id) on delete cascade,
  section            linkedin_section not null,
  issue              text not null,
  impact             text not null,
  how_to_fix         text not null,
  example_text       text not null,
  priority           numeric(6,2) not null,
  severity           severity_level not null,
  based_on_check_ids text[] not null default '{}',
  evidence           text,
  -- Marcadores [PREENCHER: ...] presentes no example_text — mecanismo anti-invenção (RN-065)
  placeholders       text[] not null default '{}',
  status             recommendation_status not null default 'pending',
  applied_at         timestamptz,
  user_edited_text   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- As cinco partes no banco, não só na aplicação
  constraint linkedin_recommendations_five_parts check (
    length(btrim(issue)) > 0 and length(btrim(impact)) > 0 and
    length(btrim(how_to_fix)) > 0 and length(btrim(example_text)) > 0),
  constraint linkedin_recommendations_applied_coherence check (
    status <> 'applied' or applied_at is not null)
);

create index if not exists linkedin_recommendations_audit_idx
  on public.linkedin_recommendations (audit_id, priority desc);
create index if not exists linkedin_recommendations_pending_idx
  on public.linkedin_recommendations (user_id, status) where status = 'pending';

-- -----------------------------------------------------------------------------
-- resumes / resume_versions — versão não é editada; nova edição = nova versão
-- -----------------------------------------------------------------------------
create table if not exists public.resumes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  career_profile_id uuid references public.career_profiles (id) on delete set null,
  name              text not null,
  target_role       text,
  is_default        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint resumes_name_unique unique (user_id, name)
);

create unique index if not exists resumes_one_default
  on public.resumes (user_id) where is_default;

create table if not exists public.resume_versions (
  id                           uuid primary key default gen_random_uuid(),
  user_id                      uuid not null references public.profiles (id) on delete cascade,
  resume_id                    uuid not null references public.resumes (id) on delete cascade,
  version                      integer not null check (version >= 1),
  label                        text,
  -- Estrutura do currículo (seções, bullets, ordem). Fonte de verdade da renderização.
  content                      jsonb not null,
  rendered_document_id         uuid,    -- FK adicionada em 0009
  generated_for_application_id uuid references public.applications (id) on delete set null,
  ai_run_id                    uuid,    -- FK adicionada em 0010
  created_at                   timestamptz not null default now(),
  constraint resume_versions_unique unique (resume_id, version)
);

create index if not exists resume_versions_resume_idx
  on public.resume_versions (resume_id, version desc);

-- FK pendente de 0006
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_resume_version_fk') then
    alter table public.applications
      add constraint applications_resume_version_fk
      foreign key (resume_version_id) references public.resume_versions (id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['linkedin_recommendations', 'resumes'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Imutabilidade da auditoria concluída, no banco.
-- A RLS já nega UPDATE por política; esta trigger protege também o service_role.
-- -----------------------------------------------------------------------------
create or replace function public.protect_completed_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception
      'Auditoria concluída é imutável (RN-066). Crie nova auditoria com previous_audit_id = %.', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_linkedin_audits_immutable on public.linkedin_audits;
create trigger trg_linkedin_audits_immutable
  before update on public.linkedin_audits
  for each row execute function public.protect_completed_audit();
