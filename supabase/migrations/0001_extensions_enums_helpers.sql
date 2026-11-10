-- =============================================================================
-- CareerOS — 0001 — Extensões, enums e funções auxiliares
-- Idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- Referência: docs/10-modelo-de-dados.md §3, §16
-- =============================================================================

create extension if not exists "pgcrypto"  with schema extensions;  -- gen_random_uuid, digest
create extension if not exists "pg_trgm"   with schema extensions;  -- similarity (dedupe fuzzy)
create extension if not exists "unaccent"  with schema extensions;  -- normalização de texto
create extension if not exists "citext"    with schema extensions;  -- e-mails case-insensitive

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  -- Proveniência e confiança -------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'confidence_level') then
    create type confidence_level as enum ('exact', 'approximate', 'unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'published_at_source') then
    create type published_at_source as enum
      ('api_field', 'page_metadata', 'source_relative', 'http_header', 'first_seen', 'user_input');
  end if;

  -- Vagas --------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'work_model') then
    create type work_model as enum ('onsite', 'hybrid', 'remote');
  end if;
  if not exists (select 1 from pg_type where typname = 'contract_type') then
    create type contract_type as enum ('clt', 'pj', 'internship', 'temporary', 'freelance', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'seniority_level') then
    create type seniority_level as enum
      ('intern', 'junior', 'mid', 'senior', 'specialist', 'lead', 'manager');
  end if;
  if not exists (select 1 from pg_type where typname = 'salary_period') then
    create type salary_period as enum ('hour', 'day', 'month', 'year');
  end if;

  -- Fontes -------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'source_kind') then
    create type source_kind as enum
      ('official_api', 'ats_public_api', 'rss', 'jsonld_page', 'manual', 'email_alert');
  end if;
  if not exists (select 1 from pg_type where typname = 'source_legal_status') then
    create type source_legal_status as enum
      ('allowed', 'review_needed', 'disallowed', 'requires_user_key');
  end if;
  if not exists (select 1 from pg_type where typname = 'source_status') then
    create type source_status as enum ('active', 'degraded', 'paused', 'retired');
  end if;

  -- Match e candidatura ------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'job_match_status') then
    create type job_match_status as enum
      ('new', 'seen', 'saved', 'dismissed', 'applied', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_stage') then
    create type application_stage as enum
      ('radar', 'interested', 'applied', 'screening', 'interview',
       'technical_test', 'offer', 'accepted', 'rejected', 'withdrawn');
  end if;

  -- Recrutadores -------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'recruiter_activity_status') then
    create type recruiter_activity_status as enum
      ('active_recent', 'possibly_active', 'no_activity_found');
  end if;
  if not exists (select 1 from pg_type where typname = 'recruiter_activity_type') then
    create type recruiter_activity_type as enum
      ('job_post', 'recruiting_post', 'hiring_comment', 'message_to_user',
       'profile_update', 'generic_post', 'event');
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_source') then
    create type activity_source as enum ('job_radar', 'user_manual', 'public_feed');
  end if;

  -- LinkedIn Analyzer --------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'audit_input_type') then
    create type audit_input_type as enum ('public_url', 'pasted_text', 'pdf_export', 'manual_form');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_status') then
    create type audit_status as enum ('draft', 'processing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'linkedin_section') then
    create type linkedin_section as enum
      ('photo', 'cover', 'headline', 'about', 'experience', 'education', 'certifications',
       'skills', 'projects', 'recommendations', 'github', 'portfolio', 'keywords', 'clarity');
  end if;
  if not exists (select 1 from pg_type where typname = 'severity_level') then
    create type severity_level as enum ('critical', 'high', 'medium', 'low');
  end if;
  if not exists (select 1 from pg_type where typname = 'recommendation_status') then
    create type recommendation_status as enum ('pending', 'accepted', 'applied', 'rejected');
  end if;

  -- Competências e biblioteca ------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'skill_level') then
    create type skill_level as enum ('basic', 'intermediate', 'advanced', 'expert');
  end if;
  if not exists (select 1 from pg_type where typname = 'skill_kind') then
    create type skill_kind as enum ('technical', 'tool', 'language', 'soft', 'certification');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type document_kind as enum
      ('resume', 'certificate', 'diploma', 'portfolio', 'cover_letter', 'reference', 'contract', 'other');
  end if;

  -- Operação -----------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type notification_channel as enum ('in_app', 'email');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type notification_status as enum ('pending', 'sent', 'read', 'failed', 'suppressed');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_run_status') then
    create type ai_run_status as enum
      ('success', 'validation_failed', 'blocked_by_cap', 'error', 'cached');
  end if;
  if not exists (select 1 from pg_type where typname = 'run_status') then
    create type run_status as enum ('running', 'success', 'partial', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'queue_status') then
    create type queue_status as enum ('pending', 'processing', 'done', 'failed', 'dead');
  end if;
  if not exists (select 1 from pg_type where typname = 'offer_status') then
    create type offer_status as enum
      ('draft', 'received', 'negotiating', 'accepted', 'declined', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'interview_kind') then
    create type interview_kind as enum
      ('screening', 'technical', 'behavioral', 'panel', 'final', 'mock');
  end if;
  if not exists (select 1 from pg_type where typname = 'goal_status') then
    create type goal_status as enum ('active', 'paused', 'done', 'dropped');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- canon(text) — normalização canônica usada em dedupe e casamento de nomes.
-- IMMUTABLE de propósito: é usada em colunas geradas e índices de expressão.
-- O truque do regdictionary é o que torna unaccent() imutável.
-- -----------------------------------------------------------------------------
create or replace function public.canon(input text)
returns text
language sql
immutable
parallel safe
returns null on null input
set search_path = ''
as $$
  select trim(regexp_replace(
           regexp_replace(
             lower(extensions.unaccent('extensions.unaccent'::regdictionary, input)),
             '[^a-z0-9]+', ' ', 'g'),
           '\s+', ' ', 'g'));
$$;

comment on function public.canon(text) is
  'Minúsculas, sem acento, sem pontuação, espaços colapsados. Base de normalized_title/name.';

-- -----------------------------------------------------------------------------
-- set_updated_at() — trigger genérica
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- application_stage_order() — ordem canônica do Kanban (RN-051)
-- IMMUTABLE para permitir coluna gerada em applications.stage_order
-- -----------------------------------------------------------------------------
create or replace function public.application_stage_order(s public.application_stage)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case s
    when 'radar'          then 0
    when 'interested'     then 1
    when 'applied'        then 2
    when 'screening'      then 3
    when 'interview'      then 4
    when 'technical_test' then 5
    when 'offer'          then 6
    when 'accepted'       then 7
    when 'rejected'       then 8
    when 'withdrawn'      then 9
  end;
$$;

-- -----------------------------------------------------------------------------
-- is_terminal_stage() — estados terminais (RN-052)
-- -----------------------------------------------------------------------------
create or replace function public.is_terminal_stage(s public.application_stage)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select s in ('accepted', 'rejected', 'withdrawn');
$$;
