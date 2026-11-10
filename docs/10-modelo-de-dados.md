# 10 — Modelo de dados (PostgreSQL / Supabase)

> O SQL executável está em [`supabase/migrations/`](../supabase/migrations/). Este documento é a
> referência de leitura: o que cada tabela significa, por que existe e como está protegida.
> **Em caso de divergência entre este documento e as migrations, as migrations são a verdade** —
> e a divergência é bug, a ser corrigida aqui.

## 1. Convenções obrigatórias

| Convenção | Regra |
|---|---|
| Nomes | `snake_case`, tabelas no plural, inglês (RNF-MNT-08) |
| Chave primária | `id uuid primary key default gen_random_uuid()`, exceto tabelas 1:1 com usuário, cuja PK é `user_id` |
| Dono do dado | toda tabela de dado pessoal tem `user_id uuid not null references auth.users(id) on delete cascade` |
| Tempo | `timestamptz` sempre, UTC (RNF-I18N-03); `created_at timestamptz not null default now()`; `updated_at` mantido por trigger |
| Dinheiro | `numeric(12,2)` + `currency char(3)` + (salário) `salary_period` (RN-008). Nunca `float` |
| Enumerações | `CREATE TYPE ... AS ENUM` quando o conjunto é estável e compartilhado; `text` + `CHECK` quando tende a crescer por configuração |
| `jsonb` | só para payload bruto, decomposições, snapshots e configuração de adaptador — nunca para campo usado em filtro de lista (documento 04 §2.4) |
| Proveniência | campo incerto tem par `*_source` e/ou `*_confidence` (RN-001, ADR-011) |
| Exclusão | `on delete cascade` a partir de `auth.users`; `on delete restrict` onde apagar silenciosamente perderia histórico (ver §7) |
| RLS | `ENABLE ROW LEVEL SECURITY` em **todas** as tabelas, sem exceção; política por `auth.uid()` (§8) |
| Índice | toda tabela pessoal tem índice com `user_id` como primeira coluna (RNF-SCAL-01) |

## 2. Diagrama de relacionamentos (texto)

```
auth.users 1─1 profiles ─1─ user_settings
           │              └1─ user_limits
           ├─* career_profiles ─* career_profile_skills ─* skills
           │        ├─* career_profile_experiences ─* experiences
           │        └─1 (opcional) ← search_profiles.career_profile_id
           ├─* experiences · educations · certifications · profile_links · user_skills
           ├─1 current_employment
           ├─* search_profiles ─* search_profile_sources ─* job_sources
           ├─* user_job_sources ─* job_sources
           ├─* integration_credentials
           ├─* job_matches ─* jobs                        (vínculo pessoal com o catálogo)
           ├─* applications ─* application_events
           │        └─* interviews
           ├─* recruiters(user_id) ─* recruiter_activities
           │        └─* recruiter_contacts
           ├─* company_blocklist · company_watchlist      ─* companies
           ├─* linkedin_profile_versions ─* linkedin_audits ─* linkedin_audit_sections
           │                                              └─* linkedin_audit_findings
           ├─* resumes ─* resume_versions
           ├─* documents ─* document_links
           ├─* assistant_threads ─* assistant_messages
           ├─* ai_runs
           ├─* career_goals · learning_plans ─* learning_items · career_milestones
           ├─* job_offers ─* offer_criteria_scores ·  offer_criteria_weights
           ├─* notifications ─1 notification_digests
           ├─* collector_queue · collector_runs
           └─* audit_logs · rate_limits

CATÁLOGO COMPARTILHADO (sem user_id — ADR-004)
   job_sources · companies · jobs ─* job_skills ─* skills
                                  ├─* job_raw_payloads
                                  └─* job_duplicates
   skills · market_insights
```

## 3. Tipos enumerados

