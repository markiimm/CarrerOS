# 06 — Job Radar: arquitetura do mecanismo de busca

> Este é o motor do produto. Tudo aqui é determinístico: **nenhuma IA participa da coleta**.
> Isso mantém o custo recorrente próximo de zero e o resultado reproduzível e testável.

## 1. Arquitetura em anéis

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ANEL 3 — AGENDAMENTO                                                     │
│ vercel.json cron → POST /api/cron/collect-jobs (Bearer CRON_SECRET)      │
│   planner: expande (search_profile × source) ativos → collector_queue    │
│   runner:  consome lotes até o limite de tempo; devolve o resto à fila   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ ANEL 2 — NÚCLEO (lib/radar/core/) — não muda ao adicionar fonte          │
│  guard → fetch → normalize → resolveDate → filter → persist → dedupe    │
│  → linkRecruiter → score → notify → closeRun                            │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ ANEL 1 — ADAPTADORES (lib/radar/adapters/) — um arquivo por fonte       │
│  implementam JobSourceAdapter; só sabem falar com a própria fonte       │
│  greenhouse.ts · lever.ts · ashby.ts · recruitee.ts · rss-generic.ts   │
│  jsonld-careers.ts · manual.ts · email-alert.ts                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Invariante central:** o núcleo nunca conhece o nome de uma fonte. Ele recebe
`RawJob[]` e não sabe de onde veio. O adaptador nunca conhece perfil de busca, score ou banco.

## 2. Contrato do adaptador

`lib/radar/types.ts` — **este contrato é congelado**; mudá-lo exige atualizar este documento.

```ts
/** O que o núcleo pede ao adaptador. Já resolvido a partir do search_profile. */
export interface SourceQuery {
  keywords: string[];
  excludedKeywords: string[];
  locations: Array<{ city?: string; state?: string; country?: string; remote?: boolean }>;
  workModels: WorkModel[];          // 'onsite' | 'hybrid' | 'remote'
  contractTypes: ContractType[];    // 'clt' | 'pj' | 'internship' | 'temporary' | 'freelance'
  seniorities: Seniority[];
  salaryMin?: number;
  currency: string;                 // ISO-4217
  publishedSince: Date;             // derivado da janela de recência
  limit: number;                    // teto de itens por execução (padrão 100)
  cursor?: string | null;           // paginação opaca, devolvida pelo adaptador
}

/** O que o adaptador devolve. Campos desconhecidos ficam ausentes — nunca inventados. */
export interface RawJob {
  externalId: string;               // id estável na fonte; obrigatório
  title: string;
  companyName: string;
  companyDomain?: string;
  descriptionHtml?: string;
  descriptionText?: string;
  locationRaw?: string;
  workModelRaw?: string;
  contractTypeRaw?: string;
  seniorityRaw?: string;
  salaryRaw?: string;               // texto original, preservado
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: 'hour' | 'month' | 'year';
  applyUrl: string;
  canonicalUrl?: string;
  /** Data de publicação COM proveniência. Ver §5 e RN-002. */
  publishedAt?: { value: Date; source: PublishedAtSource; confidence: Confidence };
  recruiter?: { fullName?: string; headline?: string; profileUrl?: string };
  raw: unknown;                     // payload original, gravado em job_raw_payloads
}

export interface FetchResult {
  jobs: RawJob[];
  nextCursor?: string | null;
  /** Diagnóstico honesto do que a fonte permitiu nesta chamada. */
  meta: {
    requestCount: number;
    serverFilteredBy: Array<keyof SourceQuery>; // filtros que a FONTE aplicou
    truncated: boolean;                          // havia mais itens do que o limite
    notes?: string[];
  };
}

export interface JobSourceAdapter {
  /** Igual a job_sources.adapter_key. */
  readonly key: string;
  readonly displayName: string;
  readonly kind: 'official_api' | 'ats_public_api' | 'rss' | 'jsonld_page' | 'manual' | 'email_alert';
  /** Capacidades declaradas — o núcleo usa para decidir o que filtrar localmente. */
  readonly capabilities: {
    supportsKeywordSearch: boolean;
    supportsLocationFilter: boolean;
    supportsDateFilter: boolean;
    providesPublishedAt: boolean;
    providesSalary: boolean;
    providesRecruiter: boolean;
    paginated: boolean;
    maxItemsPerRequest: number;
  };
  /** Validação da configuração da fonte (ex.: board token obrigatório). */
  validateConfig(config: unknown): { ok: true; config: object } | { ok: false; error: string };
  fetch(query: SourceQuery, ctx: AdapterContext): Promise<FetchResult>;
}

export interface AdapterContext {
  config: Record<string, unknown>;  // job_sources.config + user_job_sources.config
  credential?: string;              // somente se requires_user_key; decifrada em memória
  http: HttpClient;                 // com timeout, retry, user-agent e rate limit embutidos
  logger: Logger;
  signal: AbortSignal;              // o núcleo aborta ao chegar perto do limite de tempo
}
```

