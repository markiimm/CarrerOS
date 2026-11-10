-- =============================================================================
-- CareerOS — 0010 — Row Level Security
-- Referência: docs/10-modelo-de-dados.md §14 | docs/16-seguranca.md
--
-- REGRA ABSOLUTA: RLS ativa em TODAS as tabelas de public. A autorização é do
-- banco, não da aplicação (ADR-002). O teste de CI em §14 do documento 10 falha
-- se qualquer tabela ficar sem RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Passo 1 — habilitar RLS em tudo
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security;', r.relname);
    -- Nem o dono da tabela escapa da RLS: protege contra engano em função
    -- security definer mal escrita.
    execute format('alter table public.%I force row level security;', r.relname);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Passo 2 — PADRÃO A: dado pessoal com coluna user_id (CRUD do dono)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'user_settings', 'user_limits',
    'career_profiles', 'profile_experiences', 'profile_education',
    'profile_certifications', 'profile_projects',
    'search_profiles', 'search_profile_sources',
    'job_matches', 'company_blocklist',
    'recruiter_contacts',
    'applications', 'interviews', 'job_offers',
    'linkedin_audit_sections', 'linkedin_recommendations',
    'resumes', 'resume_versions', 'documents',
    'user_skills', 'career_goals', 'study_plans', 'study_plan_items',
    'notifications', 'collector_queue'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %1$s_select_own on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert_own on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update_own on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete_own on public.%1$s;', t);

    execute format($f$
      create policy %1$s_select_own on public.%1$s
        for select to authenticated using (user_id = auth.uid());$f$, t);
    execute format($f$
      create policy %1$s_insert_own on public.%1$s
        for insert to authenticated with check (user_id = auth.uid());$f$, t);
    execute format($f$
      create policy %1$s_update_own on public.%1$s
        for update to authenticated using (user_id = auth.uid())
        with check (user_id = auth.uid());$f$, t);
    execute format($f$
      create policy %1$s_delete_own on public.%1$s
        for delete to authenticated using (user_id = auth.uid());$f$, t);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Passo 3 — PADRÃO B: histórico imutável (somente SELECT e INSERT)
