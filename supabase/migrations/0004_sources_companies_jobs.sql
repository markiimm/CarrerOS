-- =============================================================================
-- CareerOS — 0004 — Fontes de vagas, empresas, vagas, dedupe e matches
-- Referência: docs/10-modelo-de-dados.md §7 | docs/06-job-radar.md | RN-020 a RN-029
-- =============================================================================

-- -----------------------------------------------------------------------------
-- job_sources — catálogo global de fontes (escrita só por service_role)
-- -----------------------------------------------------------------------------
create table if not exists public.job_sources (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  adapter_key          text not null,
  kind                 source_kind not null,
  -- DEFAULT SEGURO: fonte nova não coleta até ser avaliada (RN-020, ADR-007)
  legal_status         source_legal_status not null default 'review_needed',
  legal_notes          text,
  terms_url            text,
  robots_url           text,
  docs_url             text,
  status               source_status not null default 'active',
  rate_limit_per_min   integer not null default 20 check (rate_limit_per_min between 1 and 600),
  requires_user_key    boolean not null default false,
  config               jsonb not null default '{}'::jsonb,
  capabilities         jsonb not null default '{}'::jsonb,
  consecutive_failures integer not null default 0,
  last_success_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.job_sources.legal_status is
  'allowed | review_needed | disallowed | requires_user_key. O guard do coletor recusa tudo que não seja allowed (ou requires_user_key com chave).';

-- FK pendente de 0002
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_credentials_source_fk') then
    alter table public.user_credentials
      add constraint user_credentials_source_fk
      foreign key (source_id) references public.job_sources (id) on delete cascade;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- search_profile_sources — quais fontes cada perfil usa
-- -----------------------------------------------------------------------------
create table if not exists public.search_profile_sources (
  search_profile_id uuid not null references public.search_profiles (id) on delete cascade,
  source_id         uuid not null references public.job_sources (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  is_enabled        boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  primary key (search_profile_id, source_id)
);

create index if not exists search_profile_sources_user_idx
  on public.search_profile_sources (user_id) where is_enabled;

-- -----------------------------------------------------------------------------
-- companies — catálogo global
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text generated always as (public.canon(name)) stored,
  domain          text,
  website         text,
  linkedin_url    text,
  industry        text,
  size_range      text,
  country         char(2),
  state           text,
  city            text,
  description     text,
  logo_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists companies_domain_unique
  on public.companies (lower(domain)) where domain is not null;
create unique index if not exists companies_normalized_unique
  on public.companies (normalized_name, coalesce(country, 'ZZ'));
create index if not exists companies_normalized_trgm
  on public.companies using gin (normalized_name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- jobs — catálogo global de vagas (ADR-004). Sem dado pessoal.
-- -----------------------------------------------------------------------------
create table if not exists public.jobs (
  id                      uuid primary key default gen_random_uuid(),
  source_id               uuid not null references public.job_sources (id) on delete restrict,
  external_id             text not null,
  company_id              uuid references public.companies (id) on delete set null,
  company_name_raw        text,
  title                   text not null,
  normalized_title        text generated always as (public.canon(title)) stored,
  description_text        text,
  description_html        text,
  location_raw            text,
  city                    text,
  state                   text,
  country                 char(2),
  -- NULL = não informado. NUNCA presumir presencial.
  work_model              work_model,
  contract_type           contract_type,
  seniority               seniority_level,
  salary_min              numeric(14,2),
  salary_max              numeric(14,2),
  salary_currency         char(3),
  salary_period           salary_period,
  salary_raw              text,
  salary_is_estimated     boolean not null default false,
  apply_url               text not null,
  canonical_url           text,
  -- Data de publicação COM proveniência (RN-002)
  published_at            timestamptz,
  published_at_source     published_at_source not null,
  published_at_confidence confidence_level not null,
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  miss_count              integer not null default 0,
  is_active               boolean not null default true,
  closed_at               timestamptz,
  fingerprint             text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Identidade na fonte (RN-021 nível 1)
  constraint jobs_source_external_unique unique (source_id, external_id),
  constraint jobs_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min),
  -- Coerência de proveniência: confiança exact/approximate exige data
  constraint jobs_published_at_coherence check (
    (published_at_confidence = 'unknown') or (published_at is not null)),
  constraint jobs_closed_coherence check (
    (is_active and closed_at is null) or (not is_active))
);

create index if not exists jobs_published_idx       on public.jobs (published_at desc nulls last);
create index if not exists jobs_first_seen_idx      on public.jobs (first_seen_at desc);
create index if not exists jobs_company_idx         on public.jobs (company_id);
create index if not exists jobs_fingerprint_idx     on public.jobs (fingerprint);
create index if not exists jobs_active_published_idx on public.jobs (is_active, published_at desc nulls last);
create index if not exists jobs_title_trgm
  on public.jobs using gin (normalized_title extensions.gin_trgm_ops);
create index if not exists jobs_fulltext_idx
  on public.jobs using gin (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description_text, '')));
