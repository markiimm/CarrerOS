-- 0010 — Candidaturas, histórico imutável e entrevistas
-- CareerOS · documento 10 §9 · RN-050 a RN-056

create table if not exists public.applications (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  -- Vaga é opcional e pode desaparecer: a candidatura permanece íntegra (RN-050).
  job_id                   uuid references public.jobs(id) on delete set null,
  company_id               uuid references public.companies(id) on delete set null,
  company_name             text not null,
  role_title               text not null,
  job_url                  text,
  salary_min               numeric(12,2),
  salary_max               numeric(12,2),
  salary_currency          char(3),
  salary_period            public.salary_period,
  stage                    public.application_stage not null default 'radar',
  stage_changed_at         timestamptz not null default now(),
  applied_at               timestamptz,
  next_action              text,
  next_action_at           timestamptz,
  is_stale                 boolean not null default false,
  is_archived              boolean not null default false,
  archived_at              timestamptz,
  recruiter_id             uuid references public.recruiters(id) on delete set null,
  resume_version_id        uuid,  -- FK adicionada em 0013
  cover_letter_document_id uuid references public.documents(id) on delete set null,
  origin                   text not null default 'manual' check (origin in ('radar','manual')),
  score_at_apply           smallint check (score_at_apply between 0 and 100),
  notes                    text,
  last_event_at            timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Próxima ação é data, não intenção (RN-056).
  constraint applications_next_action_chk
    check (next_action is null or next_action_at is not null)
);

-- Uma candidatura ativa por (usuário, vaga) — RN-053.
create unique index if not exists applications_active_job_uidx
  on public.applications (user_id, job_id)
  where job_id is not null and is_archived = false;

create index if not exists applications_board_idx
  on public.applications (user_id, stage, last_event_at desc) where is_archived = false;
create index if not exists applications_next_action_idx
  on public.applications (user_id, next_action_at)
  where next_action_at is not null and is_archived = false;
create index if not exists applications_stale_idx
  on public.applications (user_id, is_stale) where is_stale and is_archived = false;

select app_private.apply_owner_rls('applications');
select app_private.attach_updated_at('applications');

-- FK pendente de 0008.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recruiter_contacts_application_fk') then
    alter table public.recruiter_contacts
      add constraint recruiter_contacts_application_fk
      foreign key (application_id) references public.applications(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Histórico: somente inserção (RN-054). A RLS não concede UPDATE nem DELETE.
-- ---------------------------------------------------------------------------
create table if not exists public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  event_type     public.application_event_type not null,
  from_stage     public.application_stage,
  to_stage       public.application_stage,
  occurred_at    timestamptz not null default now(),
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  constraint application_events_stage_chk
    check (event_type <> 'stage_change' or to_stage is not null)
);

create index if not exists application_events_timeline_idx
  on public.application_events (application_id, occurred_at desc);
create index if not exists application_events_user_idx
  on public.application_events (user_id, occurred_at desc);

select app_private.apply_insert_only_rls('application_events');

comment on table public.application_events is
  'Imutável (RN-054): correção se faz por novo evento. Ausência de política de UPDATE/DELETE '
  'é intencional e é verificada por teste de RLS.';

-- Toda transição de estágio gera evento; entrar em applied preenche applied_at (RN-051).
create or replace function app_private.log_application_stage_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, user_id, event_type, to_stage, occurred_at)
    values (new.id, new.user_id, 'stage_change', new.stage, now());
    return new;
  end if;

  if new.stage is distinct from old.stage then
    insert into public.application_events
      (application_id, user_id, event_type, from_stage, to_stage, occurred_at)
    values (new.id, new.user_id, 'stage_change', old.stage, new.stage, now());

    new.stage_changed_at := now();
    new.last_event_at    := now();
    new.is_stale         := false;

    if new.stage = 'applied' and new.applied_at is null then
      new.applied_at := now();
    end if;

    -- Estados terminais zeram a próxima ação (RN-052).
    if new.stage in ('accepted','rejected','withdrawn') then
      new.next_action    := null;
      new.next_action_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists log_application_stage_change_ins on public.applications;
create trigger log_application_stage_change_ins
  after insert on public.applications
  for each row execute function app_private.log_application_stage_change();

drop trigger if exists log_application_stage_change_upd on public.applications;
create trigger log_application_stage_change_upd
  before update of stage on public.applications
  for each row execute function app_private.log_application_stage_change();

-- ---------------------------------------------------------------------------
-- Entrevistas
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  application_id    uuid not null references public.applications(id) on delete cascade,
  kind              public.interview_kind not null default 'other',
  scheduled_at      timestamptz,
  duration_minutes  smallint check (duration_minutes between 5 and 600),
  mode              text check (mode in ('remote','onsite','phone')),
  location_or_link  text,
  interviewers      jsonb not null default '[]'::jsonb,
  preparation_notes text,
  feedback_notes    text,
  outcome           text check (outcome in ('pending','passed','failed','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists interviews_agenda_idx on public.interviews (user_id, scheduled_at)
  where scheduled_at is not null;
create index if not exists interviews_application_idx on public.interviews (application_id);

select app_private.apply_owner_rls('interviews');
select app_private.attach_updated_at('interviews');

-- Estagnação (RN-055): chamada pela rotina diária.
create or replace function app_private.mark_stale_applications()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with updated as (
    update public.applications a
       set is_stale = true
      from public.user_settings s
     where s.user_id = a.user_id
       and a.is_archived = false
       and a.stage not in ('accepted','rejected','withdrawn')
       and a.is_stale = false
       and a.last_event_at < now() - make_interval(days => s.stale_after_days)
    returning a.id)
  select count(*) into v_count from updated;
  return v_count;
end $$;

revoke all on function app_private.mark_stale_applications() from anon, authenticated;
