-- 0002 — Identidade e configuração do usuário
-- CareerOS · documento 10 §4.1 a §4.3

create table if not exists public.profiles (
  user_id                     uuid primary key references auth.users(id) on delete cascade,
  full_name                   text,
  headline                    text,
  city                        text,
  state                       text,
  country                     char(2) not null default 'BR',
  timezone                    text    not null default 'America/Sao_Paulo',
  locale                      text    not null default 'pt-BR',
  willing_to_relocate         boolean not null default false,
  willing_to_travel           boolean not null default false,
  salary_expectation_min      numeric(12,2),
  salary_expectation_max      numeric(12,2),
  salary_expectation_currency char(3) not null default 'BRL',
  salary_expectation_period   public.salary_period not null default 'month',
  accepted_work_models        public.work_model[]    not null default '{}',
  accepted_contract_types     public.contract_type[] not null default '{}',
  avatar_url                  text,
  onboarding_completed_at     timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint profiles_salary_range_chk
    check (salary_expectation_max is null
           or salary_expectation_min is null
           or salary_expectation_max >= salary_expectation_min)
);

-- profiles usa user_id como chave: o helper de RLS funciona sem alteração.
select app_private.apply_owner_rls('profiles');
select app_private.attach_updated_at('profiles');

create table if not exists public.user_settings (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  theme                        text     not null default 'dark'
                                        check (theme in ('dark','light','system')),
  density                      text     not null default 'comfortable'
                                        check (density in ('comfortable','compact')),
  stealth_mode                 boolean  not null default false,
  neutral_title                text     not null default 'Painel',
  email_neutral_subject        text     not null default 'Resumo diário',
  quiet_hours_start            time,
  quiet_hours_end              time,
  digest_time                  time     not null default '08:00',
  notification_channels        jsonb    not null default
    '{"new_jobs":["in_app"],"follow_up_due":["in_app","email"],"interview_soon":["in_app","email"],"certification_expiring":["in_app"],"source_degraded":["in_app"],"ai_cap_reached":["in_app"],"stale_application":["in_app"],"offer_deadline":["in_app","email"],"target_company_job":["in_app"]}'::jsonb,
  min_notify_score             smallint not null default 70 check (min_notify_score between 0 and 100),
  default_recency_hours        smallint not null default 24
                                        check (default_recency_hours in (24,72,168,360)),
  stale_after_days             smallint not null default 7  check (stale_after_days between 1 and 90),
  mask_sensitive_values        boolean  not null default false,
  pin_hash                     text,
  pin_timeout_minutes          smallint check (pin_timeout_minutes between 1 and 240),
  activity_logging_enabled     boolean  not null default true,
  recruiter_monitoring_enabled boolean  not null default true,
  data_retention_days          integer  not null default 180 check (data_retention_days between 30 and 3650),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

select app_private.apply_owner_rls('user_settings');
select app_private.attach_updated_at('user_settings');

comment on column public.user_settings.pin_hash is
  'Hash Argon2id/bcrypt. Campo sensível (RNF-SEC-11): nunca exportado nem enviado à IA.';

create table if not exists public.user_limits (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  plan                      text    not null default 'personal',
  max_active_search_profiles integer not null default 10 check (max_active_search_profiles between 1 and 100),
  max_sources_per_profile   integer not null default 10,
  manual_runs_per_hour      integer not null default 5,
  ai_monthly_cost_cap_usd   numeric(8,2) not null default 10 check (ai_monthly_cost_cap_usd >= 0),
  ai_cycle_started_on       date    not null default date_trunc('month', now())::date,
  storage_quota_mb          integer not null default 500,
  max_upload_mb             integer not null default 10,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

select app_private.apply_owner_rls('user_limits');
select app_private.attach_updated_at('user_limits');

comment on table public.user_limits is
  'O que vira plano quando o produto for SaaS (RNF-SCAL-06). Nenhum limite é constante no código.';