| Tipo | Valores |
|---|---|
| `confidence_level` | `exact`, `approximate`, `unknown` |
| `published_at_source` | `api_field`, `page_metadata`, `http_header`, `source_relative`, `first_seen` |
| `work_model` | `onsite`, `hybrid`, `remote` |
| `contract_type` | `clt`, `pj`, `internship`, `temporary`, `freelance`, `other` |
| `seniority_level` | `intern`, `junior`, `mid`, `senior`, `specialist`, `lead`, `manager` |
| `salary_period` | `hour`, `month`, `year` |
| `source_kind` | `official_api`, `ats_public_api`, `rss`, `jsonld_page`, `manual`, `email_alert` |
| `source_legal_status` | `allowed`, `review_needed`, `disallowed`, `requires_user_key` |
| `source_status` | `active`, `paused`, `degraded`, `disabled` |
| `queue_status` | `pending`, `processing`, `done`, `failed`, `dead` |
| `run_status` | `running`, `success`, `partial`, `failed` |
| `run_trigger` | `cron`, `manual`, `backfill` |
| `job_match_status` | `new`, `seen`, `saved`, `dismissed`, `sent_to_kanban`, `blocked` |
| `duplicate_strategy` | `source_identity`, `fingerprint`, `fuzzy`, `manual` |
| `application_stage` | `radar`, `interested`, `applied`, `screening`, `interview`, `technical_test`, `offer`, `accepted`, `rejected`, `withdrawn` |
| `application_event_type` | `stage_change`, `note`, `contact`, `interview_scheduled`, `interview_done`, `document_attached`, `next_action_set`, `archived`, `restored` |
| `interview_kind` | `screening`, `technical`, `panel`, `cultural`, `final`, `other` |
| `recruiter_activity_status` | `active_recent`, `possibly_active`, `no_activity_found` |
| `recruiter_activity_type` | `job_post`, `recruiting_post`, `hiring_comment`, `direct_contact`, `event`, `generic_post`, `profile_update`, `user_observation` |
| `contact_channel` | `linkedin`, `email`, `phone`, `whatsapp`, `event`, `referral`, `other` |
| `contact_direction` | `inbound`, `outbound` |
| `linkedin_input_method` | `public_url`, `pasted_text`, `pdf_export`, `manual_form` |
| `audit_status` | `queued`, `running`, `completed`, `failed` |
| `section_status` | `evaluated`, `not_evaluable` |
| `finding_severity` | `critical`, `high`, `medium`, `low` |
| `finding_status` | `pending`, `applied`, `ignored` |
| `document_kind` | `resume`, `cover_letter`, `certificate`, `diploma`, `linkedin_pdf`, `offer`, `portfolio`, `other` |
| `learning_item_type` | `course`, `book`, `certification`, `project`, `practice`, `other` |
| `item_status` | `planned`, `in_progress`, `done`, `dropped` |
| `offer_status` | `draft`, `received`, `negotiating`, `accepted`, `declined`, `expired` |
| `ai_feature` | `linkedin_audit`, `job_analysis`, `resume_tailor`, `cover_letter`, `recruiter_message`, `interview_sim`, `interview_feedback`, `ats_check`, `profile_import` |
| `ai_run_status` | `success`, `validation_failed`, `blocked_by_cap`, `provider_error`, `cached` |
| `notification_type` | `new_jobs`, `follow_up_due`, `interview_soon`, `certification_expiring`, `source_degraded`, `ai_cap_reached`, `stale_application`, `offer_deadline`, `target_company_job` |
| `notification_channel` | `in_app`, `email` |

## 4. Identidade, configuração e perfil profissional

### 4.1 `profiles` — 1:1 com `auth.users`

| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid` PK → `auth.users(id)` cascade | criado por trigger no primeiro login (RF-AUT-04) |
| `full_name` | `text` | |
| `headline` | `text` | |
| `city`, `state`, `country` | `text` | `country` ISO-3166 alpha-2, padrão `BR` |
| `timezone` | `text` not null default `America/Sao_Paulo` | |
| `locale` | `text` not null default `pt-BR` | |
| `willing_to_relocate`, `willing_to_travel` | `boolean` default `false` | |
| `salary_expectation_min`, `salary_expectation_max` | `numeric(12,2)` | |
| `salary_expectation_currency` | `char(3)` default `BRL` | |
| `salary_expectation_period` | `salary_period` default `month` | |
| `accepted_work_models` | `work_model[]` | |
| `accepted_contract_types` | `contract_type[]` | |
| `avatar_url` | `text` | |
| `onboarding_completed_at` | `timestamptz` | |
| `created_at`, `updated_at` | `timestamptz` | |

### 4.2 `user_settings` — configuração de comportamento (PK `user_id`)

`theme` (`dark` padrão / `light` / `system`), `density`, `stealth_mode bool`, `neutral_title text`
default `Painel`, `email_neutral_subject text`, `quiet_hours_start/end time`, `digest_time time`
default `08:00`, `notification_channels jsonb` (`{new_jobs:['in_app','email'], ...}`),
`min_notify_score smallint` default 70, `default_recency_hours smallint` default 24 com
`CHECK (default_recency_hours IN (24,72,168,360))`, `stale_after_days smallint` default 7,
`mask_sensitive_values bool`, `pin_hash text`, `pin_timeout_minutes smallint`,
`activity_logging_enabled bool` default true, `data_retention_days int` default 180,
`recruiter_monitoring_enabled bool` default true, `created_at`, `updated_at`.

`pin_hash` é hash Argon2id/bcrypt (módulo 11) e está na lista de campos sensíveis: nunca sai em
exportação nem em contexto de IA (RNF-SEC-11).

### 4.3 `user_limits` — o que vira plano quando o produto for SaaS (PK `user_id`)

`plan text` default `personal`, `max_active_search_profiles int` default 10,
`max_sources_per_profile int` default 10, `manual_runs_per_hour int` default 5,
`ai_monthly_cost_cap_usd numeric(8,2)` default 10, `ai_cycle_started_on date`,
`storage_quota_mb int` default 500, `max_upload_mb int` default 10, `created_at`, `updated_at`.

### 4.4 Perfil profissional

| Tabela | Campos principais | Chaves e índices |
|---|---|---|
| `career_profiles` | `user_id`, `name`, `target_title`, `normalized_target_title`, `seniority seniority_level`, `summary`, `years_experience numeric(4,1)`, `is_primary bool`, `completeness smallint`, `created_at`, `updated_at` | índice único parcial `(user_id) WHERE is_primary` garante um só primário; índice `(user_id, created_at desc)` |
| `experiences` | `user_id`, `company_id` (nullable), `company_name`, `role_title`, `start_date date`, `end_date date`, `is_current bool`, `description`, `achievements text[]`, `technologies text[]`, `location`, `contract_type` | `CHECK (end_date is null or end_date >= start_date)`; índice `(user_id, start_date desc)` |
| `career_profile_experiences` | `career_profile_id`, `experience_id`, `display_order smallint` | PK composta; permite a mesma experiência em vários perfis com ordem distinta |
| `educations` | `user_id`, `institution`, `degree`, `field`, `start_date`, `end_date`, `status text CHECK (in ('completed','in_progress','paused','dropped'))` | índice `(user_id)` |
| `certifications` | `user_id`, `name`, `issuer`, `issued_at date`, `expires_at date`, `credential_id`, `credential_url`, `document_id` → `documents` on delete set null | índice `(user_id, expires_at)` para a notificação de vencimento |
| `skills` | **catálogo global**: `id`, `slug` unique, `name`, `category`, `aliases text[]`, `is_active` | índice GIN em `aliases`; usado pela extração determinística (documento 06 §7) |
| `user_skills` | `user_id`, `skill_id`, `level smallint CHECK (1..5)`, `years_practice numeric(4,1)`, `evidence text`, `last_used_at date` | PK `(user_id, skill_id)` |
| `career_profile_skills` | `career_profile_id`, `skill_id`, `importance smallint CHECK (1..3)` | PK composta |
| `profile_links` | `user_id`, `kind text CHECK (in ('github','portfolio','linkedin','article','other'))`, `url`, `label` | índice `(user_id)` |
| `current_employment` | `user_id` **unique**, `company_id`, `company_name`, `role_title`, `started_at date`, `contract_type`, `base_salary numeric(12,2)`, `currency`, `salary_period`, `bonus_annual`, `benefits jsonb`, `work_model`, `commute_cost_monthly`, `commute_minutes_daily`, `satisfaction smallint CHECK (1..5)`, `notes` | **campo sensível** (RNF-SEC-11): fora de exportação não solicitada e de contexto de IA; base do Offer Comparator (RN-084) |

## 5. Fontes, perfis de busca e credenciais

### 5.1 `job_sources` — catálogo global de fontes (sem `user_id`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `slug` | `text` unique | `greenhouse`, `lever`, `rss-generic`, `manual`… |
| `display_name` | `text` | exibido em Configurações |
| `adapter_key` | `text` not null | **igual a** `JobSourceAdapter.key` (documento 06 §2) |
| `kind` | `source_kind` | |
| `legal_status` | `source_legal_status` not null default `review_needed` | RN-020; o guard lê este campo |
| `terms_url` | `text` | obrigatório para `allowed` (CHECK) |
| `legal_notes` | `text` | motivo legível, exibido quando a fonte está bloqueada (RF-CFG-07) |
| `robots_checked_at` | `timestamptz` | |
| `rate_limit_per_min` | `smallint` not null default 10 | RN-027 |
| `requires_user_key` | `boolean` default false | |
| `status` | `source_status` default `active` | `degraded` após 5 falhas (RNF-RES-05) |
| `consecutive_failures` | `smallint` default 0 | |
| `capabilities` | `jsonb` | espelha `adapter.capabilities`, para a UI sem carregar código |
| `config` | `jsonb` | configuração padrão da fonte |
| `last_run_at`, `last_success_at`, `last_error` | | diagnóstico (RNF-OBS-05) |

`CHECK (legal_status <> 'allowed' OR terms_url IS NOT NULL)` — uma fonte não pode ser declarada
permitida sem link para os termos que embasam a declaração.

### 5.2 `user_job_sources` e `integration_credentials`

| Tabela | Campos | Notas |
|---|---|---|
| `user_job_sources` | `user_id`, `source_id`, `is_enabled bool` default true, `config jsonb`, `credential_id` → `integration_credentials` | PK `(user_id, source_id)` |
| `integration_credentials` | `id`, `user_id`, `provider text`, `label text`, `secret_ciphertext bytea`, `secret_last4 char(4)`, `status text`, `last_used_at`, `created_at` | **nunca** retorna `secret_ciphertext` ao cliente: a view `integration_credentials_safe` expõe só `id, provider, label, secret_last4, status`. Cifragem com `pgcrypto` e chave em variável de ambiente do servidor (documento 16 §6). **Senha de plataforma não existe aqui** (RN-091) |

### 5.3 `search_profiles` — o que o usuário procura

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `user_id` | | |
| `name` | `text` not null | "Suporte Técnico SP", "Front-End remoto" |
| `career_profile_id` | `uuid` → `career_profiles` on delete set null | RN-010; nulo ⇒ componente `fit` indisponível |
| `keywords`, `excluded_keywords`, `areas`, `titles` | `text[]` | `excluded_keywords` vence (RN-016) |
| `locations` | `jsonb` | `[{city,state,country,remote}]` |
| `work_models` | `work_model[]` | vazio = qualquer |
| `contract_types` | `contract_type[]` | |
| `seniorities` | `seniority_level[]` | |
| `salary_min` | `numeric(12,2)` + `currency char(3)` default `BRL` | |
| `recency_hours` | `smallint` default 24 `CHECK (IN (24,72,168,360))` | RN-017 |
| `min_notify_score` | `smallint` | nulo ⇒ usa `user_settings` |
| `score_weights` | `jsonb` default `{"recency":25,"recruiter":25,"fit":25,"quality":25}` | `CHECK` de soma 100 por trigger |
| `is_active` | `boolean` default true | RN-014; limite de ativos por `user_limits` (RN-015), validado por trigger |
| `collect_frequency` | `text CHECK (IN ('daily','manual'))` default `daily` | RF-BSC-07 |
| `last_run_at`, `last_result_count` | | |
| `created_at`, `updated_at` | | |

`search_profile_sources`: `(search_profile_id, source_id)` PK, `is_enabled bool`, `config jsonb`.

## 6. Catálogo de vagas (ADR-004)

### 6.1 `companies` (global)

`id`, `name`, `normalized_name text not null`, `domain text`, `website_url`, `careers_url`,
`industry`, `size_range text`, `city`, `state`, `country`, `linkedin_url`, `created_at`,
`updated_at`.

Índices: `UNIQUE (normalized_name, coalesce(domain,''))` via índice único em expressão;
GIN trigram em `normalized_name` (sugestão de mesclagem, RF-CRM-09).

### 6.2 `jobs` (global)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `source_id` | → `job_sources` on delete restrict | |
| `external_id` | `text` not null | id estável na fonte |
| `company_id` | → `companies` on delete restrict | |
| `title`, `normalized_title` | `text` | `normalized_title` alimenta dedupe fuzzy |
| `description_text`, `description_html` | `text` | |
| `apply_url` | `text` not null | |
| `canonical_url` | `text` | |
| `location_raw`, `city`, `state`, `country` | `text` | |
| `work_model`, `contract_type`, `seniority` | enums, **nullable** | nulo = não informado, nunca presumido (documento 06 §7) |
| `salary_min`, `salary_max` | `numeric(12,2)` | `CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min)` |
| `salary_currency` | `char(3)` | |
| `salary_period` | `salary_period` | |
| `salary_is_estimated` | `boolean` default false | RN-005 |
| `salary_raw` | `text` | texto original preservado |
| `published_at` | `timestamptz` | RN-002 |
| `published_at_source` | `published_at_source` | |
| `published_at_confidence` | `confidence_level` not null default `unknown` | |
| `first_seen_at` | `timestamptz` not null default now() | **imutável** por trigger |
| `last_seen_at` | `timestamptz` not null default now() | |
| `missed_count` | `smallint` default 0 | RN-023 |
| `is_active` | `boolean` default true | |
| `closed_at` | `timestamptz` | |
| `fingerprint` | `char(64)` not null | SHA-256 (RN-021) |
| `recruiter_id` | → `recruiters` on delete set null | |
| `search_vector` | `tsvector` gerado | `to_tsvector('portuguese', unaccent(title || ' ' || coalesce(description_text,'')))` |
| `created_at`, `updated_at` | | |

Índices:

```sql
UNIQUE (source_id, external_id)                             -- identidade na fonte (RN-021)
(fingerprint, first_seen_at DESC)                           -- dedupe nível 2
(company_id, city, first_seen_at DESC)                      -- dedupe nível 3
(published_at DESC) WHERE is_active                         -- listagens por recência
(first_seen_at DESC)                                        -- "detectadas em"
GIN (normalized_title gin_trgm_ops)                         -- similaridade
GIN (search_vector)                                         -- busca textual
(source_id, last_seen_at)                                   -- rotina de encerramento
```

### 6.3 Satélites de `jobs`

| Tabela | Campos | Notas |
|---|---|---|
| `job_raw_payloads` | `id`, `job_id` cascade, `source_id`, `fetched_at`, `payload jsonb`, `http_meta jsonb` | retenção 90 dias (documento 06 §9); índice `(fetched_at)` para o expurgo |
| `job_duplicates` | `id`, `job_id` cascade, `canonical_job_id` cascade, `strategy duplicate_strategy`, `similarity numeric(4,3)`, `detected_at` | `UNIQUE (job_id, canonical_job_id)`; `CHECK (job_id <> canonical_job_id)`; nada é apagado (RN-022) |
| `job_skills` | `job_id` cascade, `skill_id`, `occurrences smallint`, `extraction text` default `dictionary` | PK `(job_id, skill_id)` |

### 6.4 `job_matches` — o vínculo pessoal (é aqui que vive o dado do usuário)

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `user_id`, `search_profile_id` (cascade), `job_id` (cascade) | | |
| `score` | `smallint` **nullable** `CHECK (0..100)` | nulo quando nenhum componente estava disponível (documento 08 §2) |
| `data_coverage` | `numeric(3,2)` | |
| `low_confidence` | `boolean` gerado (`data_coverage < 0.5`) | |
| `score_version` | `text` | |
| `score_breakdown` | `jsonb` | fonte única da explicação exibida (RN-034) |
| `scored_at`, `matched_at` | `timestamptz` | `matched_at` muda só quando o score muda (RN-024) |
| `status` | `job_match_status` default `new` | |
| `dismissed_reason`, `dismissed_at` | | RN-025 |
| `notified_at` | `timestamptz` | evita renotificar |
| `created_at`, `updated_at` | | |

```sql
UNIQUE (user_id, search_profile_id, job_id)                      -- RN-024
(user_id, search_profile_id, score DESC NULLS LAST, id DESC)     -- listagem ordenada
(user_id, status, matched_at DESC)
(user_id, matched_at DESC) WHERE status = 'new'                  -- dashboard
```

## 7. Coleta

| Tabela | Campos | Notas |
|---|---|---|
| `collector_queue` | `id`, `user_id`, `search_profile_id`, `source_id`, `status queue_status` default `pending`, `priority smallint` default 0, `scheduled_for timestamptz` default now(), `started_at`, `finished_at`, `attempts smallint` default 0, `last_error text`, `cursor text`, `dedupe_key text` **unique**, `created_at` | consumida com `FOR UPDATE SKIP LOCKED` (ADR-010); índice `(status, scheduled_for, priority DESC)`; `dedupe_key` torna o planner idempotente |
| `collector_runs` | `id`, `user_id` (nullable para rotinas globais), `search_profile_id`, `source_id` (nullable), `scope text` (`jobs`,`recruiters`,`insights`,`recalc`,`retention`), `trigger run_trigger`, `started_at`, `finished_at`, `duration_ms int`, `status run_status`, `items_found/new/updated/duplicated/filtered/failed int`, `filtered_reasons jsonb`, `request_count smallint`, `error_message text`, `request_id text` | RN-029; índice `(user_id, started_at DESC)` e `(source_id, started_at DESC)` |

`error_message` é truncado em 2.000 caracteres e **nunca** contém dado pessoal nem segredo
(RNF-OBS-04).

## 8. Recrutadores

| Tabela | Campos | Notas |
|---|---|---|
| `recruiters` | `id`, `user_id` (nullable = global, RN-046), `full_name`, `normalized_name`, `headline`, `company_id`, `company_name_raw`, `profile_url`, `normalized_profile_url`, `specialties text[]`, `source text` (`job_source`,`manual`,`import`), `activity_status recruiter_activity_status` default `no_activity_found`, `activity_status_reason text`, `activity_status_updated_at`, `last_activity_id`, `last_activity_at`, `last_activity_confidence confidence_level`, `next_review_at`, `merged_into_id` → `recruiters`, `merged_at`, `notes`, `created_at`, `updated_at` | `UNIQUE (normalized_profile_url)` onde não nulo; índice `(user_id, activity_status, last_activity_at DESC)`; GIN trigram em `normalized_name`. Campos de classificação escritos só por `lib/recruiters/update-status.ts` (documento 07 §4) |
| `recruiter_activities` | `id`, `recruiter_id` cascade, `user_id` (nullable), `activity_type recruiter_activity_type`, `is_recruiting_related bool not null`, `occurred_at`, `occurred_at_confidence confidence_level` not null, `observed_at` not null default now(), `url`, `excerpt text CHECK (length ≤ 280)`, `source_id`, `job_id` → `jobs` on delete set null, `created_by text CHECK (IN ('system','user'))`, `created_at` | `UNIQUE (recruiter_id, job_id)` onde `job_id` não nulo (idempotência da vinculação, documento 07 §5.1); `CHECK (url IS NOT NULL OR excerpt IS NOT NULL)` (RN-040); índice `(recruiter_id, occurred_at DESC NULLS LAST)` |
| `recruiter_contacts` | `id`, `user_id`, `recruiter_id` cascade, `channel contact_channel`, `direction contact_direction`, `subject`, `notes`, `occurred_at`, `outcome text`, `follow_up_at`, `follow_up_done bool`, `application_id` → `applications` on delete set null, `created_at` | índice `(user_id, follow_up_at) WHERE follow_up_done = false` — é a consulta da notificação de follow-up |
| `company_blocklist` | `id`, `user_id`, `company_id` (nullable), `company_name_pattern text`, `reason`, `created_at` | `CHECK (company_id IS NOT NULL OR company_name_pattern IS NOT NULL)`; precedência absoluta (RN-013) |
| `company_watchlist` | `id`, `user_id`, `company_id`, `relationship text CHECK (IN ('target','neutral'))`, `alert_on_new_job bool`, `notes`, `rating smallint`, `created_at` | `UNIQUE (user_id, company_id)`; RF-CRM-07, RF-CRM-08 |

## 9. Candidaturas

| Tabela | Campos | Notas |
|---|---|---|
| `applications` | `id`, `user_id`, `job_id` (nullable, on delete set null), `company_id`, `company_name` not null, `role_title` not null, `job_url`, `salary_min/max`, `salary_currency`, `salary_period`, `stage application_stage` default `radar`, `stage_changed_at`, `applied_at`, `next_action text`, `next_action_at`, `is_stale bool`, `is_archived bool` default false, `archived_at`, `recruiter_id`, `resume_version_id`, `cover_letter_document_id`, `origin text` (`radar`,`manual`), `score_at_apply smallint`, `notes`, `last_event_at`, `created_at`, `updated_at` | cópia de dados da vaga é deliberada (RN-050). `UNIQUE (user_id, job_id) WHERE job_id IS NOT NULL AND is_archived = false` (RN-053). `CHECK (next_action IS NULL OR next_action_at IS NOT NULL)` (RN-056). Índices `(user_id, stage, last_event_at DESC)`, `(user_id, next_action_at) WHERE next_action_at IS NOT NULL AND is_archived = false` |
| `application_events` | `id`, `application_id` cascade, `user_id`, `event_type application_event_type`, `from_stage`, `to_stage`, `occurred_at` default now(), `payload jsonb`, `created_at` | **somente inserção** (RN-054): a RLS não concede `UPDATE` nem `DELETE`. Índice `(application_id, occurred_at DESC)` |
| `interviews` | `id`, `user_id`, `application_id` cascade, `kind interview_kind`, `scheduled_at`, `duration_minutes smallint`, `mode text` (`remote`,`onsite`,`phone`), `location_or_link`, `interviewers jsonb`, `preparation_notes`, `feedback_notes`, `outcome text`, `created_at`, `updated_at` | índice `(user_id, scheduled_at)` — alimenta dashboard e notificação |

## 10. LinkedIn

| Tabela | Campos | Notas |
|---|---|---|
| `linkedin_profile_versions` | `id`, `user_id`, `input_method linkedin_input_method`, `captured_at`, `source_url`, `document_id` → `documents` on delete set null, `raw_text text`, `snapshot jsonb not null`, `coverage jsonb not null`, `reviewed_at` not null, `created_at` | `reviewed_at` obrigatório: sem revisão humana não há auditoria (documento 09 §6) |
| `linkedin_audits` | `id`, `user_id`, `profile_version_id` cascade, `previous_audit_id` → self on delete set null, `search_profile_id` (alinhamento, RF-LKD-12), `status audit_status`, `overall_score smallint`, `evaluated_weight smallint`, `profile_coverage numeric(3,2)`, `weights jsonb`, `score_version text`, `ai_run_id` → `ai_runs`, `started_at`, `finished_at`, `error_code`, `error_message`, `created_at` | índice `(user_id, created_at DESC)` |
| `linkedin_audit_sections` | `id`, `audit_id` cascade, `user_id`, `section_key text`, `status section_status`, `weight smallint`, `score_0_10 smallint`, `weighted_points numeric(5,2)`, `deterministic_score smallint`, `ai_score smallint`, `rationale text`, `original_text text`, `optimized_text text` | `UNIQUE (audit_id, section_key)`; imutável após `completed` (RLS sem `UPDATE`) |
| `linkedin_audit_findings` | `id`, `audit_id` cascade, `user_id`, `section_key`, `issue`, `impact`, `how_to_fix`, `example_text`, `severity finding_severity`, `priority smallint`, `has_placeholder bool`, `used_facts jsonb`, `status finding_status` default `pending`, `status_changed_at`, `created_at` | as cinco partes são `NOT NULL` (RN-063) — a regra fica no schema, não só no código. Único campo mutável: `status`/`status_changed_at` (coluna-nível, por política de RLS com `WITH CHECK` restritivo) |

## 11. IA e assistente

| Tabela | Campos | Notas |
|---|---|---|
| `ai_runs` | `id`, `user_id`, `feature ai_feature`, `model text`, `prompt_version text`, `input_hash char(64)`, `status ai_run_status`, `tokens_in int`, `tokens_out int`, `cost_usd numeric(10,6)`, `latency_ms int`, `cached bool`, `error_code text`, `request_id text`, `entity_type`, `entity_id`, `created_at` | índices `(user_id, created_at DESC)` e `(user_id, input_hash, created_at DESC)` (cache, RN-071). Soma de `cost_usd` do ciclo versus `user_limits` implementa RN-070. **Nunca** guarda prompt nem resposta integral (RNF-OBS-04) |
| `assistant_threads` | `id`, `user_id`, `kind ai_feature`, `job_id`, `application_id`, `title`, `created_at`, `updated_at` | |
| `assistant_messages` | `id`, `thread_id` cascade, `user_id`, `role text CHECK (IN ('user','assistant','system'))`, `content text`, `artifact_type text`, `artifact jsonb`, `ai_run_id`, `created_at` | índice `(thread_id, created_at)` |

## 12. Biblioteca e currículos

| Tabela | Campos | Notas |
|---|---|---|
| `documents` | `id`, `user_id`, `kind document_kind`, `title`, `storage_path text not null unique`, `mime_type`, `size_bytes bigint`, `checksum`, `extracted_text text`, `tags text[]`, `issued_at`, `expires_at`, `is_sensitive bool`, `created_at`, `deleted_at` | `storage_path` segue `{user_id}/{kind}/{uuid}.{ext}` — a política de Storage depende disso (módulo 10 do documento 05). Índice GIN em `tags`; `(user_id, kind, created_at DESC)` |
| `document_links` | `id`, `user_id`, `document_id` cascade, `entity_type text` (`application`,`audit`,`offer`,`certification`,`milestone`), `entity_id uuid`, `created_at` | `UNIQUE (document_id, entity_type, entity_id)` |
| `resumes` | `id`, `user_id`, `name`, `career_profile_id`, `is_master bool`, `current_version_id`, `created_at`, `updated_at` | índice único parcial `(user_id) WHERE is_master` |
| `resume_versions` | `id`, `resume_id` cascade, `user_id`, `version_number int`, `content jsonb not null`, `document_id`, `generated_for_job_id`, `ai_run_id`, `notes`, `created_at` | `UNIQUE (resume_id, version_number)`; versões são imutáveis |

## 13. Inteligência de mercado e desenvolvimento

| Tabela | Campos | Notas |
|---|---|---|
| `market_insights` | `id`, `scope jsonb not null` (`{area,title,seniority,city,state,work_model}`), `scope_hash char(64)`, `metric text` (`salary_stats`,`skill_frequency`,`work_model_share`,`contract_share`,`top_companies`), `value jsonb not null`, `sample_size int not null`, `period_start date`, `period_end date`, `insight_version text`, `computed_at` | **global, sem `user_id`** (agregado anônimo de dado público). `UNIQUE (scope_hash, metric, period_start, period_end)`. `CHECK (sample_size >= 8)` materializa RN-004 no banco: estatística com amostra insuficiente não é gravada |
| `user_skills` | ver §4.4 | |
| `career_goals` | `id`, `user_id`, `title`, `metric`, `target_value numeric`, `current_value numeric`, `unit`, `due_date`, `status item_status`, `created_at`, `updated_at` | |
| `learning_plans` | `id`, `user_id`, `title`, `target_role`, `career_profile_id`, `status item_status`, `start_date`, `due_date`, `created_at`, `updated_at` | |
| `learning_items` | `id`, `plan_id` cascade, `user_id`, `skill_id`, `type learning_item_type`, `title`, `provider`, `url`, `cost numeric(10,2)`, `currency`, `estimated_hours numeric(5,1)`, `completed_hours numeric(5,1)`, `due_date`, `status item_status`, `is_user_provided bool not null default true`, `completed_at`, `display_order` | `is_user_provided` existe por causa do RF-GRW-07: item com `provider`/`url` só pode ser gravado se vier do usuário. Trigger rejeita `provider IS NOT NULL AND is_user_provided = false` |
| `career_milestones` | `id`, `user_id`, `kind text`, `title`, `description`, `occurred_at date`, `document_id`, `created_at` | |

## 14. Propostas

| Tabela | Campos | Notas |
|---|---|---|
| `job_offers` | `id`, `user_id`, `application_id` (nullable), `company_id`, `company_name`, `role_title`, `contract_type`, `base_salary numeric(12,2)`, `salary_period`, `currency`, `bonus_annual`, `profit_sharing`, `equity_annualized`, `meal_allowance_monthly`, `health_plan_value_monthly`, `other_allowances jsonb`, `vacation_days smallint`, `work_model`, `commute_cost_monthly`, `commute_minutes_daily`, `pj_effective_tax_rate numeric(5,2)`, `response_deadline date`, `status offer_status`, `computed jsonb`, `assumptions jsonb not null`, `tax_table_version text not null`, `decision text`, `decision_reason`, `decided_at`, `created_at`, `updated_at` | `assumptions` e `tax_table_version` são obrigatórios: comparação sem premissas declaradas não é gravável (RN-080) |
| `offer_criteria_weights` | `user_id`, `criterion text`, `weight smallint CHECK (0..10)` | PK `(user_id, criterion)`; pesos são do usuário (RN-085) |
| `offer_criteria_scores` | `offer_id` cascade, `user_id`, `criterion`, `score_0_10 smallint` | PK `(offer_id, criterion)` |

## 15. Notificações, auditoria e limites

| Tabela | Campos | Notas |
|---|---|---|
| `notifications` | `id`, `user_id`, `type notification_type`, `severity text`, `title`, `body`, `entity_type`, `entity_id`, `channel notification_channel`, `digest_id`, `read_at`, `sent_at`, `suppressed_by_stealth bool`, `created_at` | índice `(user_id, read_at NULLS FIRST, created_at DESC)` |
| `notification_digests` | `id`, `user_id`, `scheduled_for`, `sent_at`, `items jsonb`, `channel`, `created_at` | RF-NOT-03 |
| `audit_logs` | `id`, `user_id`, `action text`, `entity_type`, `entity_id`, `request_id`, `ip_hash`, `user_agent_hash`, `metadata jsonb`, `created_at` | só hash de IP/UA (privacidade); desligável (RNF-PRIV-05); expurgo por `data_retention_days` |
| `rate_limits` | `id`, `user_id`, `bucket text`, `window_start timestamptz`, `count int` | `UNIQUE (user_id, bucket, window_start)`; consumida pela função `check_rate_limit()` (documento 16 §7) |

## 16. Funções, triggers e views

| Objeto | Finalidade |
|---|---|
| `set_updated_at()` | trigger `BEFORE UPDATE` em toda tabela com `updated_at` |
| `handle_new_user()` | `AFTER INSERT ON auth.users`: cria `profiles`, `user_settings`, `user_limits` e `offer_criteria_weights` padrão (RF-AUT-04) |
| `protect_job_immutable_fields()` | impede `UPDATE` de `first_seen_at`, `published_at` e proveniência por coleta posterior (documento 06 §6) |
| `enforce_active_search_profile_limit()` | RN-015 |
| `enforce_score_weights_sum()` | soma dos pesos = 100 (RN-031) |
| `claim_next_collector_lot()` | `FOR UPDATE SKIP LOCKED`, devolve um lote (documento 06 §4.2) |
| `check_rate_limit(bucket, limit, window)` | incremento atômico e verificação (RNF-SEC-07) |
| `log_application_stage_change()` | insere `application_events` em toda mudança de `stage` (RN-051) e preenche `applied_at` ao entrar em `applied` |
| `mark_stale_applications()` | RN-055, chamada pela rotina diária |
| `current_ai_cycle_cost(user_id)` | soma `ai_runs.cost_usd` do ciclo, para RN-070 |
| `integration_credentials_safe` (view) | credencial sem o segredo |
| `dashboard_counters(user_id)` (função) | contadores do dashboard em uma única ida ao banco |

## 17. Row Level Security — padrão por categoria de tabela

**Categoria 1 — dado pessoal (a grande maioria).** Política única por operação:

```sql
alter table public.<t> enable row level security;

