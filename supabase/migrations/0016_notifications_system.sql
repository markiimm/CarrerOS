-- 0016 — Notificações, auditoria de atividade e rate limiting
-- CareerOS · documento 10 §15 · RF-NOT-*, RNF-SEC-07, RNF-PRIV-05

create table if not exists public.notification_digests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at       timestamptz,
  channel       public.notification_channel not null default 'in_app',
  items         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists notification_digests_pending_idx
  on public.notification_digests (user_id, scheduled_for) where sent_at is null;

select app_private.apply_owner_rls('notification_digests');

create table if not exists public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  type                  public.notification_type not null,
  severity              text not null default 'info' check (severity in ('info','warning','critical')),
  title                 text not null,
  body                  text,
  entity_type           text,
  entity_id             uuid,
  channel               public.notification_channel not null default 'in_app',
  digest_id             uuid references public.notification_digests(id) on delete set null,
  suppressed_by_stealth boolean not null default false,
  read_at               timestamptz,
  sent_at               timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on public.notifications (user_id, read_at nulls first, created_at desc);
create index if not exists notifications_entity_idx on public.notifications (user_id, entity_type, entity_id);

select app_private.apply_owner_rls('notifications');

comment on column public.notifications.suppressed_by_stealth is
  'Modo discreto ativo: a notificação é registrada mas não emitida de imediato; entra no resumo '
  'diário (RN-092, RF-NOT-03).';

-- ---------------------------------------------------------------------------
-- Logs de atividade: apenas hash de IP e user-agent; desligável (RNF-PRIV-05)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  action          text not null,
  entity_type     text,
  entity_id       uuid,
  request_id      text,
  ip_hash         char(64),
  user_agent_hash char(64),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs
  for select to authenticated using (user_id = auth.uid());
-- Escrita somente por service_role: o cliente não forja log.

-- ---------------------------------------------------------------------------
-- Rate limiting em Postgres (ADR-010, RNF-SEC-07)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  constraint rate_limits_uk unique (user_id, bucket, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

select app_private.apply_service_only_rls('rate_limits');

-- Incremento atômico com verificação. Retorna true quando a ação é permitida.
create or replace function app_private.check_rate_limit(
  p_user_id        uuid,
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning rate_limits.count into v_count;

  return v_count <= p_limit;
end $$;

revoke all on function app_private.check_rate_limit(uuid, text, integer, integer) from anon, authenticated;

comment on function app_private.check_rate_limit(uuid, text, integer, integer) is
  'Buckets em uso: manual_collect (RN-028), ai_call, upload, auth_attempt, linkedin_url_fetch.';
