-- 0007 — Catálogo de vagas e vínculo pessoal (job_matches)
-- CareerOS · documento 10 §6
-- jobs/companies/job_skills/job_duplicates são catálogo compartilhado (ADR-004):
-- leitura por autenticado, escrita só por service_role.
-- job_matches é dado pessoal: RLS por auth.uid().

create table if not exists public.jobs (
  id                      uuid primary key default gen_random_uuid(),
  source_id               uuid not null references public.job_sources(id) on delete restrict,
  external_id             text not null,
  company_id              uuid not null references public.companies(id) on delete restrict,
  title                   text not null,
  normalized_title        text not null,
  description_text        text,
  description_html        text,
  apply_url               text not null,
  canonical_url           text,
  location_raw            text,
  city                    text,
  state                   text,
  country                 char(2),
  work_model              public.work_model,
  contract_type           public.contract_type,
  seniority               public.seniority_level,
  salary_min              numeric(12,2),
  salary_max              numeric(12,2),
  salary_currency         char(3),
  salary_period           public.salary_period,
  salary_is_estimated     boolean not null default false,
  salary_raw              text,
  published_at            timestamptz,
  published_at_source     public.published_at_source,
  published_at_confidence public.confidence_level not null default 'unknown',
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  missed_count            smallint not null default 0,
  is_active               boolean not null default true,
  closed_at               timestamptz,
  fingerprint             char(64) not null,
  recruiter_id            uuid,  -- FK adicionada em 0008 (dependência circular)
  search_vector           tsvector generated always as (
                            to_tsvector('portuguese',
                              coalesce(title, '') || ' ' || coalesce(description_text, ''))
                          ) stored,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint jobs_source_identity_uk unique (source_id, external_id),
  constraint jobs_salary_range_chk
    check (salary_max is null or salary_min is null or salary_max >= salary_min),
  -- Data com confiança declarada exige a data e a origem (RN-002).
  constraint jobs_published_at_provenance_chk
    check ((published_at_confidence = 'unknown')
           or (published_at is not null and published_at_source is not null))
);

create index if not exists jobs_fingerprint_idx        on public.jobs (fingerprint, first_seen_at desc);
create index if not exists jobs_dedupe_fuzzy_idx       on public.jobs (company_id, city, first_seen_at desc);
create index if not exists jobs_published_active_idx   on public.jobs (published_at desc) where is_active;
create index if not exists jobs_first_seen_idx         on public.jobs (first_seen_at desc);
create index if not exists jobs_source_last_seen_idx   on public.jobs (source_id, last_seen_at);
create index if not exists jobs_normalized_title_trgm_idx
  on public.jobs using gin (normalized_title extensions.gin_trgm_ops);
create index if not exists jobs_search_vector_idx      on public.jobs using gin (search_vector);

select app_private.apply_catalog_rls('jobs');
select app_private.attach_updated_at('jobs');

comment on column public.jobs.published_at_confidence is
  'unknown ⇒ a interface exibe "detectada em", nunca "publicada em" (RN-002), e o componente '
  'de recência do score fica indisponível (RN-003).';
comment on column public.jobs.work_model is
  'Nulo significa "não informado". Nunca presumir presencial (documento 06 §7).';

-- A data original nunca é reescrita por coleta posterior (documento 06 §6).
create or replace function app_private.protect_job_immutable_fields()
returns trigger language plpgsql as $$
begin
  new.first_seen_at := old.first_seen_at;

  if old.published_at is not null and old.published_at_confidence <> 'unknown' then
    new.published_at            := old.published_at;
    new.published_at_source     := old.published_at_source;
    new.published_at_confidence := old.published_at_confidence;
  end if;
  return new;
end $$;

drop trigger if exists protect_job_immutable_fields on public.jobs;
create trigger protect_job_immutable_fields
  before update on public.jobs
  for each row execute function app_private.protect_job_immutable_fields();

-- ---------------------------------------------------------------------------
-- Payload bruto: depuração. NÃO é legível pelo cliente (nenhuma política de SELECT).
-- Retenção de 90 dias (documento 10 §19).
-- ---------------------------------------------------------------------------
create table if not exists public.job_raw_payloads (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  source_id  uuid not null references public.job_sources(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  payload    jsonb not null,
  http_meta  jsonb not null default '{}'::jsonb
);

create index if not exists job_raw_payloads_job_idx     on public.job_raw_payloads (job_id, fetched_at desc);
create index if not exists job_raw_payloads_fetched_idx on public.job_raw_payloads (fetched_at);

select app_private.apply_service_only_rls('job_raw_payloads');

-- ---------------------------------------------------------------------------
-- Duplicatas: nada é apagado; a interface exibe a canônica (RN-021, RN-022)
-- ---------------------------------------------------------------------------
create table if not exists public.job_duplicates (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs(id) on delete cascade,
  canonical_job_id uuid not null references public.jobs(id) on delete cascade,
  strategy         public.duplicate_strategy not null,
  similarity       numeric(4,3) check (similarity between 0 and 1),
  detected_at      timestamptz not null default now(),
  constraint job_duplicates_pair_uk unique (job_id, canonical_job_id),
  constraint job_duplicates_not_self_chk check (job_id <> canonical_job_id)
);

create index if not exists job_duplicates_canonical_idx on public.job_duplicates (canonical_job_id);

select app_private.apply_catalog_rls('job_duplicates');

create table if not exists public.job_skills (
  job_id      uuid not null references public.jobs(id) on delete cascade,
  skill_id    uuid not null references public.skills(id) on delete cascade,
  occurrences smallint not null default 1 check (occurrences > 0),
  extraction  text not null default 'dictionary' check (extraction in ('dictionary','manual')),
  primary key (job_id, skill_id)
);

create index if not exists job_skills_skill_idx on public.job_skills (skill_id);

select app_private.apply_catalog_rls('job_skills');

-- ---------------------------------------------------------------------------
-- job_matches — o vínculo pessoal com o catálogo (dado do usuário)
-- ---------------------------------------------------------------------------
create table if not exists public.job_matches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  job_id            uuid not null references public.jobs(id) on delete cascade,
  score             smallint check (score between 0 and 100),
  data_coverage     numeric(3,2) check (data_coverage between 0 and 1),
  low_confidence    boolean generated always as (data_coverage is not null and data_coverage < 0.5) stored,
  score_version     text,
  score_breakdown   jsonb,
  scored_at         timestamptz,
  matched_at        timestamptz not null default now(),
  status            public.job_match_status not null default 'new',
  dismissed_reason  text,
  dismissed_at      timestamptz,
  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint job_matches_unique_uk unique (user_id, search_profile_id, job_id),
  constraint job_matches_dismissed_chk
    check (status <> 'dismissed' or dismissed_at is not null)
);

create index if not exists job_matches_listing_idx
  on public.job_matches (user_id, search_profile_id, score desc nulls last, id desc);
create index if not exists job_matches_status_idx
  on public.job_matches (user_id, status, matched_at desc);
create index if not exists job_matches_new_idx
  on public.job_matches (user_id, matched_at desc) where status = 'new';
create index if not exists job_matches_job_idx on public.job_matches (job_id);

select app_private.apply_owner_rls('job_matches');
select app_private.attach_updated_at('job_matches');

comment on column public.job_matches.score is
  'Nulo quando nenhum componente estava disponível. NUNCA 0 nesse caso (documento 08 §2).';
comment on column public.job_matches.score_breakdown is
  'Fonte única da explicação exibida: nada aparece na tela que não esteja aqui (RN-034).';
