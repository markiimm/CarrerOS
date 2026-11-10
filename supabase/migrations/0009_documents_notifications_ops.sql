-- =============================================================================
-- CareerOS — 0009 — Documentos, notificações, execuções de IA, fila do coletor e logs
-- Referência: docs/10-modelo-de-dados.md §11, §13 | RN-006, RN-070, RN-071
-- =============================================================================

-- -----------------------------------------------------------------------------
-- documents — biblioteca profissional. Arquivo em bucket PRIVADO.
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  kind                      document_kind not null,
  title                     text not null,
  -- {user_id}/{kind}/{uuid}.{ext} — o prefixo é a fronteira de isolamento
  storage_path              text not null,
  mime_type                 text,
  size_bytes                bigint check (size_bytes >= 0),
  checksum_sha256           text,
  issued_on                 date,
  expires_on                date,
  tags                      text[] not null default '{}',
  related_application_id    uuid references public.applications (id) on delete set null,
  related_certification_id  uuid references public.profile_certifications (id) on delete set null,
  is_sensitive              boolean not null default false,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint documents_storage_path_unique unique (storage_path),
  constraint documents_dates check (expires_on is null or issued_on is null or expires_on >= issued_on),
  -- O caminho precisa começar pelo user_id: trava de isolamento no banco
  constraint documents_path_prefix check (storage_path like (user_id::text || '/%'))
);

create index if not exists documents_user_kind_idx on public.documents (user_id, kind);
create index if not exists documents_tags_idx      on public.documents using gin (tags);
create index if not exists documents_expiring_idx
  on public.documents (user_id, expires_on) where expires_on is not null;

-- FKs pendentes de migrations anteriores
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_certifications_document_fk') then
    alter table public.profile_certifications
      add constraint profile_certifications_document_fk
      foreign key (document_id) references public.documents (id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'applications_cover_letter_fk') then
    alter table public.applications
      add constraint applications_cover_letter_fk
      foreign key (cover_letter_id) references public.documents (id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'resume_versions_document_fk') then
    alter table public.resume_versions
      add constraint resume_versions_document_fk
      foreign key (rendered_document_id) references public.documents (id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_plan_items_document_fk') then
    alter table public.study_plan_items
      add constraint study_plan_items_document_fk
      foreign key (evidence_document_id) references public.documents (id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- notifications — dedupe_key garante idempotência de envio
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in
                  ('new_jobs', 'high_score_job', 'recruiter_active', 'stale_application',
                   'action_due', 'source_degraded', 'ai_cap_reached', 'audit_ready',
                   'offer_deadline', 'document_expiring')),
  channel       notification_channel not null default 'in_app',
  title         text not null,
  body          text,
  payload       jsonb not null default '{}'::jsonb,
  status        notification_status not null default 'pending',
  dedupe_key    text not null,
  scheduled_for timestamptz,
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint notifications_dedupe_unique unique (user_id, dedupe_key)
);

create index if not exists notifications_inbox_idx
  on public.notifications (user_id, created_at desc) where status in ('sent', 'pending');
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null and status = 'sent';
create index if not exists notifications_due_idx
  on public.notifications (status, scheduled_for) where status = 'pending';

-- -----------------------------------------------------------------------------
-- ai_runs — rastreabilidade (RN-006), teto de custo (RN-070) e cache (RN-071)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  feature           text not null check (feature in
                      ('linkedin_audit', 'job_analysis', 'resume_tailor', 'cover_letter',
                       'interview_sim', 'study_plan', 'text_extract', 'profile_summary')),
  model             text not null,
  prompt_version    text not null,
  -- sha256(feature | prompt_version | model | input_canônico)
  input_hash        text not null,
  status            ai_run_status not null,
  input_tokens      integer,
  output_tokens     integer,
  cache_read_tokens integer,
  cost_usd          numeric(10,6) not null default 0,
  latency_ms        integer,
  validation_errors jsonb,
  output_ref        jsonb,
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists ai_runs_user_idx on public.ai_runs (user_id, created_at desc);
-- Suporta a consulta de cache (RN-071)
create index if not exists ai_runs_cache_idx
  on public.ai_runs (user_id, feature, input_hash, created_at desc) where status = 'success';

