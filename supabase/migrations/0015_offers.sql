-- 0015 — Offer Comparator
-- CareerOS · documento 10 §14 · RN-080 a RN-085

create table if not exists public.job_offers (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  application_id            uuid references public.applications(id) on delete set null,
  company_id                uuid references public.companies(id) on delete set null,
  company_name              text not null,
  role_title                text not null,
  contract_type             public.contract_type not null,
  base_salary               numeric(12,2) not null check (base_salary >= 0),
  salary_period             public.salary_period not null default 'month',
  currency                  char(3) not null default 'BRL',
  bonus_annual              numeric(12,2) check (bonus_annual >= 0),
  profit_sharing            numeric(12,2) check (profit_sharing >= 0),
  equity_annualized         numeric(12,2) check (equity_annualized >= 0),
  meal_allowance_monthly    numeric(10,2) check (meal_allowance_monthly >= 0),
  health_plan_value_monthly numeric(10,2) check (health_plan_value_monthly >= 0),
  other_allowances          jsonb not null default '[]'::jsonb,
  vacation_days             smallint check (vacation_days between 0 and 60),
  work_model                public.work_model,
  commute_cost_monthly      numeric(10,2) check (commute_cost_monthly >= 0),
  commute_minutes_daily     smallint check (commute_minutes_daily between 0 and 600),
  pj_effective_tax_rate     numeric(5,2) check (pj_effective_tax_rate between 0 and 100),
  response_deadline         date,
  status                    public.offer_status not null default 'received',
  computed                  jsonb,
  -- Premissas e versão da tabela de alíquotas são obrigatórias (RN-080).
  assumptions               jsonb not null,
  tax_table_version         text  not null,
  decision                  text check (decision in ('accepted','declined','pending')),
  decision_reason           text,
  decided_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Proposta PJ exige alíquota efetiva informada pelo usuário: o sistema não a estima.
  constraint job_offers_pj_rate_chk
    check (contract_type <> 'pj' or pj_effective_tax_rate is not null)
);

create index if not exists job_offers_user_idx     on public.job_offers (user_id, created_at desc);
create index if not exists job_offers_deadline_idx on public.job_offers (user_id, response_deadline)
  where response_deadline is not null;

select app_private.apply_owner_rls('job_offers');
select app_private.attach_updated_at('job_offers');

comment on column public.job_offers.computed is
  'Resultado do cálculo (remuneração total, líquido estimado, diferencial contra o emprego atual). '
  'Recalculável; guardado para histórico e para exibir o que o usuário viu quando decidiu.';
comment on column public.job_offers.assumptions is
  'Alíquotas, 13º, 1/3 de férias, base PJ, encargos e período — declarados e versionados (RN-080). '
  'Não é aconselhamento fiscal (RF-OFR-07).';

-- Pesos dos critérios não financeiros: são do usuário (RN-085).
create table if not exists public.offer_criteria_weights (
  user_id   uuid not null references auth.users(id) on delete cascade,
  criterion text not null check (criterion in
              ('learning','stability','flexibility','management','career','risk','culture','commute')),
  weight    smallint not null default 5 check (weight between 0 and 10),
  primary key (user_id, criterion)
);

select app_private.apply_owner_rls('offer_criteria_weights');

create table if not exists public.offer_criteria_scores (
  offer_id   uuid not null references public.job_offers(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  criterion  text not null,
  score_0_10 smallint not null check (score_0_10 between 0 and 10),
  notes      text,
  primary key (offer_id, criterion)
);

create index if not exists offer_criteria_scores_user_idx on public.offer_criteria_scores (user_id);

select app_private.apply_owner_rls('offer_criteria_scores');