### Registry

`lib/radar/adapters/index.ts`:

```ts
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { rssGeneric } from './rss-generic';
// ... novo adaptador: uma linha de import e uma no objeto

export const ADAPTERS: Record<string, JobSourceAdapter> = {
  [greenhouse.key]: greenhouse,
  [lever.key]: lever,
  [rssGeneric.key]: rssGeneric,
};

export function getAdapter(key: string): JobSourceAdapter {
  const a = ADAPTERS[key];
  if (!a) throw new SourceError('not_allowed', `Adaptador não registrado: ${key}`);
  return a;
}
```

**Adicionar uma fonte = 3 passos, zero mudança no núcleo:**
1. criar `lib/radar/adapters/<nome>.ts` implementando o contrato;
2. adicionar a linha no `ADAPTERS`;
3. inserir a linha em `job_sources` (migration de seed) com `adapter_key`, `legal_status`,
   `terms_url`, `rate_limit_per_min` e `config`.

## 3. O guard de legalidade (primeiro passo, sem exceção)

```ts
// lib/radar/core/guard.ts
export function assertCollectable(source: JobSourceRow, hasUserKey: boolean): void {
  if (source.legal_status === 'disallowed')
    throw new SourceError('not_allowed', `Fonte ${source.slug}: coleta não permitida (${source.legal_notes})`);
  if (source.legal_status === 'review_needed')
    throw new SourceError('not_allowed', `Fonte ${source.slug}: pendente de avaliação de termos de uso`);
  if (source.legal_status === 'requires_user_key' && !hasUserKey)
    throw new SourceError('auth', `Fonte ${source.slug}: exige chave do próprio usuário`);
  if (source.status !== 'active')
    throw new SourceError('blocked', `Fonte ${source.slug} está ${source.status}`);
}
```

Chamado antes de qualquer requisição de rede (RN-020). Coberto por teste que tenta coletar uma
fonte `disallowed` com todas as flags ligadas e espera exceção.

## 4. Pipeline detalhado

### 4.1 Planner

```
para cada user ativo
  para cada search_profile com is_active = true          [RN-014]
    para cada source habilitada no perfil
         e com legal_status = 'allowed' (ou 'requires_user_key' com chave)
      INSERT INTO collector_queue (user_id, search_profile_id, source_id, scheduled_for, dedupe_key)
      ON CONFLICT (dedupe_key) DO NOTHING   -- idempotente: rodar o planner 2x não duplica
```

`dedupe_key = md5(search_profile_id || source_id || date_trunc('hour', now()))`.

### 4.2 Runner (consome a fila respeitando o limite de tempo)

```ts
const deadline = Date.now() + RUN_BUDGET_MS;   // 45_000 (RNF-PERF-05)
while (Date.now() < deadline - LOT_RESERVE_MS) {
  const lot = await claimNextLot();             // FOR UPDATE SKIP LOCKED LIMIT 1
  if (!lot) break;
  try   { await processLot(lot); await completeLot(lot.id); }
  catch (e) { await failLot(lot.id, e); }       // attempts++, backoff; attempts>=5 → 'dead'
}
```

