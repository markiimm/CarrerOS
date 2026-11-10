-- 0012 — LinkedIn Analyzer
-- CareerOS · documentos 09 e 10 §10 · RN-060 a RN-067

create table if not exists public.linkedin_profile_versions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  input_method public.linkedin_input_method not null,
  captured_at  timestamptz not null default now(),
  source_url   text,
  document_id  uuid references public.documents(id) on delete set null,
  raw_text     text,
  snapshot     jsonb not null,
  coverage     jsonb not null,
  -- Revisão humana do snapshot é obrigatória antes de qualquer chamada de IA (documento 09 §6).
  reviewed_at  timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists linkedin_profile_versions_user_idx
  on public.linkedin_profile_versions (user_id, captured_at desc);

select app_private.apply_owner_rls('linkedin_profile_versions');

create table if not exists public.linkedin_audits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_version_id uuid not null references public.linkedin_profile_versions(id) on delete cascade,
  previous_audit_id  uuid references public.linkedin_audits(id) on delete set null,
  search_profile_id  uuid references public.search_profiles(id) on delete set null,
  status             public.audit_status not null default 'queued',
  overall_score      smallint check (overall_score between 0 and 100),
  evaluated_weight   smallint check (evaluated_weight between 0 and 100),
  profile_coverage   numeric(3,2) check (profile_coverage between 0 and 1),
  weights            jsonb not null,
  score_version      text not null,
  -- Versão do prompt usada, guardada na própria auditoria: é o que permite declarar
  -- "a régua mudou" ao comparar auditorias antigas (RN-066, documento 20 §9).
  prompt_version     text,
  ai_run_id          uuid references public.ai_runs(id) on delete set null,
  started_at         timestamptz,
  finished_at        timestamptz,
  error_code         text,
  error_message      text,
  created_at         timestamptz not null default now(),
  -- Auditoria concluída tem score; auditoria falha tem motivo.
  constraint linkedin_audits_completed_chk
    check (status <> 'completed' or (overall_score is not null and evaluated_weight is not null)),
  constraint linkedin_audits_failed_chk
    check (status <> 'failed' or error_code is not null)
);

create index if not exists linkedin_audits_user_idx on public.linkedin_audits (user_id, created_at desc);

select app_private.apply_owner_rls('linkedin_audits');

comment on column public.linkedin_audits.previous_audit_id is
  'Nova análise cria nova auditoria; auditoria concluída é imutável (RN-066).';

-- ---------------------------------------------------------------------------
-- Seções: imutáveis após gravação (nenhuma política de UPDATE/DELETE pelo dono)
-- ---------------------------------------------------------------------------
create table if not exists public.linkedin_audit_sections (
  id                  uuid primary key default gen_random_uuid(),
  audit_id            uuid not null references public.linkedin_audits(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  section_key         text not null check (section_key in
                        ('photo','cover','headline','about','experiences','education',
                         'certifications','skills','projects','github_portfolio','keywords','clarity')),
  status              public.section_status not null,
  weight              smallint not null check (weight between 0 and 100),
  score_0_10          smallint check (score_0_10 between 0 and 10),
  weighted_points     numeric(5,2),
  deterministic_score smallint check (deterministic_score between 0 and 10),
  ai_score            smallint check (ai_score between 0 and 10),
  rationale           text,
  original_text       text,
  optimized_text      text,
  created_at          timestamptz not null default now(),
  constraint linkedin_audit_sections_uk unique (audit_id, section_key),
  -- Seção não avaliável NÃO recebe nota (RN-060).
  constraint linkedin_audit_sections_not_evaluable_chk
    check (status <> 'not_evaluable' or (score_0_10 is null and weighted_points is null)),
  constraint linkedin_audit_sections_evaluated_chk
    check (status <> 'evaluated' or score_0_10 is not null)
);

create index if not exists linkedin_audit_sections_audit_idx on public.linkedin_audit_sections (audit_id);

select app_private.apply_insert_only_rls('linkedin_audit_sections');

-- ---------------------------------------------------------------------------
-- Achados: as cinco partes são obrigatórias no schema (RN-063)
-- ---------------------------------------------------------------------------
create table if not exists public.linkedin_audit_findings (
  id                uuid primary key default gen_random_uuid(),
  audit_id          uuid not null references public.linkedin_audits(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  section_key       text not null,
  issue             text not null,   -- 1. o que está errado ou incompleto
  impact            text not null,   -- 2. por que prejudica
  how_to_fix        text not null,   -- 3. como corrigir
  example_text      text not null,   -- 4. exemplo de texto melhorado
  severity          public.finding_severity not null,
  priority          smallint not null,  -- 5. prioridade calculada (RN-064)
  has_placeholder   boolean not null default false,
  used_facts        jsonb not null default '[]'::jsonb,
  status            public.finding_status not null default 'pending',
  status_changed_at timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists linkedin_audit_findings_priority_idx
  on public.linkedin_audit_findings (audit_id, priority desc);
create index if not exists linkedin_audit_findings_status_idx
  on public.linkedin_audit_findings (user_id, status) where status = 'pending';

alter table public.linkedin_audit_findings enable row level security;

drop policy if exists linkedin_audit_findings_select_own on public.linkedin_audit_findings;
create policy linkedin_audit_findings_select_own on public.linkedin_audit_findings
  for select to authenticated using (user_id = auth.uid());

drop policy if exists linkedin_audit_findings_insert_own on public.linkedin_audit_findings;
create policy linkedin_audit_findings_insert_own on public.linkedin_audit_findings
  for insert to authenticated with check (user_id = auth.uid());

-- Único campo mutável é o rastreamento de aplicação da recomendação (RF-LKD-09).
drop policy if exists linkedin_audit_findings_update_status on public.linkedin_audit_findings;
create policy linkedin_audit_findings_update_status on public.linkedin_audit_findings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function app_private.protect_finding_immutable_fields()
returns trigger language plpgsql as $$
begin
  if new.issue is distinct from old.issue
     or new.impact is distinct from old.impact
     or new.how_to_fix is distinct from old.how_to_fix
     or new.example_text is distinct from old.example_text
     or new.severity is distinct from old.severity
     or new.priority is distinct from old.priority
     or new.section_key is distinct from old.section_key
     or new.audit_id is distinct from old.audit_id then
    raise exception 'ACHADO_IMUTAVEL: apenas o status da recomendação pode ser alterado (RN-066).'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists protect_finding_immutable_fields on public.linkedin_audit_findings;
create trigger protect_finding_immutable_fields
  before update on public.linkedin_audit_findings
  for each row execute function app_private.protect_finding_immutable_fields();
