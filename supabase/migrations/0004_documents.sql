-- 0004 — Biblioteca de documentos
-- CareerOS · documento 10 §12
-- Criada antes do perfil porque certificações, auditorias e propostas apontam para cá.

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           public.document_kind not null,
  title          text not null,
  -- Convenção obrigatória: {user_id}/{kind}/{uuid}.{ext} — a política de Storage depende disso.
  storage_path   text not null unique,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes > 0),
  checksum       char(64),
  extracted_text text,
  tags           text[] not null default '{}',
  issued_at      date,
  expires_at     date,
  is_sensitive   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint documents_storage_path_prefix_chk
    check (storage_path like (user_id::text || '/%'))
);

create index if not exists documents_user_kind_idx  on public.documents (user_id, kind, created_at desc);
create index if not exists documents_tags_gin_idx   on public.documents using gin (tags);
create index if not exists documents_expires_idx    on public.documents (user_id, expires_at)
  where expires_at is not null;

select app_private.apply_owner_rls('documents');
select app_private.attach_updated_at('documents');

create table if not exists public.document_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null check (entity_type in
                ('application','linkedin_audit','job_offer','certification','milestone','interview')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  constraint document_links_unique unique (document_id, entity_type, entity_id)
);

create index if not exists document_links_entity_idx on public.document_links (user_id, entity_type, entity_id);

select app_private.apply_owner_rls('document_links');
