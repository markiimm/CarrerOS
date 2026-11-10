-- 0001 — Extensões, schema privado e tipos enumerados
-- CareerOS · documento 10 §1 e §3
-- Idempotente: pode ser reaplicada sem efeito colateral.

create extension if not exists pgcrypto      with schema extensions;  -- gen_random_uuid, crypt
create extension if not exists pg_trgm       with schema extensions;  -- similaridade de título
create extension if not exists unaccent      with schema extensions;  -- busca sem acento
create extension if not exists citext        with schema extensions;  -- e-mails/slugs

-- Schema para funções internas que não devem ser expostas pela API REST do Supabase.
create schema if not exists app_private;
revoke all on schema app_private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('confidence_level',          array['exact','approximate','unknown']),
      ('published_at_source',       array['api_field','page_metadata','http_header','source_relative','first_seen']),
      ('work_model',                array['onsite','hybrid','remote']),
      ('contract_type',             array['clt','pj','internship','temporary','freelance','other']),
      ('seniority_level',           array['intern','junior','mid','senior','specialist','lead','manager']),
      ('salary_period',             array['hour','month','year']),
      ('source_kind',               array['official_api','ats_public_api','rss','jsonld_page','manual','email_alert']),
      ('source_legal_status',       array['allowed','review_needed','disallowed','requires_user_key']),
      ('source_status',             array['active','paused','degraded','disabled']),
      ('queue_status',              array['pending','processing','done','failed','dead']),
      ('run_status',                array['running','success','partial','failed']),
      ('run_trigger',               array['cron','manual','backfill']),
      ('job_match_status',          array['new','seen','saved','dismissed','sent_to_kanban','blocked']),
      ('duplicate_strategy',        array['source_identity','fingerprint','fuzzy','manual']),
      ('application_stage',         array['radar','interested','applied','screening','interview','technical_test','offer','accepted','rejected','withdrawn']),
      ('application_event_type',    array['stage_change','note','contact','interview_scheduled','interview_done','document_attached','next_action_set','archived','restored']),
      ('interview_kind',            array['screening','technical','panel','cultural','final','other']),
      ('recruiter_activity_status', array['active_recent','possibly_active','no_activity_found']),
      ('recruiter_activity_type',   array['job_post','recruiting_post','hiring_comment','direct_contact','event','generic_post','profile_update','user_observation']),
      ('contact_channel',           array['linkedin','email','phone','whatsapp','event','referral','other']),
      ('contact_direction',         array['inbound','outbound']),
      ('linkedin_input_method',     array['public_url','pasted_text','pdf_export','manual_form']),
      ('audit_status',              array['queued','running','completed','failed']),
      ('section_status',            array['evaluated','not_evaluable']),
      ('finding_severity',          array['critical','high','medium','low']),
      ('finding_status',            array['pending','applied','ignored']),
      ('document_kind',             array['resume','cover_letter','certificate','diploma','linkedin_pdf','offer','portfolio','other']),
      ('learning_item_type',        array['course','book','certification','project','practice','other']),
      ('item_status',               array['planned','in_progress','done','dropped']),
      ('offer_status',              array['draft','received','negotiating','accepted','declined','expired']),
      ('ai_feature',                array['linkedin_audit','job_analysis','resume_tailor','cover_letter','recruiter_message','interview_sim','interview_feedback','ats_check','profile_import']),
      ('ai_run_status',             array['success','validation_failed','blocked_by_cap','provider_error','cached']),
      ('notification_type',         array['new_jobs','follow_up_due','interview_soon','certification_expiring','source_degraded','ai_cap_reached','stale_application','offer_deadline','target_company_job']),
      ('notification_channel',      array['in_app','email'])
    ) as v(type_name, labels)
  loop
    if not exists (select 1 from pg_type where typname = t.type_name) then
      execute format('create type public.%I as enum (%s)',
        t.type_name,
        (select string_agg(quote_literal(l), ', ') from unnest(t.labels) as l));
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers de RLS (documento 10 §17)
-- Aplicam exatamente os padrões documentados; usar o helper evita divergência
-- entre tabelas e torna a revisão de segurança viável.
-- ---------------------------------------------------------------------------

-- Categoria 1 e 2: dado pessoal, acesso total do dono.
create or replace function app_private.apply_owner_rls(p_table text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_select_own', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
                 p_table || '_select_own', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_insert_own', p_table);
  execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
                 p_table || '_insert_own', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_update_own', p_table);
  execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
                 p_table || '_update_own', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_delete_own', p_table);
  execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
                 p_table || '_delete_own', p_table);
end $$;

-- Categoria 3: histórico imutável — somente SELECT e INSERT (RN-054).
create or replace function app_private.apply_insert_only_rls(p_table text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_select_own', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
                 p_table || '_select_own', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_insert_own', p_table);
  execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
                 p_table || '_insert_own', p_table);
  -- Ausência deliberada de políticas de UPDATE e DELETE: a operação é negada.
end $$;

-- Categoria 5: catálogo público — leitura por autenticado, escrita só service_role.
create or replace function app_private.apply_catalog_rls(p_table text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_select_authenticated', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (true)',
                 p_table || '_select_authenticated', p_table);
end $$;

-- Categoria 6: infraestrutura — RLS ligada e nenhuma política (só service_role acessa).
create or replace function app_private.apply_service_only_rls(p_table text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
end $$;

-- ---------------------------------------------------------------------------
-- Trigger genérica de updated_at
-- ---------------------------------------------------------------------------
create or replace function app_private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function app_private.attach_updated_at(p_table text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('drop trigger if exists set_updated_at on public.%I', p_table);
  execute format('create trigger set_updated_at before update on public.%I
                  for each row execute function app_private.set_updated_at()', p_table);
end $$;

-- Normalização determinística usada por dedupe e por busca (documento 06 §6 e §7).
-- Observação: unaccent é STABLE, não IMMUTABLE. Marcar esta função como IMMUTABLE é o
-- contorno padrão para poder usá-la em índices; em troca, NÃO se altera o dicionário
-- de unaccent depois de criado o banco (se alterar, reindexar).
create or replace function public.careeros_normalize(p_text text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
           lower(extensions.unaccent(coalesce(p_text, ''))),
           '[^a-z0-9]+', ' ', 'g'))
$$;
