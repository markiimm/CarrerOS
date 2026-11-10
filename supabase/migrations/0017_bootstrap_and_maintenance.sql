-- 0017 — Criação de usuário, contadores do dashboard, retenção e verificação de RLS
-- CareerOS · documento 10 §16, §18 e §19

-- ---------------------------------------------------------------------------
-- Novo usuário: cria as linhas padrão (RF-AUT-04)
-- ---------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_limits   (user_id) values (new.id) on conflict (user_id) do nothing;

  insert into public.offer_criteria_weights (user_id, criterion, weight)
  select new.id, c, 5
    from unnest(array['learning','stability','flexibility','management','career','risk','culture','commute']) as c
  on conflict (user_id, criterion) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Contadores do dashboard em uma única ida ao banco (RF-DSH-01)
-- Retorna NULL nos campos sem base de dados, para a interface distinguir
-- "sem dados ainda" de zero (RF-DSH-08, RNF-UX-07).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_counters(p_user_id uuid default auth.uid())
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'new_jobs_24h', (
      select count(*) from public.job_matches m
       where m.user_id = p_user_id and m.status = 'new' and m.matched_at >= now() - interval '24 hours'),
    'high_score_jobs', (
      select count(*) from public.job_matches m
       where m.user_id = p_user_id and m.status in ('new','seen','saved')
         and m.score >= 70 and m.low_confidence = false),
    'active_applications', (
      select count(*) from public.applications a
       where a.user_id = p_user_id and a.is_archived = false
         and a.stage not in ('accepted','rejected','withdrawn')),
    'interviews_next_7d', (
      select count(*) from public.interviews i
       where i.user_id = p_user_id and i.scheduled_at between now() and now() + interval '7 days'),
    'overdue_actions', (
      select count(*) from public.applications a
       where a.user_id = p_user_id and a.is_archived = false
         and a.next_action_at is not null and a.next_action_at < now()),
    'stale_applications', (
      select count(*) from public.applications a
       where a.user_id = p_user_id and a.is_stale and a.is_archived = false),
    'pending_linkedin_findings', (
      select count(*) from public.linkedin_audit_findings f
       where f.user_id = p_user_id and f.status = 'pending'),
    'ai_cost_cycle_usd',  public.current_ai_cycle_cost(p_user_id),
    'ai_cost_cap_usd', (
      select l.ai_monthly_cost_cap_usd from public.user_limits l where l.user_id = p_user_id),
    'has_collected_jobs', exists (
      select 1 from public.job_matches m where m.user_id = p_user_id),
    'has_linkedin_audit', exists (
      select 1 from public.linkedin_audits a where a.user_id = p_user_id and a.status = 'completed')
  )
$$;

-- ---------------------------------------------------------------------------
-- Retenção (documento 10 §19) — chamada por POST /api/cron/retention
-- ---------------------------------------------------------------------------
create or replace function app_private.run_retention()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payloads integer;
  v_runs     integer;
  v_ai       integer;
  v_logs     integer;
  v_notifs   integer;
begin
  delete from public.job_raw_payloads where fetched_at < now() - interval '90 days';
  get diagnostics v_payloads = row_count;

  delete from public.collector_runs where started_at < now() - interval '180 days';
  get diagnostics v_runs = row_count;

  delete from public.ai_runs where created_at < now() - interval '365 days';
  get diagnostics v_ai = row_count;

  delete from public.audit_logs l
   using public.user_settings s
   where s.user_id = l.user_id
     and l.created_at < now() - make_interval(days => s.data_retention_days);
  get diagnostics v_logs = row_count;

  delete from public.notifications
   where read_at is not null and read_at < now() - interval '90 days';
  get diagnostics v_notifs = row_count;

  delete from public.rate_limits where window_start < now() - interval '2 days';

  return jsonb_build_object('job_raw_payloads', v_payloads, 'collector_runs', v_runs,
                            'ai_runs', v_ai, 'audit_logs', v_logs, 'notifications', v_notifs);
end $$;

revoke all on function app_private.run_retention() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verificação de cobertura de RLS (RNF-SEC-01) — consumida pelo teste de CI
-- ---------------------------------------------------------------------------
create or replace view app_private.rls_coverage as
  select c.relname as table_name,
         c.relrowsecurity as rls_enabled,
         (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by c.relname;

comment on view app_private.rls_coverage is
  'O teste de CI falha se qualquer tabela em public tiver rls_enabled = false. '
  'Tabelas com policy_count = 0 são aceitas apenas se estiverem na lista branca de '
  'infraestrutura: collector_queue, rate_limits, job_raw_payloads.';
