-- 0009 — Fila e histórico de execuções da coleta
-- CareerOS · documentos 06 §4 e 10 §7
-- collector_queue é infraestrutura: só service_role acessa.
-- collector_runs é legível pelo dono (aparece no diagnóstico, RNF-OBS-05).

create table if not exists public.collector_queue (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  source_id         uuid not null references public.job_sources(id) on delete cascade,
  status            public.queue_status not null default 'pending',
  priority          smallint not null default 0,
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          smallint not null default 0,
  last_error        text,
  cursor            text,
  -- md5(search_profile_id || source_id || date_trunc('hour', now())) — planner idempotente.
  dedupe_key        text not null unique,
  created_at        timestamptz not null default now()
);

create index if not exists collector_queue_claim_idx
  on public.collector_queue (status, scheduled_for, priority desc);
create index if not exists collector_queue_user_idx on public.collector_queue (user_id, created_at desc);

select app_private.apply_service_only_rls('collector_queue');

create table if not exists public.collector_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  search_profile_id uuid references public.search_profiles(id) on delete set null,
  source_id         uuid references public.job_sources(id) on delete set null,
  scope             text not null default 'jobs'
                    check (scope in ('jobs','recruiters','insights','recalc','retention','digest')),
  trigger           public.run_trigger not null default 'cron',
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_ms       integer,
  status            public.run_status not null default 'running',
  items_found       integer not null default 0,
  items_new         integer not null default 0,
  items_updated     integer not null default 0,
  items_duplicated  integer not null default 0,
  items_filtered    integer not null default 0,
  items_failed      integer not null default 0,
  filtered_reasons  jsonb not null default '{}'::jsonb,
  request_count     smallint not null default 0,
  error_message     text check (error_message is null or length(error_message) <= 2000),
  request_id        text
);

create index if not exists collector_runs_user_idx   on public.collector_runs (user_id, started_at desc);
create index if not exists collector_runs_source_idx on public.collector_runs (source_id, started_at desc);

alter table public.collector_runs enable row level security;

drop policy if exists collector_runs_select_own on public.collector_runs;
create policy collector_runs_select_own on public.collector_runs
  for select to authenticated using (user_id = auth.uid() or user_id is null);
-- Escrita somente por service_role: nenhuma política de insert/update/delete.

comment on column public.collector_runs.error_message is
  'Truncado em 2.000 caracteres. Nunca contém dado pessoal, token ou segredo (RNF-OBS-04).';
comment on column public.collector_runs.filtered_reasons is
  'Contadores por FilterReason (documento 06 §4.4): é o que explica ao usuário por que a coleta '
  'trouxe 3 vagas em vez de 80.';

-- ---------------------------------------------------------------------------
-- Reivindicação de lote: FOR UPDATE SKIP LOCKED (ADR-010, documento 06 §4.2)
-- ---------------------------------------------------------------------------
create or replace function app_private.claim_next_collector_lot()
returns public.collector_queue language plpgsql security definer set search_path = '' as $$
declare
  v_lot public.collector_queue;
begin
  update public.collector_queue q
     set status = 'processing',
         started_at = now(),
         attempts = q.attempts + 1
   where q.id = (
     select id from public.collector_queue
      where status = 'pending' and scheduled_for <= now()
      order by priority desc, scheduled_for
      for update skip locked
      limit 1)
  returning q.* into v_lot;

  return v_lot;
end $$;

revoke all on function app_private.claim_next_collector_lot() from anon, authenticated;

-- Falha de lote: backoff exponencial; 5 tentativas ⇒ 'dead' (documento 04 §2.8).
create or replace function app_private.fail_collector_lot(p_lot_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_attempts smallint;
begin
  select attempts into v_attempts from public.collector_queue where id = p_lot_id;

  update public.collector_queue
     set status        = case when v_attempts >= 5 then 'dead'::public.queue_status
                                                   else 'pending'::public.queue_status end,
         last_error    = left(coalesce(p_error, ''), 2000),
         scheduled_for = now() + (interval '1 minute' * power(3::double precision, least(v_attempts, 5)::double precision)),
         finished_at   = case when v_attempts >= 5 then now() else null end
   where id = p_lot_id;
end $$;

revoke all on function app_private.fail_collector_lot(uuid, text) from anon, authenticated;