-- FKs pendentes que apontam para ai_runs
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'linkedin_audits_ai_run_fk') then
    alter table public.linkedin_audits
      add constraint linkedin_audits_ai_run_fk
      foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'interviews_ai_run_fk') then
    alter table public.interviews
      add constraint interviews_ai_run_fk
      foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resume_versions_ai_run_fk') then
    alter table public.resume_versions
      add constraint resume_versions_ai_run_fk
      foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_plans_ai_run_fk') then
    alter table public.study_plans
      add constraint study_plans_ai_run_fk
      foreign key (ai_run_id) references public.ai_runs (id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- collector_runs — toda execução é registrada, inclusive a que falhou (RN-029)
-- -----------------------------------------------------------------------------
create table if not exists public.collector_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete cascade,
  search_profile_id uuid references public.search_profiles (id) on delete set null,
  source_id         uuid references public.job_sources (id) on delete set null,
  trigger           text not null check (trigger in ('cron', 'manual', 'retry')),
  status            run_status not null default 'running',
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_ms       integer,
  items_found       integer not null default 0,
  items_new         integer not null default 0,
  items_updated     integer not null default 0,
  items_duplicated  integer not null default 0,
  items_filtered    integer not null default 0,
  items_failed      integer not null default 0,
  -- Contadores por motivo de filtro: é assim que se depura perfil mal configurado
  filtered_reasons  jsonb not null default '{}'::jsonb,
  request_count     integer not null default 0,
  error_message     text
);

create index if not exists collector_runs_user_idx on public.collector_runs (user_id, started_at desc);
create index if not exists collector_runs_source_idx on public.collector_runs (source_id, started_at desc);

-- -----------------------------------------------------------------------------
-- collector_queue — a fila é uma tabela (ADR-010), consumida com SKIP LOCKED
-- -----------------------------------------------------------------------------
create table if not exists public.collector_queue (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  search_profile_id uuid not null references public.search_profiles (id) on delete cascade,
  source_id         uuid not null references public.job_sources (id) on delete cascade,
  status            queue_status not null default 'pending',
  priority          integer not null default 0,
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          integer not null default 0,
  last_error        text,
  cursor            text,
  -- md5(search_profile_id || source_id || date_trunc('hour', now())) — planner idempotente
  dedupe_key        text not null unique,
  created_at        timestamptz not null default now()
);

create index if not exists collector_queue_claim_idx
  on public.collector_queue (status, scheduled_for, priority desc) where status = 'pending';
create index if not exists collector_queue_user_idx on public.collector_queue (user_id, status);

-- -----------------------------------------------------------------------------
-- claim_next_collector_lot() — reivindicação atômica de lote
-- -----------------------------------------------------------------------------
create or replace function public.claim_next_collector_lot()
returns public.collector_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.collector_queue;
begin
  update public.collector_queue q
     set status = 'processing', started_at = now(), attempts = q.attempts + 1
   where q.id = (
     select id from public.collector_queue
      where status = 'pending' and scheduled_for <= now()
      order by priority desc, scheduled_for
      for update skip locked
      limit 1)
  returning q.* into v_lot;

  return v_lot;
end;
$$;

revoke all on function public.claim_next_collector_lot() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- audit_logs — sem dado pessoal em claro (RNF-SEC-09)
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles (id) on delete set null,
  actor           text not null check (actor in ('user', 'system', 'cron')),
  action          text not null,
  entity_type     text,
  entity_id       text,
  -- IP e user-agent apenas como hash com sal da aplicação
  ip_hash         text,
  user_agent_hash text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_user_idx    on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at);

-- -----------------------------------------------------------------------------
-- rate_limit_hits — rate limiting sem Redis (ADR-010)
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  id         bigint generated always as identity primary key,
  bucket     text not null,              -- ex.: 'manual_collect:{user_id}'
  user_id    uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_idx on public.rate_limit_hits (bucket, created_at desc);

create or replace function public.check_rate_limit(
  p_bucket text, p_user_id uuid, p_limit integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_hits
   where created_at < now() - interval '7 days';          -- limpeza oportunista

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket and created_at > now() - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, user_id) values (p_bucket, p_user_id);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