create policy "<t>_select_own" on public.<t> for select using (user_id = auth.uid());
create policy "<t>_insert_own" on public.<t> for insert with check (user_id = auth.uid());
create policy "<t>_update_own" on public.<t> for update using (user_id = auth.uid())
                                                  with check (user_id = auth.uid());
create policy "<t>_delete_own" on public.<t> for delete using (user_id = auth.uid());
```

**Categoria 2 — filha de tabela pessoal.** Mantém `user_id` denormalizado (decisão deliberada:
política simples e índice direto valem mais que a normalização perfeita) e usa o mesmo padrão.
Trigger garante que o `user_id` da filha é igual ao do pai.

**Categoria 3 — histórico imutável** (`application_events`): só `SELECT` e `INSERT`. Sem política
de `UPDATE`/`DELETE` ⇒ a operação é negada (RN-054).

**Categoria 4 — auditoria concluída** (`linkedin_audit_sections`, `resume_versions`): `SELECT` e
`INSERT` para o dono; `UPDATE` apenas em `linkedin_audit_findings.status`, por política com
`WITH CHECK` que compara as demais colunas com `OLD` em trigger auxiliar.

**Categoria 5 — catálogo público** (`jobs`, `companies`, `job_sources`, `skills`, `job_skills`,
`job_duplicates`, `market_insights`): `SELECT` para `authenticated`; nenhuma política de escrita ⇒
só `service_role` escreve (ADR-004). `job_raw_payloads` **não** é legível pelo cliente: nenhuma
política de `SELECT`.

**Categoria 6 — infraestrutura** (`collector_queue`, `rate_limits`): nenhuma política; acesso
exclusivo por `service_role`. `collector_runs` tem `SELECT` do próprio usuário (precisa aparecer no
diagnóstico) e escrita só por `service_role`.

**Variante mais restritiva para `jobs`** (documentada para o caso de entrarem fontes licenciadas,
ADR-004): trocar a política de `SELECT` por

```sql
using (exists (select 1 from job_matches m
                where m.job_id = jobs.id and m.user_id = auth.uid()));
