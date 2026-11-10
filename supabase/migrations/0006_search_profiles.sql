-- 0006 — Credenciais do usuário, fontes habilitadas e perfis de busca
-- CareerOS · documento 10 §5.2 e §5.3

-- ---------------------------------------------------------------------------
-- Credenciais: SOMENTE chaves de API do próprio usuário. Nunca senha (RN-091).
-- ---------------------------------------------------------------------------
create table if not exists public.integration_credentials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          text not null,
  label             text not null,
  secret_ciphertext bytea not null,
  secret_last4      char(4) not null,
  status            text not null default 'active' check (status in ('active','invalid','revoked')),
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint integration_credentials_provider_label_uk unique (user_id, provider, label)
);

select app_private.apply_owner_rls('integration_credentials');
select app_private.attach_updated_at('integration_credentials');

comment on table public.integration_credentials is
  'Apenas tokens/chaves de API emitidos pelo próprio usuário, cifrados em repouso. '
  'O sistema nunca solicita senha de plataforma externa (RN-091). '
  'Leitura pela aplicação usa a view integration_credentials_safe.';

create or replace view public.integration_credentials_safe
  with (security_invoker = true) as
  select id, user_id, provider, label, secret_last4, status, last_used_at, created_at
    from public.integration_credentials;

create table if not exists public.user_job_sources (
  user_id       uuid not null references auth.users(id) on delete cascade,
  source_id     uuid not null references public.job_sources(id) on delete cascade,
  is_enabled    boolean not null default true,
  config        jsonb not null default '{}'::jsonb,
  credential_id uuid references public.integration_credentials(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, source_id)
);

select app_private.apply_owner_rls('user_job_sources');
select app_private.attach_updated_at('user_job_sources');

-- ---------------------------------------------------------------------------
-- Perfis de busca: filtros independentes, múltiplos e simultâneos (RN-011, RN-012)
-- ---------------------------------------------------------------------------
create table if not exists public.search_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  career_profile_id uuid references public.career_profiles(id) on delete set null,
  keywords          text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  areas             text[] not null default '{}',
  titles            text[] not null default '{}',
  locations         jsonb  not null default '[]'::jsonb,
  work_models       public.work_model[]     not null default '{}',
  contract_types    public.contract_type[]  not null default '{}',
  seniorities       public.seniority_level[] not null default '{}',
  salary_min        numeric(12,2),
  currency          char(3) not null default 'BRL',
  recency_hours     smallint not null default 24 check (recency_hours in (24,72,168,360)),
  min_notify_score  smallint check (min_notify_score between 0 and 100),
  score_weights     jsonb not null default
                      '{"recency":25,"recruiter":25,"fit":25,"quality":25}'::jsonb,
  is_active         boolean not null default true,
  collect_frequency text not null default 'daily' check (collect_frequency in ('daily','manual')),
  last_run_at       timestamptz,
  last_result_count integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint search_profiles_name_uk unique (user_id, name)
);

create index if not exists search_profiles_active_idx
  on public.search_profiles (user_id, is_active) where is_active;

select app_private.apply_owner_rls('search_profiles');
select app_private.attach_updated_at('search_profiles');

comment on column public.search_profiles.career_profile_id is
  'Nulo ⇒ o componente de compatibilidade do Opportunity Score fica indisponível (RN-010).';
comment on column public.search_profiles.excluded_keywords is
  'Vence as palavras-chave incluídas (RN-016).';

create table if not exists public.search_profile_sources (
  search_profile_id uuid not null references public.search_profiles(id) on delete cascade,
  source_id         uuid not null references public.job_sources(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  is_enabled        boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  primary key (search_profile_id, source_id)
);

create index if not exists search_profile_sources_user_idx on public.search_profile_sources (user_id);

select app_private.apply_owner_rls('search_profile_sources');

-- ---------------------------------------------------------------------------
-- Regras de integridade declaradas como gatilho (RN-015, RN-031)
-- ---------------------------------------------------------------------------
create or replace function app_private.enforce_active_search_profile_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.is_active is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active is true then
    return new;
  end if;

  select coalesce(max_active_search_profiles, 10) into v_limit
    from public.user_limits where user_id = new.user_id;
  v_limit := coalesce(v_limit, 10);

  select count(*) into v_count
    from public.search_profiles
   where user_id = new.user_id and is_active and id <> new.id;

  if v_count >= v_limit then
    raise exception 'LIMITE_PERFIS_ATIVOS: o limite de perfis de busca ativos é %. Desative um perfil antes de ativar outro.', v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists enforce_active_search_profile_limit on public.search_profiles;
create trigger enforce_active_search_profile_limit
  before insert or update of is_active on public.search_profiles
  for each row execute function app_private.enforce_active_search_profile_limit();

create or replace function app_private.enforce_score_weights_sum()
returns trigger language plpgsql as $$
declare
  v_sum numeric;
begin
  select coalesce((new.score_weights->>'recency')::numeric, 0)
       + coalesce((new.score_weights->>'recruiter')::numeric, 0)
       + coalesce((new.score_weights->>'fit')::numeric, 0)
       + coalesce((new.score_weights->>'quality')::numeric, 0)
    into v_sum;

  if v_sum <> 100 then
    raise exception 'PESOS_SCORE_INVALIDOS: a soma dos pesos do score deve ser 100 (recebido: %).', v_sum
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists enforce_score_weights_sum on public.search_profiles;
create trigger enforce_score_weights_sum
  before insert or update of score_weights on public.search_profiles
  for each row execute function app_private.enforce_score_weights_sum();