-- RN-054 (candidaturas) e RN-040 (evidências de recrutador)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['application_events', 'recruiter_activities'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %1$s_select_own on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert_own on public.%1$s;', t);

    execute format($f$
      create policy %1$s_select_own on public.%1$s
        for select to authenticated using (user_id = auth.uid());$f$, t);
    execute format($f$
      create policy %1$s_insert_own on public.%1$s
        for insert to authenticated with check (user_id = auth.uid());$f$, t);
    -- Deliberadamente SEM política de update/delete: correção se faz por novo evento.
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Passo 4 — PADRÃO C: catálogo público (leitura por autenticado, escrita só service_role)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'jobs', 'companies', 'job_sources', 'skills', 'job_skills',
    'job_duplicates', 'market_insights'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %1$s_select_authenticated on public.%1$s;', t);
    execute format($f$
      create policy %1$s_select_authenticated on public.%1$s
        for select to authenticated using (true);$f$, t);
    -- Nenhuma política de escrita. service_role ignora RLS e é o único que grava.
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Passo 5 — Casos especiais
-- -----------------------------------------------------------------------------

-- profiles: a chave é id, não user_id
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Sem delete: a exclusão da conta passa por auth.users (cascata) e pela rotina de
-- exclusão do documento 16, que também apaga o Storage.

-- recruiters: user_id NULL = identidade global, legível por todos (RN-046)
drop policy if exists recruiters_select_own_or_global on public.recruiters;
drop policy if exists recruiters_insert_own on public.recruiters;
drop policy if exists recruiters_update_own on public.recruiters;
drop policy if exists recruiters_delete_own on public.recruiters;
create policy recruiters_select_own_or_global on public.recruiters
  for select to authenticated using (user_id = auth.uid() or user_id is null);
create policy recruiters_insert_own on public.recruiters
  for insert to authenticated with check (user_id = auth.uid());
create policy recruiters_update_own on public.recruiters
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recruiters_delete_own on public.recruiters
  for delete to authenticated using (user_id = auth.uid());

-- recruiter_jobs: não tem user_id; a autorização vem do recrutador
drop policy if exists recruiter_jobs_select on public.recruiter_jobs;
drop policy if exists recruiter_jobs_insert on public.recruiter_jobs;
drop policy if exists recruiter_jobs_delete on public.recruiter_jobs;
create policy recruiter_jobs_select on public.recruiter_jobs
  for select to authenticated using (exists (
    select 1 from public.recruiters r
     where r.id = recruiter_jobs.recruiter_id and (r.user_id = auth.uid() or r.user_id is null)));
create policy recruiter_jobs_insert on public.recruiter_jobs
  for insert to authenticated with check (exists (
    select 1 from public.recruiters r
     where r.id = recruiter_jobs.recruiter_id and r.user_id = auth.uid()));
create policy recruiter_jobs_delete on public.recruiter_jobs
  for delete to authenticated using (exists (
    select 1 from public.recruiters r
     where r.id = recruiter_jobs.recruiter_id and r.user_id = auth.uid()));

-- linkedin_audits: imutabilidade condicional (RN-066)
drop policy if exists linkedin_audits_select_own on public.linkedin_audits;
drop policy if exists linkedin_audits_insert_own on public.linkedin_audits;
drop policy if exists linkedin_audits_update_own_unfinished on public.linkedin_audits;
drop policy if exists linkedin_audits_delete_own on public.linkedin_audits;
create policy linkedin_audits_select_own on public.linkedin_audits
  for select to authenticated using (user_id = auth.uid());
create policy linkedin_audits_insert_own on public.linkedin_audits
  for insert to authenticated with check (user_id = auth.uid());
create policy linkedin_audits_update_own_unfinished on public.linkedin_audits
  for update to authenticated
  using (user_id = auth.uid() and status <> 'completed')
  with check (user_id = auth.uid());
create policy linkedin_audits_delete_own on public.linkedin_audits
  for delete to authenticated using (user_id = auth.uid());

-- user_credentials: o segredo NUNCA é lido pela UI (RN-091).
-- Leitura só pela view v_user_credentials_safe (0011); aqui, só escrita e exclusão.
drop policy if exists user_credentials_insert_own on public.user_credentials;
drop policy if exists user_credentials_delete_own on public.user_credentials;
drop policy if exists user_credentials_select_own on public.user_credentials;
create policy user_credentials_insert_own on public.user_credentials
  for insert to authenticated with check (user_id = auth.uid());
create policy user_credentials_delete_own on public.user_credentials
  for delete to authenticated using (user_id = auth.uid());
-- Deliberadamente sem SELECT para authenticated: use a view.

-- Revoga o acesso direto à coluna cifrada, mesmo para quem tenha SELECT
revoke select on public.user_credentials from authenticated, anon;

-- ai_runs: leitura própria; escrita apenas pelo servidor (service_role)
drop policy if exists ai_runs_select_own on public.ai_runs;
create policy ai_runs_select_own on public.ai_runs
  for select to authenticated using (user_id = auth.uid());

-- collector_runs: leitura própria (painel de execuções); escrita pelo servidor
drop policy if exists collector_runs_select_own on public.collector_runs;
create policy collector_runs_select_own on public.collector_runs
  for select to authenticated using (user_id = auth.uid() or user_id is null);

-- job_raw_payloads: nenhum acesso pelo cliente (dado de depuração)
-- Sem políticas = nada passa. service_role grava e lê.

-- audit_logs: o usuário pode ver o próprio log, nunca alterá-lo
drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select to authenticated using (user_id = auth.uid());

-- rate_limit_hits: nenhum acesso pelo cliente. Sem políticas.

-- -----------------------------------------------------------------------------
-- Passo 6 — Revogações de superfície
-- -----------------------------------------------------------------------------
-- O papel anon não acessa nada em public: todo acesso exige sessão autenticada.
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke all on public.%I from anon;', r.relname);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Passo 7 — Verificação (falha a migration se alguma tabela ficou sem RLS)
-- -----------------------------------------------------------------------------
do $$
declare v_missing text;
begin
  select string_agg(c.relname, ', ') into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;

  if v_missing is not null then
    raise exception 'Tabelas sem RLS em public: %', v_missing;
  end if;
end$$;
