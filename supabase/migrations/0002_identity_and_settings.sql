-- =============================================================================
-- CareerOS — 0002 — Identidade, configurações, limites e credenciais
-- Referência: docs/10-modelo-de-dados.md §4
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — espelho de auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  full_name               text,
  headline                text,
  city                    text,
  state                   text,
  country                 char(2) default 'BR',
  timezone                text not null default 'America/Sao_Paulo',
  locale                  text not null default 'pt-BR',
  avatar_path             text,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is 'Dados do usuário. 1:1 com auth.users, criado por trigger.';
comment on column public.profiles.avatar_path is 'Caminho no Storage (bucket privado), nunca URL pública.';

-- -----------------------------------------------------------------------------
-- user_settings — preferências que afetam regra (RN-100)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  theme               text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  discreet_mode       boolean not null default false,
  discreet_title      text not null default 'Painel',
  notify_in_app       boolean not null default true,
  notify_email        boolean not null default false,
  notify_min_score    integer not null default 70 check (notify_min_score between 0 and 100),
  digest_hour_local   integer not null default 8 check (digest_hour_local between 0 and 23),
  stale_after_days    integer not null default 7 check (stale_after_days between 1 and 60),
  score_weights       jsonb   not null default
    '{"recency":25,"recruiter":25,"fit":25,"quality":25}'::jsonb,
  data_retention_days integer not null default 180 check (data_retention_days between 30 and 3650),
  -- Emprego atual: linha de base do Offer Comparator (RN-084). Valor sensível:
  -- nunca enviado à IA (RN-072) e ocultado na UI em modo discreto (RN-092).
  current_employment  jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A soma dos pesos precisa ser 100 (RN-031)
  constraint score_weights_sum_100 check (
    coalesce((score_weights->>'recency')::int, 0) +
    coalesce((score_weights->>'recruiter')::int, 0) +
    coalesce((score_weights->>'fit')::int, 0) +
    coalesce((score_weights->>'quality')::int, 0) = 100
  )
);

-- -----------------------------------------------------------------------------
-- user_limits — tetos operacionais e consumo
-- -----------------------------------------------------------------------------
create table if not exists public.user_limits (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  ai_monthly_cost_cap_usd    numeric(8,2) not null default 10.00 check (ai_monthly_cost_cap_usd >= 0),
  ai_cost_used_usd           numeric(10,6) not null default 0 check (ai_cost_used_usd >= 0),
  ai_cycle_started_at        timestamptz not null default date_trunc('month', now()),
  max_active_search_profiles integer not null default 10 check (max_active_search_profiles between 1 and 50),
  manual_runs_per_hour       integer not null default 5 check (manual_runs_per_hour between 1 and 60),
  storage_quota_mb           integer not null default 500 check (storage_quota_mb > 0),
  storage_used_mb            numeric(10,2) not null default 0 check (storage_used_mb >= 0),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- user_credentials — chaves de API DO PRÓPRIO USUÁRIO (RN-091)
-- NUNCA senha de plataforma. Somente token/chave emitida pelo usuário.
-- -----------------------------------------------------------------------------
create table if not exists public.user_credentials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  source_id         uuid not null,  -- FK adicionada em 0003 (job_sources ainda não existe)
  label             text not null,
  secret_ciphertext bytea not null,
  secret_last4      text,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz,
  constraint user_credentials_unique unique (user_id, source_id, label)
);

comment on column public.user_credentials.secret_ciphertext is
  'AES-256-GCM cifrado na aplicação. Lido apenas por get_source_credential() (security definer).';

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'user_limits'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;

-- -----------------------------------------------------------------------------
-- handle_new_user() — o usuário nunca existe sem configuração
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_limits   (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- increment_ai_cost() — atualização atômica do consumo de IA (RN-070)
-- Retorna true se a chamada pode prosseguir; false se o teto foi atingido.
-- -----------------------------------------------------------------------------
create or replace function public.increment_ai_cost(p_user_id uuid, p_cost numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  numeric;
  v_used numeric;
  v_cycle timestamptz;
begin
  select ai_monthly_cost_cap_usd, ai_cost_used_usd, ai_cycle_started_at
    into v_cap, v_used, v_cycle
    from public.user_limits where user_id = p_user_id for update;

  if not found then
    return false;
  end if;

  -- Virada de ciclo mensal
  if v_cycle < date_trunc('month', now()) then
    v_used := 0;
    update public.user_limits
       set ai_cost_used_usd = 0, ai_cycle_started_at = date_trunc('month', now())
     where user_id = p_user_id;
  end if;

  if v_used + p_cost > v_cap then
    return false;                      -- bloqueia, não degrada em silêncio (RN-070)
  end if;

  update public.user_limits
     set ai_cost_used_usd = ai_cost_used_usd + p_cost
   where user_id = p_user_id;

  return true;
end;
$$;
