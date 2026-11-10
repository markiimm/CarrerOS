-- =============================================================================
-- CareerOS — 0011 — Views de leitura, buckets de Storage e funções de servidor
-- Referência: docs/10-modelo-de-dados.md §15, §16, §17
--
-- TODA view usa security_invoker = true: sem isso a view roda com os privilégios
-- do criador e FURA a RLS. View sem security_invoker é falha de segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_source_credential() — único caminho de leitura do segredo (RN-091)
-- -----------------------------------------------------------------------------
create or replace function public.get_source_credential(p_user_id uuid, p_source_id uuid)
returns bytea
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret bytea;
begin
  select secret_ciphertext into v_secret
    from public.user_credentials
   where user_id = p_user_id and source_id = p_source_id
   order by created_at desc
   limit 1;

  if v_secret is not null then
    update public.user_credentials
       set last_used_at = now()
     where user_id = p_user_id and source_id = p_source_id;
  end if;

  return v_secret;   -- ainda cifrado: a decifragem é na aplicação
end;
$$;

-- Nenhum cliente chama isso: só o servidor, com service_role.
revoke all on function public.get_source_credential(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- v_user_credentials_safe — o que a UI pode ver
-- -----------------------------------------------------------------------------
create or replace view public.v_user_credentials_safe
with (security_invoker = true) as
select c.id, c.user_id, c.source_id, s.slug as source_slug, s.display_name as source_name,
       c.label, c.secret_last4, c.created_at, c.last_used_at
  from public.user_credentials c
  join public.job_sources s on s.id = c.source_id;

comment on view public.v_user_credentials_safe is
  'user_credentials sem secret_ciphertext. É a ÚNICA leitura de credencial permitida ao cliente.';

grant select on public.v_user_credentials_safe to authenticated;

-- -----------------------------------------------------------------------------
-- v_radar_feed — alimenta o Job Radar em uma consulta, já com duplicata resolvida
-- -----------------------------------------------------------------------------
create or replace view public.v_radar_feed
with (security_invoker = true) as
select
  m.id                        as match_id,
  m.user_id,
  m.search_profile_id,
  sp.name                     as search_profile_name,
  m.job_id,
  m.score,
  m.data_coverage,
  m.score_breakdown,
  m.status,
  m.matched_at,
  m.seen_at,
  j.title,
  j.normalized_title,
  j.apply_url,
  j.canonical_url,
  j.description_text,
  j.city, j.state, j.country,
  j.work_model, j.contract_type, j.seniority,
  j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.salary_is_estimated,
  j.published_at,
  j.published_at_source,
  j.published_at_confidence,
  j.first_seen_at,
  j.is_active,
  j.closed_at,
  coalesce(c.name, j.company_name_raw) as company_name,
  c.id                        as company_id,
  c.domain                    as company_domain,
  c.industry                  as company_industry,
  src.slug                    as source_slug,
  src.display_name            as source_name,
  src.kind                    as source_kind,
  -- Recrutador de maior relevância vinculado à vaga
  rec.id                      as recruiter_id,
  rec.full_name               as recruiter_name,
  rec.activity_status         as recruiter_activity_status,
  rec.last_activity_at        as recruiter_last_activity_at,
  rec.last_activity_confidence as recruiter_last_activity_confidence,
  -- Duplicatas: a vaga canônica e quantas irmãs existem
  dup.canonical_job_id,
  (select count(*) from public.job_duplicates d
    where d.canonical_job_id = coalesce(dup.canonical_job_id, j.id)) as duplicate_count
from public.job_matches m
join public.jobs j         on j.id = m.job_id
join public.job_sources src on src.id = j.source_id
left join public.companies c on c.id = j.company_id
left join public.job_duplicates dup on dup.job_id = j.id
left join lateral (
  select r.*
    from public.recruiter_jobs rj
    join public.recruiters r on r.id = rj.recruiter_id
   where rj.job_id = j.id
   order by case r.activity_status
              when 'active_recent'     then 0
              when 'possibly_active'   then 1
              else 2
            end,
            r.last_activity_at desc nulls last
   limit 1
) rec on true;

grant select on public.v_radar_feed to authenticated;

-- -----------------------------------------------------------------------------
-- v_kanban_cards — cartões com marcador de estagnação (RN-055)
-- -----------------------------------------------------------------------------
create or replace view public.v_kanban_cards
with (security_invoker = true) as
select
  a.id, a.user_id, a.stage, a.stage_order,
  a.job_title, a.company_name, a.job_url,
  a.salary_min, a.salary_max, a.currency,
  a.work_model, a.contract_type, a.location,
  a.applied_at, a.last_event_at, a.next_action, a.next_action_at,
  a.score_at_apply, a.is_archived, a.recruiter_id, a.job_id,
  r.full_name as recruiter_name,
  r.activity_status as recruiter_activity_status,
  -- Estagnado: sem evento há mais que o limite do usuário, em estágio não terminal
  (not public.is_terminal_stage(a.stage)
   and a.last_event_at < now() - make_interval(days => coalesce(us.stale_after_days, 7)))
    as is_stale,
  -- Ação atrasada aparece no topo do dashboard (RN-056)
  (a.next_action_at is not null and a.next_action_at < now()) as is_overdue,
  (select count(*) from public.application_events e where e.application_id = a.id) as event_count,
  (select count(*) from public.interviews i
    where i.application_id = a.id and i.outcome = 'pending') as pending_interviews
from public.applications a
left join public.recruiters r on r.id = a.recruiter_id
left join public.user_settings us on us.user_id = a.user_id;

grant select on public.v_kanban_cards to authenticated;

-- -----------------------------------------------------------------------------
-- v_dashboard_counters — números do dashboard em uma consulta
-- -----------------------------------------------------------------------------
create or replace view public.v_dashboard_counters
with (security_invoker = true) as
select
  p.id as user_id,
  -- Vagas novas nas últimas 24h, considerando a confiança da data (RN-002)
  (select count(*) from public.job_matches m
     join public.jobs j on j.id = m.job_id
    where m.user_id = p.id and m.status = 'new'
      and coalesce(j.published_at, j.first_seen_at) > now() - interval '24 hours')
    as new_jobs_24h,
  (select count(*) from public.job_matches m
    where m.user_id = p.id and m.status = 'new' and m.score >= 70
      and coalesce(m.data_coverage, 0) >= 0.5)
    as high_score_jobs,
  (select round(avg(m.score)) from public.job_matches m
    where m.user_id = p.id and m.score is not null
      and m.matched_at > now() - interval '30 days')
    as avg_score_30d,
  (select count(*) from public.applications a
    where a.user_id = p.id and not a.is_archived
      and not public.is_terminal_stage(a.stage))
    as active_applications,
  (select count(*) from public.applications a
    where a.user_id = p.id and not a.is_archived
      and a.next_action_at is not null and a.next_action_at < now())
    as overdue_actions,
  (select count(*) from public.recruiters r
    where r.user_id = p.id and r.activity_status = 'active_recent')
    as active_recruiters,
  (select count(*) from public.interviews i
    where i.user_id = p.id and i.outcome = 'pending' and i.scheduled_at > now())
    as upcoming_interviews,
  (select overall_score from public.linkedin_audits la
    where la.user_id = p.id and la.status = 'completed'
    order by la.completed_at desc limit 1)
    as latest_linkedin_score,
  (select count(*) from public.notifications n
    where n.user_id = p.id and n.read_at is null and n.status = 'sent')
    as unread_notifications
from public.profiles p;

grant select on public.v_dashboard_counters to authenticated;

-- -----------------------------------------------------------------------------
-- v_recruiter_overview
-- -----------------------------------------------------------------------------
create or replace view public.v_recruiter_overview
with (security_invoker = true) as
select
  r.id, r.user_id, r.full_name, r.headline, r.profile_url, r.is_agency,
  r.activity_status, r.last_activity_at, r.last_activity_confidence,
  r.status_computed_at, r.status_reason,
  coalesce(c.name, r.company_name_raw) as company_name,
  -- Classificação defasada: a UI mostra selo "a confirmar"
  (r.status_computed_at is null or r.status_computed_at < now() - interval '48 hours')
    as status_is_stale,
  (select count(*) from public.recruiter_jobs rj where rj.recruiter_id = r.id) as jobs_posted,
  (select count(*) from public.recruiter_activities ra where ra.recruiter_id = r.id) as activity_count,
  (select max(rc.occurred_at) from public.recruiter_contacts rc
    where rc.recruiter_id = r.id and rc.user_id = r.user_id) as last_contact_at,
  (select ra.activity_type from public.recruiter_activities ra
    where ra.recruiter_id = r.id
    order by coalesce(ra.occurred_at, ra.observed_at) desc limit 1) as last_activity_type
from public.recruiters r
left join public.companies c on c.id = r.company_id;

grant select on public.v_recruiter_overview to authenticated;

-- -----------------------------------------------------------------------------
-- Storage — quatro buckets, todos PRIVADOS
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',          'avatars',          false, 2097152,
     array['image/png', 'image/jpeg', 'image/webp']),
  ('documents',        'documents',        false, 10485760,
     array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('resumes',          'resumes',          false, 10485760,
     array['application/pdf']),
  ('linkedin-exports', 'linkedin-exports', false, 10485760,
     array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Política padrão: a primeira pasta do caminho tem que ser o uuid do usuário
do $$
declare
  b text;
  buckets text[] := array['avatars', 'documents', 'resumes', 'linkedin-exports'];
begin
  foreach b in array buckets loop
    execute format('drop policy if exists %I on storage.objects;', b || '_own_folder');
    execute format($f$
      create policy %1$I on storage.objects
        for all to authenticated
        using  (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text)
        with check (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b || '_own_folder', b);
  end loop;
end$$;

-- Nenhum bucket público. A entrega de arquivo é por URL assinada de 60 s,
-- gerada no servidor (documento 16 §9).
