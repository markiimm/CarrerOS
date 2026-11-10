-- 0013 — Currículos versionados
-- CareerOS · documento 10 §12 · RF-BIB-04, RF-AIA-02

create table if not exists public.resumes (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  career_profile_id  uuid references public.career_profiles(id) on delete set null,
  is_master          boolean not null default false,
  current_version_id uuid,  -- FK adicionada abaixo
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists resumes_one_master_uidx
  on public.resumes (user_id) where is_master;
create index if not exists resumes_user_idx on public.resumes (user_id, updated_at desc);

select app_private.apply_owner_rls('resumes');
select app_private.attach_updated_at('resumes');

create table if not exists public.resume_versions (
  id                   uuid primary key default gen_random_uuid(),
  resume_id            uuid not null references public.resumes(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  version_number       integer not null check (version_number > 0),
  content              jsonb not null,
  document_id          uuid references public.documents(id) on delete set null,
  generated_for_job_id uuid references public.jobs(id) on delete set null,
  ai_run_id            uuid references public.ai_runs(id) on delete set null,
  notes                text,
  created_at           timestamptz not null default now(),
  constraint resume_versions_uk unique (resume_id, version_number)
);

create index if not exists resume_versions_resume_idx on public.resume_versions (resume_id, version_number desc);

-- Versões são imutáveis: só SELECT e INSERT.
select app_private.apply_insert_only_rls('resume_versions');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'resumes_current_version_fk') then
    alter table public.resumes
      add constraint resumes_current_version_fk
      foreign key (current_version_id) references public.resume_versions(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'applications_resume_version_fk') then
    alter table public.applications
      add constraint applications_resume_version_fk
      foreign key (resume_version_id) references public.resume_versions(id) on delete set null;
  end if;
end $$;
