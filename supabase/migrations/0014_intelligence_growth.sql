-- 0014 — Career Intelligence e Career Growth
-- CareerOS · documento 10 §13 · RN-004, RF-GRW-07

-- Agregado anônimo derivado de vagas públicas: sem user_id (catálogo).
create table if not exists public.market_insights (
  id              uuid primary key default gen_random_uuid(),
  scope           jsonb not null,
  scope_hash      char(64) not null,
  metric          text not null check (metric in
                    ('salary_stats','skill_frequency','work_model_share','contract_share','top_companies')),
  value           jsonb not null,
  sample_size     integer not null,
  period_start    date not null,
  period_end      date not null,
  insight_version text not null default '1.0.0',
  computed_at     timestamptz not null default now(),
  constraint market_insights_uk unique (scope_hash, metric, period_start, period_end),
  -- RN-004 materializado no banco: estatística com amostra insuficiente não é gravada.
  constraint market_insights_min_sample_chk check (sample_size >= 8),
  constraint market_insights_period_chk check (period_end >= period_start)
);

create index if not exists market_insights_lookup_idx
  on public.market_insights (metric, period_end desc);

select app_private.apply_catalog_rls('market_insights');

comment on table public.market_insights is
  'Base: apenas as vagas coletadas pelo CareerOS — amostra de conveniência, não o mercado inteiro. '
  'A interface declara isso junto de n e período (RF-INT-06).';

create table if not exists public.career_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  metric        text,
  target_value  numeric(14,2),
  current_value numeric(14,2),
  unit          text,
  due_date      date,
  status        public.item_status not null default 'planned',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists career_goals_user_idx on public.career_goals (user_id, due_date);

select app_private.apply_owner_rls('career_goals');
select app_private.attach_updated_at('career_goals');

create table if not exists public.learning_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  target_role       text,
  career_profile_id uuid references public.career_profiles(id) on delete set null,
  status            public.item_status not null default 'planned',
  start_date        date,
  due_date          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint learning_plans_period_chk check (due_date is null or start_date is null or due_date >= start_date)
);

create index if not exists learning_plans_user_idx on public.learning_plans (user_id, status);

select app_private.apply_owner_rls('learning_plans');
select app_private.attach_updated_at('learning_plans');

create table if not exists public.learning_items (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.learning_plans(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  skill_id         uuid references public.skills(id) on delete set null,
  type             public.learning_item_type not null,
  title            text not null,
  provider         text,
  url              text,
  cost             numeric(10,2) check (cost >= 0),
  currency         char(3) default 'BRL',
  estimated_hours  numeric(5,1) check (estimated_hours >= 0),
  completed_hours  numeric(5,1) not null default 0 check (completed_hours >= 0),
  due_date         date,
  status           public.item_status not null default 'planned',
  -- O sistema não inventa curso, provedor, preço nem URL (RF-GRW-07).
  is_user_provided boolean not null default true,
  completed_at     timestamptz,
  display_order    smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint learning_items_concrete_source_chk
    check (is_user_provided or (provider is null and url is null and cost is null)),
  constraint learning_items_done_chk
    check (status <> 'done' or completed_at is not null)
);

create index if not exists learning_items_plan_idx on public.learning_items (plan_id, display_order);
create index if not exists learning_items_user_due_idx on public.learning_items (user_id, due_date)
  where status in ('planned','in_progress');

select app_private.apply_owner_rls('learning_items');
select app_private.attach_updated_at('learning_items');

comment on constraint learning_items_concrete_source_chk on public.learning_items is
  'Sugestão gerada pelo sistema entra como TEMA de estudo, sem provedor, URL ou preço. '
  'Curso concreto só existe se o usuário cadastrar (RF-GRW-07).';

create table if not exists public.career_milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in
                ('promotion','certification','project','award','course','role_change','other')),
  title       text not null,
  description text,
  occurred_at date not null,
  document_id uuid references public.documents(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists career_milestones_user_idx on public.career_milestones (user_id, occurred_at desc);

select app_private.apply_owner_rls('career_milestones');