SQL de reivindicação:

```sql
UPDATE collector_queue q
   SET status = 'processing', started_at = now(), attempts = attempts + 1
 WHERE q.id = (
   SELECT id FROM collector_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY priority DESC, scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT 1)
RETURNING *;
```

### 4.3 `processLot` — as nove etapas

| # | Etapa | Função | Regras |
|---|---|---|---|
| 1 | Guard | `assertCollectable` | RN-020 |
| 2 | Fetch | `adapter.fetch(query, ctx)` | timeout 15 s, 3 tentativas, rate limit por fonte (RN-027) |
| 3 | Normalizar | `normalizeJob(raw)` → `NormalizedJob` | RN-008, RN-016 |
| 4 | Resolver data | `resolvePublishedAt(raw, response)` | RN-002 (§5) |
| 5 | Filtrar | `applyProfileFilters(job, profile, adapter.capabilities)` | RN-003, RN-013, RN-016, RN-026 |
| 6 | Persistir | `upsertCompany` → `upsertJob` → `insertRawPayload` | RN-021 |
| 7 | Deduplicar | `detectDuplicates(job)` | RN-021, RN-022 (§6) |
| 8 | Recrutador | `linkRecruiterFromJob(job)` | RN-043 |
| 9 | Pontuar e notificar | `calculateOpportunityScore` → `upsertJobMatch` → `queueDigestItem` | RN-030..RN-035, RF-NOT-03 |

Ao fim, `collector_runs` recebe: `items_found`, `items_new`, `items_updated`,
`items_duplicated`, `items_filtered` (com motivo agregado em `jsonb`), `items_failed`,
`duration_ms`, `status`, `error_message`.

### 4.4 Filtro local versus filtro na fonte

O núcleo olha `adapter.capabilities` e `FetchResult.meta.serverFilteredBy` e **reaplica
localmente todo filtro que a fonte não aplicou**. Nunca se confia que a fonte filtrou. Toda
exclusão local é contabilizada por motivo:

```ts
type FilterReason =
  | 'out_of_recency_window' | 'excluded_keyword' | 'missing_keyword'
  | 'location_mismatch' | 'work_model_mismatch' | 'contract_mismatch'
  | 'seniority_mismatch'  | 'salary_below_min'  | 'company_blocked'
  | 'already_dismissed';
```

Esses contadores aparecem no painel de execuções: é assim que o usuário entende por que uma
coleta trouxe 3 vagas em vez de 80 — e é assim que se depura um perfil de busca mal configurado.

## 5. Validação da data original de publicação (RN-002)

```ts
export function resolvePublishedAt(raw: RawJob, httpMeta: HttpMeta, now = new Date()):
  { value: Date; source: PublishedAtSource; confidence: Confidence } {

  // 1. Campo estruturado da fonte (melhor caso)
  if (raw.publishedAt?.source === 'api_field' && isSane(raw.publishedAt.value, now))
    return { ...raw.publishedAt, confidence: 'exact' };

  // 2. Metadado da página: JSON-LD JobPosting.datePosted, <meta>, <time datetime>
  const meta = httpMeta.jsonLd?.datePosted ?? httpMeta.metaDatePosted ?? httpMeta.timeDatetime;
  if (meta && isSane(meta, now))
    return { value: meta, source: 'page_metadata', confidence: 'exact' };

  // 3. Texto relativo ("há 2 dias", "ontem", "2 days ago") — aproximado por definição
  const rel = parseRelativePtEn(raw.publishedAtText);
  if (rel && isSane(rel, now))
    return { value: rel, source: 'source_relative', confidence: 'approximate' };

  // 4. Cabeçalho HTTP Last-Modified — aproximado e frágil
  if (httpMeta.lastModified && isSane(httpMeta.lastModified, now))
    return { value: httpMeta.lastModified, source: 'http_header', confidence: 'approximate' };

  // 5. Desconhecida: usa first_seen APENAS para ordenar. A UI dirá "detectada em".
  return { value: now, source: 'first_seen', confidence: 'unknown' };
}

/** Rejeita data futura e data anterior a 400 dias — fonte com dado corrompido. */
function isSane(d: Date, now: Date) {
  return d.getTime() <= now.getTime() + 36e5 && d.getTime() > now.getTime() - 400 * 864e5;
}
```