-- Suporta a varredura de encerramento por fonte (RN-023)
create index if not exists jobs_source_active_idx on public.jobs (source_id, is_active, last_seen_at);

-- -----------------------------------------------------------------------------
-- job_raw_payloads — payload original (retenção 90 dias)
-- -----------------------------------------------------------------------------
create table if not exists public.job_raw_payloads (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  source_id  uuid not null references public.job_sources (id) on delete cascade,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists job_raw_payloads_job_idx     on public.job_raw_payloads (job_id);
create index if not exists job_raw_payloads_fetched_idx on public.job_raw_payloads (fetched_at);

-- -----------------------------------------------------------------------------
-- job_duplicates — nada é apagado; registra-se a relação (RN-021, RN-022)
-- -----------------------------------------------------------------------------
create table if not exists public.job_duplicates (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs (id) on delete cascade,
  canonical_job_id uuid not null references public.jobs (id) on delete cascade,
  strategy         text not null check (strategy in ('source_identity', 'fingerprint', 'fuzzy')),
  similarity       numeric(4,3) not null check (similarity between 0 and 1),
  detected_at      timestamptz not null default now(),
  constraint job_duplicates_unique unique (job_id, canonical_job_id),
  constraint job_duplicates_not_self check (job_id <> canonical_job_id)
);

create index if not exists job_duplicates_canonical_idx on public.job_duplicates (canonical_job_id);

-- -----------------------------------------------------------------------------
-- job_matches — a relação pessoal usuário × vaga (coração do radar)
-- -----------------------------------------------------------------------------
create table if not exists public.job_matches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  search_profile_id uuid not null references public.search_profiles (id) on delete cascade,
  job_id            uuid not null references public.jobs (id) on delete cascade,
  -- NULL = nenhum componente disponível. NÃO é zero (RN-030).
  score             integer check (score between 0 and 100),
  score_version     integer not null default 1,
  data_coverage     numeric(4,3) check (data_coverage between 0 and 1),
  score_breakdown   jsonb not null default '{}'::jsonb,
  status            job_match_status not null default 'new',
  dismissed_reason  text,
  matched_at        timestamptz not null default now(),
  score_computed_at timestamptz,
  seen_at           timestamptz,
  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Um match por (usuário, perfil de busca, vaga) — RN-024
  constraint job_matches_unique unique (user_id, search_profile_id, job_id)
);

create index if not exists job_matches_feed_idx
  on public.job_matches (user_id, status, score desc nulls last);
create index if not exists job_matches_recent_idx on public.job_matches (user_id, matched_at desc);
create index if not exists job_matches_recalc_idx
  on public.job_matches (score_computed_at nulls first) where status not in ('dismissed', 'blocked');
create index if not exists job_matches_job_idx on public.job_matches (job_id);

-- -----------------------------------------------------------------------------
-- company_blocklist — precedência absoluta (RN-013, RN-093)
-- -----------------------------------------------------------------------------
create table if not exists public.company_blocklist (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  company_id           uuid references public.companies (id) on delete cascade,
  company_name_pattern text,
  reason               text,
  created_at           timestamptz not null default now(),
  constraint company_blocklist_target check (company_id is not null or company_name_pattern is not null)
);

create index if not exists company_blocklist_user_idx on public.company_blocklist (user_id);
create unique index if not exists company_blocklist_company_unique
  on public.company_blocklist (user_id, company_id) where company_id is not null;

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['job_sources', 'companies', 'jobs', 'job_matches'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- Proteção da data original: published_at e sua proveniência nunca são
-- reescritas por coleta posterior (documento 06 §6, nível 1).
-- -----------------------------------------------------------------------------
create or replace function public.protect_job_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Só é permitido PREENCHER o que era desconhecido; nunca sobrescrever data já estabelecida.
  if old.published_at_confidence <> 'unknown' then
    new.published_at            := old.published_at;
    new.published_at_source     := old.published_at_source;
    new.published_at_confidence := old.published_at_confidence;
  end if;
  new.first_seen_at := old.first_seen_at;   -- imutável
  return new;
end;
$$;

drop trigger if exists trg_jobs_protect_published_at on public.jobs;
create trigger trg_jobs_protect_published_at
  before update on public.jobs
  for each row execute function public.protect_job_published_at();
