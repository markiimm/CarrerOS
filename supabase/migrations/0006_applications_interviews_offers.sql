-- =============================================================================
-- CareerOS — 0006 — Candidaturas, histórico imutável, entrevistas e propostas
-- Referência: docs/10-modelo-de-dados.md §9 | RN-050 a RN-056, RN-080 a RN-085
-- =============================================================================

-- -----------------------------------------------------------------------------
-- applications — dados da vaga são COPIADOS na criação (RN-050)
-- -----------------------------------------------------------------------------
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  -- Vaga pode desaparecer do radar; a candidatura permanece íntegra
  job_id            uuid references public.jobs (id) on delete set null,
  search_profile_id uuid references public.search_profiles (id) on delete set null,
  recruiter_id      uuid references public.recruiters (id) on delete set null,
  resume_version_id uuid,     -- FK adicionada em 0007
  cover_letter_id   uuid,     -- FK adicionada em 0009 (documents)
  -- Cópia defensiva
  job_title         text not null,
  company_name      text not null,
  job_url           text,
  salary_min        numeric(14,2),
  salary_max        numeric(14,2),
  currency          char(3),
  work_model        work_model,
  contract_type     contract_type,
  location          text,
  -- Estado
  stage             application_stage not null default 'interested',
  stage_order       integer generated always as (public.application_stage_order(stage)) stored,
  applied_at        timestamptz,
  last_event_at     timestamptz not null default now(),
  next_action       text,
  next_action_at    timestamptz,
  source_note       text,
  notes             text,
  rejection_reason  text,
  is_archived       boolean not null default false,
  score_at_apply    integer check (score_at_apply between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint applications_next_action check (next_action is null or next_action_at is not null)
);

-- Uma candidatura ativa por (usuário, vaga) — RN-053
create unique index if not exists applications_user_job_active_unique
  on public.applications (user_id, job_id)
  where job_id is not null and is_archived = false;
create index if not exists applications_board_idx
  on public.applications (user_id, stage_order, next_action_at nulls last) where not is_archived;
create index if not exists applications_recent_idx on public.applications (user_id, last_event_at desc);
create index if not exists applications_due_idx
  on public.applications (user_id, next_action_at) where next_action_at is not null and not is_archived;

-- FK pendente de 0005
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recruiter_contacts_application_fk') then
    alter table public.recruiter_contacts
      add constraint recruiter_contacts_application_fk
      foreign key (application_id) references public.applications (id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- application_events — IMUTÁVEL (RN-054). Sem UPDATE, sem DELETE.
-- -----------------------------------------------------------------------------
create table if not exists public.application_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  event_type     text not null check (event_type in
                   ('created', 'stage_changed', 'note_added', 'document_attached',
                    'interview_scheduled', 'offer_received', 'contact_logged', 'reminder_set')),
  from_stage     application_stage,
  to_stage       application_stage,
  payload        jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists application_events_app_idx
  on public.application_events (application_id, occurred_at desc);
create index if not exists application_events_user_idx on public.application_events (user_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- log_application_stage_change() — o histórico não depende da aplicação lembrar
-- -----------------------------------------------------------------------------
create or replace function public.log_application_stage_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (user_id, application_id, event_type, to_stage, payload)
    values (new.user_id, new.id, 'created', new.stage,
            jsonb_build_object('job_title', new.job_title, 'company_name', new.company_name));
    return new;
  end if;

  if new.stage is distinct from old.stage then
    -- Ir para 'applied' sem data preenche a data (RN-051)
    if new.stage = 'applied' and new.applied_at is null then
      new.applied_at := now();
    end if;
    -- Estado terminal zera a próxima ação (RN-052)
    if public.is_terminal_stage(new.stage) then
      new.next_action    := null;
      new.next_action_at := null;
    end if;
    new.last_event_at := now();

    insert into public.application_events
      (user_id, application_id, event_type, from_stage, to_stage)
    values (new.user_id, new.id, 'stage_changed', old.stage, new.stage);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_applications_stage_insert on public.applications;
create trigger trg_applications_stage_insert
  after insert on public.applications
  for each row execute function public.log_application_stage_change();

drop trigger if exists trg_applications_stage_update on public.applications;
create trigger trg_applications_stage_update
  before update of stage on public.applications
  for each row execute function public.log_application_stage_change();

-- -----------------------------------------------------------------------------
-- interviews
-- -----------------------------------------------------------------------------
create table if not exists public.interviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  application_id     uuid references public.applications (id) on delete cascade,
  kind               interview_kind not null,
  scheduled_at       timestamptz,
  duration_minutes   integer check (duration_minutes between 5 and 600),
  mode               text check (mode in ('remote', 'onsite', 'phone')),
  location_or_link   text,
  interviewers       jsonb not null default '[]'::jsonb,
  agenda             text,
  preparation_notes  text,
  questions_asked    jsonb not null default '[]'::jsonb,
  self_assessment    jsonb,
  outcome            text not null default 'pending'
                       check (outcome in ('pending', 'passed', 'failed', 'cancelled')),
  feedback_received  text,
  ai_run_id          uuid,    -- FK adicionada em 0010 (ai_runs) — simulação de entrevista
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Simulação (mock) não precisa de candidatura; entrevista real precisa
  constraint interviews_application_required check (kind = 'mock' or application_id is not null)
);

create index if not exists interviews_user_schedule_idx
  on public.interviews (user_id, scheduled_at) where outcome = 'pending';
create index if not exists interviews_app_idx on public.interviews (application_id);

-- -----------------------------------------------------------------------------
-- job_offers — comparação SEMPRE com premissas declaradas (RN-080)
-- -----------------------------------------------------------------------------
create table if not exists public.job_offers (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  application_id          uuid references public.applications (id) on delete set null,
  company_name            text not null,
  role_title              text not null,
  status                  offer_status not null default 'received',
  received_at             timestamptz not null default now(),
  decision_deadline       timestamptz,
  contract_type           contract_type,
  work_model              work_model,
  city                    text,
  base_salary             numeric(14,2) not null check (base_salary >= 0),
  salary_period           salary_period not null default 'month',
  currency                char(3) not null default 'BRL',
  thirteenth_included     boolean not null default true,
  vacation_bonus_included boolean not null default true,
  annual_bonus            numeric(14,2) not null default 0,
  signing_bonus           numeric(14,2) not null default 0,
  equity_value_annual     numeric(14,2) not null default 0,
  -- [{kind, monthly_value, is_monetary, note}] — valor DECLARADO pelo usuário (RN-081)
  benefits                jsonb not null default '[]'::jsonb,
  commute_cost_monthly    numeric(14,2) not null default 0,
  commute_hours_monthly   numeric(5,1) not null default 0,
  pj_effective_tax_rate   numeric(5,2) check (pj_effective_tax_rate between 0 and 100),
  -- Premissas: alíquotas, versão da tabela, o que foi considerado. Sem isso, não se compara.
  assumptions             jsonb not null default '{}'::jsonb,
  tax_table_version       text,
  computed_total_annual   numeric(14,2),
  computed_vs_current_pct numeric(6,2),
  -- Critérios não financeiros com peso DO USUÁRIO (RN-085)
  criteria_scores         jsonb not null default '[]'::jsonb,
  weighted_score          numeric(5,2),
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists job_offers_user_idx on public.job_offers (user_id, received_at desc);
create index if not exists job_offers_deadline_idx
  on public.job_offers (user_id, decision_deadline)
  where decision_deadline is not null and status in ('received', 'negotiating');

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['applications', 'interviews', 'job_offers'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;