Regras de exibição, obrigatórias na interface:

| `confidence` | Rótulo na interface | Entra na janela de 24h? | Componente de recência do score |
|---|---|---|---|
| `exact` | "publicada há 3 horas" | sim, por `published_at` | calculado normalmente |
| `approximate` | "publicada há ~2 dias" + ícone de aproximação | sim, por `published_at` | calculado, com penalidade de confiança de 10% |
| `unknown` | "detectada em 10/11 às 06:12" | sim, por `first_seen_at`, com selo "data não confirmada" | **indisponível** (RN-003) |

## 6. Deduplicação

### Nível 1 — identidade na fonte

`UNIQUE (source_id, external_id)`. `INSERT ... ON CONFLICT DO UPDATE` atualizando campos mutáveis
(`title`, `description`, `salary*`, `apply_url`, `last_seen_at`, `is_active`) e **preservando**
`first_seen_at`, `published_at` e sua proveniência (a data original nunca é reescrita por uma
coleta posterior).

### Nível 2 — fingerprint entre fontes

```ts
export function fingerprint(j: NormalizedJob): string {
  const t = canon(j.title);        // minúsculas, sem acento, sem pontuação, espaços colapsados,
                                   // sem sufixos duplicados de senioridade (jr/pl/sr/i/ii/iii)
  const c = canon(j.companyName);  // sem sufixo societário (ltda, s.a., me, eireli, inc, llc)
  const l = canon(j.city ?? j.locationRaw ?? '');
  return sha256(`${t}|${c}|${l}|${j.workModel ?? 'unknown'}`);
}
```

Mesmo `fingerprint` nos últimos `FINGERPRINT_WINDOW_DAYS` (45) ⇒ registra em `job_duplicates`
com `strategy='fingerprint'`, `similarity=1.0`, apontando para a vaga mais antiga (canônica).

### Nível 3 — similaridade (fuzzy)

```sql
SELECT j.id, similarity(j.normalized_title, $1) AS sim
  FROM jobs j
 WHERE j.company_id = $2
   AND coalesce(j.city,'') = coalesce($3,'')
   AND j.first_seen_at > now() - interval '45 days'
   AND j.id <> $4
   AND j.normalized_title % $1          -- índice GIN trigram
 ORDER BY sim DESC LIMIT 1;
```

`sim >= 0.82` ⇒ duplicata com `strategy='fuzzy'` e `similarity = sim` (RN-022).

**Nada é apagado.** As duas linhas permanecem; a interface exibe a canônica e lista as fontes
irmãs, com link para cada uma — porque o usuário pode preferir se candidatar pela fonte que
permite contato direto.

## 7. Normalização

Funções puras em `lib/radar/core/normalize.ts`, todas com teste de tabela:

