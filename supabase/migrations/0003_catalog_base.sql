-- 0003 — Catálogo global: empresas, competências e fontes de vagas
-- CareerOS · documento 10 §4.4 (skills), §5.1 (job_sources), §6.1 (companies)
-- Estas tabelas NÃO têm user_id: são dado público compartilhado (ADR-004).
-- Escrita exclusiva por service_role.

create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null,
  domain          text,
  website_url     text,
  careers_url     text,
  industry        text,
  size_range      text check (size_range in ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5000+')),
  city            text,
  state           text,
  country         char(2),
  linkedin_url    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists companies_identity_uidx
  on public.companies (normalized_name, coalesce(domain, ''));
create index if not exists companies_normalized_name_trgm_idx
  on public.companies using gin (normalized_name extensions.gin_trgm_ops);

select app_private.apply_catalog_rls('companies');
select app_private.attach_updated_at('companies');

-- ---------------------------------------------------------------------------
-- Competências: catálogo com aliases, base da extração determinística
-- (documento 06 §7 — sem IA, RNF-COST-03)
-- ---------------------------------------------------------------------------
create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  category   text not null check (category in
               ('language','framework','database','cloud','infra','network','security',
                'data','tool','methodology','soft','os','erp','other')),
  aliases    text[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists skills_aliases_gin_idx on public.skills using gin (aliases);
create index if not exists skills_name_trgm_idx
  on public.skills using gin (name extensions.gin_trgm_ops);

select app_private.apply_catalog_rls('skills');

-- ---------------------------------------------------------------------------
-- Fontes de vagas: o guard de legalidade lê legal_status daqui (RN-020)
-- ---------------------------------------------------------------------------
create table if not exists public.job_sources (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  adapter_key          text not null,
  kind                 public.source_kind not null,
  legal_status         public.source_legal_status not null default 'review_needed',
  terms_url            text,
  legal_notes          text,
  robots_checked_at    timestamptz,
  rate_limit_per_min   smallint not null default 10 check (rate_limit_per_min between 1 and 600),
  requires_user_key    boolean not null default false,
  status               public.source_status not null default 'active',
  consecutive_failures smallint not null default 0,
  capabilities         jsonb not null default '{}'::jsonb,
  config               jsonb not null default '{}'::jsonb,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Uma fonte não pode ser declarada permitida sem o link dos termos que embasam a declaração.
  constraint job_sources_allowed_requires_terms_chk
    check (legal_status <> 'allowed' or terms_url is not null)
);

create index if not exists job_sources_status_idx on public.job_sources (status, legal_status);

select app_private.apply_catalog_rls('job_sources');
select app_private.attach_updated_at('job_sources');

comment on column public.job_sources.adapter_key is
  'Igual a JobSourceAdapter.key (documento 06 §2). Chave não registrada no registry faz o núcleo recusar a execução.';
comment on column public.job_sources.legal_notes is
  'Motivo legível exibido ao usuário quando a fonte está bloqueada (RF-CFG-07).';
