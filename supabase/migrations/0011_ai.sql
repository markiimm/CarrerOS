-- 0011 — Execuções de IA, custo e assistente
-- CareerOS · documento 10 §11 · RN-006, RN-070 a RN-074

create table if not exists public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  feature        public.ai_feature not null,
  model          text not null,
  prompt_version text not null,
  input_hash     char(64) not null,
  status         public.ai_run_status not null,
  tokens_in      integer not null default 0,
  tokens_out     integer not null default 0,
  cost_usd       numeric(10,6) not null default 0 check (cost_usd >= 0),
  latency_ms     integer,
  cached         boolean not null default false,
  error_code     text,
  request_id     text,
  entity_type    text,
  entity_id      uuid,
  created_at     timestamptz not null default now()
);

create index if not exists ai_runs_user_idx  on public.ai_runs (user_id, created_at desc);
-- Cache por hash de entrada (RN-071).
create index if not exists ai_runs_cache_idx on public.ai_runs (user_id, input_hash, created_at desc)
  where status = 'success';

select app_private.apply_owner_rls('ai_runs');

comment on table public.ai_runs is
  'Rastreabilidade obrigatória de toda saída de IA (RN-006). NÃO armazena prompt nem resposta '
  'integral: apenas metadados, hash da entrada e custo (RNF-OBS-04).';

-- Custo do ciclo corrente, base do teto mensal (RN-070).
create or replace function public.current_ai_cycle_cost(p_user_id uuid default auth.uid())
returns numeric language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(r.cost_usd), 0)::numeric(10,4)
    from public.ai_runs r
    join public.user_limits l on l.user_id = r.user_id
   where r.user_id = p_user_id
     and r.created_at >= date_trunc('month', now())
     and r.status in ('success','validation_failed','provider_error')
$$;

create table if not exists public.assistant_threads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           public.ai_feature not null,
  job_id         uuid references public.jobs(id) on delete set null,
  application_id uuid references public.applications(id) on delete cascade,
  title          text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists assistant_threads_user_idx on public.assistant_threads (user_id, updated_at desc);

select app_private.apply_owner_rls('assistant_threads');
select app_private.attach_updated_at('assistant_threads');

create table if not exists public.assistant_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.assistant_threads(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('user','assistant','system')),
  content       text,
  artifact_type text check (artifact_type in
                  ('job_analysis','tailored_resume','cover_letter','recruiter_message',
                   'interview_questions','interview_feedback','ats_report')),
  artifact      jsonb,
  ai_run_id     uuid references public.ai_runs(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint assistant_messages_content_chk check (content is not null or artifact is not null)
);

create index if not exists assistant_messages_thread_idx on public.assistant_messages (thread_id, created_at);
create index if not exists assistant_messages_user_idx   on public.assistant_messages (user_id, created_at desc);

select app_private.apply_owner_rls('assistant_messages');