| Campo | Regra |
|---|---|
| `normalized_title` | `canon(title)`; mapeamento por dicionário (`lib/radar/dictionaries/titles.ts`): "dev front end", "front-end developer", "desenvolvedor frontend" → `desenvolvedor front-end`. Dicionário é dado, não código. |
| `work_model` | dicionário pt/en: "remoto", "home office", "100% remote", "anywhere" → `remote`; "híbrido", "hybrid", "X dias no escritório" → `hybrid`; ausente → `null` (nunca presumir presencial). |
| `contract_type` | "CLT", "efetivo", "PJ", "contractor", "estágio", "trainee", "temporário", "freelance". Ausente → `null`. |
| `seniority` | "júnior/jr/I", "pleno/mid/II", "sênior/sr/III", "especialista", "líder/lead", "estagiário". Deriva do título **e** da descrição; conflito ⇒ `null`. |
| `city`/`state`/`country` | dicionário de localidades BR (capitais + regiões metropolitanas) + siglas de UF; "São Paulo - SP", "SP", "Sao Paulo/SP" → `{city:'São Paulo', state:'SP', country:'BR'}`; "Brasil (remoto)" → `{country:'BR', remote:true}`. |
| `salary_min/max` | extrai de texto ("R$ 4.500 a R$ 6.000", "até 8k", "6000/mês"); normaliza período; **marca `salary_is_estimated=true` quando houve inferência** (RN-005); faixa inválida (min > max) ⇒ descarta ambos e registra. |
| `skills` | extração determinística por dicionário `skills.aliases` com limites de palavra; grava em `job_skills`. Sem IA (RNF-COST-03). |

## 8. Agendamento

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/collect-jobs",       "schedule": "0 9 * * *" },
    { "path": "/api/cron/close-stale-jobs",   "schedule": "30 9 * * *" },
    { "path": "/api/cron/recalc-scores",      "schedule": "0 10 * * *" },
    { "path": "/api/cron/refresh-recruiters", "schedule": "15 10 * * *" },
    { "path": "/api/cron/daily-digest",       "schedule": "0 11 * * *" },
    { "path": "/api/cron/compute-insights",   "schedule": "0 4 * * 1" },
    { "path": "/api/cron/retention",          "schedule": "30 4 * * 0" }
  ]
}
```

Horários em UTC. No plano Hobby apenas **uma** entrada diária é garantida: nesse caso,
`/api/cron/collect-jobs` executa um *pipeline* que chama as demais etapas em sequência, dentro do
mesmo orçamento de tempo, e o restante da fila fica para a execução seguinte ou para o disparo
manual. A implementação deve expor cada etapa como função (`runCollect()`, `runCloseStale()`, …)
e as rotas como invólucros finos, exatamente para permitir essa composição.

## 9. Histórico e ciclo de vida da vaga

```
     coleta            coleta            ausente 3x
first_seen_at ──► last_seen_at ──► ... ──► is_active=false, closed_at
      │                                         │
      └── published_at (imutável) ──────────────┘
```

- `jobs` nunca é apagada por rotina de retenção (é o histórico do usuário).
- `job_raw_payloads` tem retenção de 90 dias (é volumosa e serve a depuração).
- Vaga encerrada continua acessível por URL direta, em candidaturas e em estatísticas do período
  em que esteve ativa.

## 10. Limites conhecidos e como o sistema se comporta

| Limite | Comportamento especificado |
|---|---|
| Fonte sem data de publicação | vaga entra com `confidence='unknown'`, rótulo "detectada em", componente de recência indisponível. Não se descarta a vaga. |
| Fonte sem busca por palavra-chave | o adaptador traz o board inteiro (respeitando `limit`) e o núcleo filtra localmente; `meta.serverFilteredBy` fica vazio. |
| Fonte paginada com muitos itens | `limit` por execução + `nextCursor` persistido na fila; a execução seguinte continua. |
| Fonte fora do ar | `SourceError('network')` → retry → falha registrada; 5 falhas consecutivas ⇒ `status='degraded'` + notificação. |
| Fonte muda o HTML/JSON | `SourceError('parse')` com amostra do payload em `collector_runs.error_message` (truncada, sem dado pessoal); teste de fixture do adaptador passa a falhar no CI quando a fixture é atualizada. |
| Rate limit da fonte | `429` ⇒ respeita `Retry-After`, reagenda o lote, não insiste. |
| Vaga duplicada em 4 fontes | uma canônica exibida, três em `job_duplicates`, todas as URLs disponíveis. |
| Nenhuma fonte disponível | o sistema funciona: cadastro manual de vaga (RF-RAD-15) e importação de alerta de e-mail (adaptador `email_alert`, Fase 5) mantêm o produto útil. |