```

O custo é perder a listagem de vagas ainda não pontuadas; o ganho é isolamento total. A decisão
atual é a versão aberta, porque o conteúdo é público e a alternativa prejudica o desempenho.

## 18. Isolamento de usuários — como isso é verificado

1. **Teste automatizado de cobertura de RLS** (RNF-SEC-01): consulta `pg_tables` ∖ lista branca de
   tabelas globais; qualquer tabela sem `rowsecurity = true` ou sem política falha o CI.
2. **Teste de travessia** (RNF-TST-03): para cada tabela pessoal, o usuário A tenta `select`,
   `update` e `delete` em linha do usuário B, por conexão com JWT real. Esperado: 0 linhas e erro.
3. **Teste de Storage:** usuário A tenta baixar `B/resume/<uuid>.pdf` com o caminho exato ⇒ negado.
4. **Proibição de `service_role` fora do coletor:** regra de ESLint + teste que varre o bundle do
   cliente procurando a string da variável de ambiente.

## 19. Retenção e expurgo (RNF-SCAL-04, RNF-PRIV-06)

| Dado | Retenção | Rotina |
|---|---|---|
| `job_raw_payloads` | 90 dias | `retention` (semanal) |
| `audit_logs` | `user_settings.data_retention_days` (padrão 180) | `retention` |
| `ai_runs` | 365 dias (o custo agregado por mês é preservado em `ai_cost_monthly`) | `retention` |
| `collector_runs` | 180 dias | `retention` |
| `recruiter_activities` | mantidas; expurgo só por exclusão do recrutador | — |
| `jobs`, `job_matches`, `applications` | **sem expurgo** — são o histórico profissional do usuário | — |
| `notifications` lidas | 90 dias | `retention` |
| Documentos no Storage | até exclusão pelo usuário; órfãos expurgados semanalmente | `retention` |

## 20. Critérios de conclusão do modelo (Fase 1)

- [ ] Todas as migrations aplicam em banco limpo e são idempotentes (rodar duas vezes não falha).
- [ ] `supabase gen types typescript` gera `lib/db/database.types.ts` sem erro e o CI verifica que
      o arquivo versionado está atualizado.
- [ ] Teste de cobertura de RLS passa com a lista branca contendo exatamente as 10 tabelas globais.
- [ ] Teste de travessia A→B passa para todas as tabelas pessoais.
- [ ] Trigger de criação de usuário cria as quatro linhas padrão (teste).
- [ ] `EXPLAIN ANALYZE` das 10 consultas principais sem `Seq Scan` em tabela grande (RNF-PERF-04).
- [ ] Seed cria fontes de vaga, ~300 competências com aliases e dados de exemplo para
      desenvolvimento.
