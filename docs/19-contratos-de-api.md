# 19 — Contratos de rotas, Server Actions e jobs

> Contrato é o que a IA implementadora não precisa inventar. Toda entrada é validada com Zod;
> toda saída tem forma fixa. Nenhuma rota recebe `userId` do cliente: o usuário vem da sessão.
> As Server Actions vivem em `features/<dominio>/actions.ts` (documento 11 §3), sempre com
> `'use server'` no topo do arquivo.

## 1. Convenções

### Resultado de Server Action

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; field?: string } };
```

`message` já vem em pt-BR, pronto para exibição. Server Action **nunca** lança para o cliente
(documento 04 §7); erro inesperado é registrado e devolvido como `INTERNAL` com `request_id`.

### Erros HTTP

```ts
type ErrorBody = { error: { code: ErrorCode; message: string }; request_id: string };
```

| Código | HTTP | Quando |
|---|---|---|
| `UNAUTHENTICATED` | 401 | sem sessão |
| `FORBIDDEN` | 403 | recurso de outro usuário (na prática a RLS devolve vazio) |
| `VALIDATION_FAILED` | 400 | Zod falhou (`field` indica o campo) |
| `NOT_FOUND` | 404 | id inexistente para este usuário |
| `RATE_LIMITED` | 429 | bucket excedido (`retryAfterSeconds` no corpo) |
| `AI_CAP_REACHED` | 403 | teto mensal de IA (RN-070) |
| `SOURCE_NOT_ALLOWED` | 422 | fonte com `legal_status` não executável (RN-020) |
| `QUOTA_EXCEEDED` | 413 | cota de Storage ou tamanho de arquivo |
| `AI_OUTPUT_REJECTED` | 422 | saída de IA reprovada pelo validador (RN-073, documento 20 §5) |
| `PROVIDER_UNAVAILABLE` | 503 | provedor de IA ou fonte fora do ar |
| `INTERNAL` | 500 | erro não tratado (log com stack; usuário recebe `request_id`) |

### Operação longa (padrão fixo)

```
POST /api/<op>        → 202 { id }     cria linha de status e enfileira
GET  /api/<op>/<id>   → 200 { status, progress?, result?, error? }
                            status ∈ queued | running | completed | failed
```

A interface faz polling a cada 2 s, no máximo 90 tentativas (3 min), e permite sair da tela
(RNF-UX-10).

## 2. Rotas de cron

Todas exigem `Authorization: Bearer ${CRON_SECRET}`, comparado com `crypto.timingSafeEqual`.
Segredo inválido ⇒ **404** (não confirma a existência da rota).
Todas são idempotentes e registram `collector_runs`.

| Rota | Corpo | Resposta | Regras |
|---|---|---|---|
| `POST /api/cron/collect-jobs` | `{ budgetMs?, onlyUserId?, onlySourceId? }` | `{ runId, lotsProcessed, lotsRemaining, counters }` | RN-014, RN-020, RN-027, RNF-PERF-05 |
| `POST /api/cron/close-stale-jobs` | — | `{ closed }` | RN-023 (fonte que falhou não conta como ausência) |
| `POST /api/cron/recalc-scores` | `{ scoreVersion?, limit? }` | `{ recalculated, changed }` | RN-024, RN-033 |
| `POST /api/cron/refresh-recruiters` | — | `{ reviewed, changed }` | RN-044 |
| `POST /api/cron/daily-digest` | — | `{ digestsSent, suppressed }` | RF-NOT-03, RN-092 |
| `POST /api/cron/compute-insights` | `{ periods? }` | `{ insightsWritten, skippedForSmallSample }` | RN-004 |
| `POST /api/cron/retention` | — | `{ deleted: { job_raw_payloads, collector_runs, ai_runs, audit_logs, notifications } }` | documento 10 §19 |

Cada rota é invólucro fino sobre uma função exportada (`runCollect()`, `runCloseStale()`,
`runRecalcScores()`, …), para permitir a composição em um único cron no plano Hobby
(documento 06 §8).

## 3. Job Radar

### `POST /api/radar/collect`

```ts
// entrada
z.object({
  searchProfileId: z.string().uuid(),
  sourceIds: z.array(z.string().uuid()).optional(),
});
// 202
{ runId: string, lotsQueued: number, skipped: Array<{ sourceId: string; reason: string }> }
```

Regras: `check_rate_limit(user, 'manual_collect', user_limits.manual_runs_per_hour, 3600)`
(RN-028); o perfil precisa ser do usuário e estar ativo; fonte não executável é ignorada e
**relatada** em `skipped`, nunca silenciosamente (RN-020).

### `GET /api/radar/runs/:runId`

```ts
{ status: 'running'|'success'|'partial'|'failed',
  counters: { found: number; new: number; updated: number; duplicated: number;
              filtered: number; failed: number },
  filteredReasons: Record<FilterReason, number>,
  sources: Array<{ sourceId: string; slug: string; status: string; error?: string }>,
  durationMs: number | null }
```

`filteredReasons` é o que explica ao usuário por que a coleta trouxe 3 vagas em vez de 80
(documento 06 §4.4).

### Actions de `features/job-radar/actions.ts`

| Action | Entrada | Efeito | Regras |
|---|---|---|---|
| `saveJob` | `{ matchId }` | `status='saved'` | — |
| `dismissJob` | `{ matchId, reason }` | `status='dismissed'`, `dismissed_at=now()` | RN-025 — não reaparece naquele perfil |
| `markSeen` | `{ matchId }` | `new → seen` | não altera `matched_at` |
| `sendToKanban` | `{ matchId }` | cria `applications` copiando título, empresa, URL e salário | RN-050, RN-053 |
| `createManualJob` | título, empresa, URL, local, modalidade, contrato, salário, data | cria `companies` + `jobs` (fonte `manual`) + `job_matches` | data informada ⇒ `confidence='exact'`; ausente ⇒ `'unknown'` (RN-002) |
| `closeJobManually` | `{ jobId }` | `is_active=false`, `closed_at=now()` | registra que o encerramento foi manual |
| `undoDuplicate` | `{ duplicateId }` | remove a marcação de duplicata | RN-022 — nada é destrutivo |

### Actions de `features/search-profiles/actions.ts`

| Action | Regras |
|---|---|
| `createSearchProfile` / `updateSearchProfile` | `recency_hours ∈ {24,72,168,360}` (RN-017); pesos somam 100 (RN-031); limite de ativos (RN-015); ao menos uma fonte habilitada |
| `toggleSearchProfile` | ativar respeita o limite e devolve erro explicativo ao estourar |
| `duplicateSearchProfile` | copia filtros e fontes; nome + " (cópia)"; nasce inativo |
| `deleteSearchProfile` | preserva o histórico de `job_matches` (RF-BSC-05) |

## 4. LinkedIn

### `POST /api/linkedin/ingest`

```ts
z.discriminatedUnion('method', [
  z.object({ method: z.literal('public_url'),  url: z.string().url() }),
  z.object({ method: z.literal('pasted_text'), text: z.string().min(200).max(60000) }),
  z.object({ method: z.literal('pdf_export'),  documentId: z.string().uuid() }),
  z.object({ method: z.literal('manual_form'), form: ProfileFormSchema }),
]);
```

```ts
// 200
{ snapshot: ProfileSnapshot,
  coverage: SectionCoverage[],
  attempt?: { ok: false;
              reason: 'login_wall'|'blocked'|'not_found'|'partial'|'network'|'not_allowed' } }
```

`attempt.ok === false` **não é erro HTTP**: responde 200, informa o ocorrido e oferece as outras
três entradas (RN-061). Rate limit: bucket `linkedin_url_fetch`, 5/h.

### `POST /api/linkedin/profile-versions`

```ts
z.object({ snapshot: ProfileSnapshotSchema, inputMethod: z.enum([...]), documentId: z.string().uuid().optional() })
// 201 { profileVersionId }
```

Grava o snapshot **revisado pelo usuário**, com `reviewed_at = now()`. Sem esta chamada não existe
auditoria (documento 09 §6).

### `POST /api/linkedin/audits`

```ts
z.object({ profileVersionId: z.string().uuid(), searchProfileId: z.string().uuid().optional() })
// 202 { auditId }
// 403 { error: { code: 'AI_CAP_REACHED' }, currentUsd, capUsd, cycleRestartsOn }
```

### `GET /api/linkedin/audits/:auditId`

```ts
{ status: 'queued'|'running'|'completed'|'failed',
  overallScore: number | null,
  profileCoverage: number | null,
  sections: Array<{ sectionKey: string; status: 'evaluated'|'not_evaluable';
                    weight: number; score0to10: number | null; rationale: string | null }>,
  findings: Array<{ id: string; sectionKey: string; issue: string; impact: string;
                    howToFix: string; exampleText: string; severity: string;
                    priority: number; hasPlaceholder: boolean; status: string }>,
  notEvaluable: Array<{ sectionKey: string; why: string; howToProvide: string }>,
  ai: { model: string; promptVersion: string; createdAt: string; cached: boolean } | null,
  error?: { code: string; message: string } }
```

### Actions de `features/linkedin/actions.ts`

| Action | Regras |
|---|---|
| `setFindingStatus({ findingId, status })` | único campo mutável de um achado (RN-066); grava `status_changed_at` |
| `deleteAudit({ auditId })` | remove auditoria, seções, achados **e o PDF no Storage** (RF-LKD-14) |
| `compareAudits({ auditIdA, auditIdB })` | usa só seções avaliadas em ambas e declara a mudança de base |

## 5. IA

### `POST /api/ai/:feature`

`feature ∈ job_analysis | resume_tailor | cover_letter | recruiter_message | interview_sim |
interview_feedback | ats_check | profile_import`

```ts
// entrada comum
z.object({
  entity: z.object({ type: z.enum(['job','application','resume','interview']), id: z.string().uuid() }),
  options: z.record(z.unknown()).optional(),   // tom, limite de caracteres, idioma
  confirmCostUsd: z.number().optional(),       // obrigatório quando a estimativa > 0,10
});
// 202 { runId }
// 403 AI_CAP_REACHED
```

### `GET /api/ai/runs/:runId`

```ts
{ status: 'queued'|'running'|'completed'|'failed',
  artifact?: unknown,                 // validado pelo schema da feature (documento 20 §8)
  meta?: { model: string; promptVersion: string; cached: boolean; costUsd: number;
           contextFields: string[] },
  error?: { code: string; message: string } }
```

`meta.contextFields` lista exatamente quais campos do usuário foram enviados ao modelo
(RF-AIA-09) — é a materialização verificável do RN-072.

### `GET /api/ai/estimate?feature=...&entityId=...`

```ts
{ estimatedCostUsd: number, model: string, cycleUsedUsd: number, capUsd: number, cached: boolean }
```

Chamada antes de qualquer operação cara (RNF-COST-04). `cached: true` ⇒ custo zero.

## 6. Documentos

| Rota | Entrada | Saída | Regras |
|---|---|---|---|
| `POST /api/documents/upload-url` | `{ kind, filename, mimeType, sizeBytes }` | `{ uploadUrl, storagePath, documentId }` | valida MIME, `max_upload_mb` e cota (RF-BIB-07); caminho `{user_id}/{kind}/{uuid}.{ext}` |
| `POST /api/documents/:id/confirm` | `{ checksum }` | `{ document }` | confere magic bytes e tamanho reais; extrai texto de PDF |
| `GET /api/documents/:id/signed-url` | — | `{ url, expiresInSeconds: 300 }` | RNF-SEC-05 |
| `DELETE /api/documents/:id` | — | `{ ok: true }` | remove objeto no Storage e a linha (RF-BIB-08) |

## 7. Conta

| Rota | Regras |
|---|---|
| `GET /api/export` | JSON com todas as tabelas pessoais + metadados de documentos; **sem** `pin_hash` e `secret_ciphertext` (RNF-SEC-11) |
| `POST /api/account/delete` | exige `{ confirmation: 'EXCLUIR' }`; remove objetos do prefixo `{user_id}/` e então `auth.users` (cascata, RN-094) |
| `POST /api/account/sessions/revoke` | encerra sessões em todos os dispositivos (RF-AUT-05) |
| `POST /api/account/pin` | define/remove PIN; armazena apenas hash Argon2id (módulo 11) |

## 8. Actions das demais features (resumo normativo)

| Feature | Actions | Regras-chave |
|---|---|---|
| `applications` | `createApplication`, `updateStage`, `setNextAction`, `addNote`, `addContact`, `scheduleInterview`, `linkResume`, `linkRecruiter`, `archive`, `restore`, `exportCsv` | RN-051 a RN-056; os eventos são gerados por **trigger**, nunca pela aplicação |
| `recruiters` | `createRecruiter`, `updateRecruiter`, `addActivity`, `addContact`, `scheduleFollowUp`, `mergeRecruiters`, `deleteRecruiter` | `addActivity` exige URL **ou** trecho (RN-040) e recalcula a classificação; `mergeRecruiters` é reversível por 30 dias |
| `career-profile` | `upsertCareerProfile`, `setPrimary`, `upsertExperience`, `upsertEducation`, `upsertCertification`, `setUserSkill`, `upsertCurrentEmployment` | `upsertCurrentEmployment` sugere vetar a empresa (RN-093); dado sensível (RNF-SEC-11) |
| `offers` | `createOffer`, `updateOffer`, `setCriteriaWeights`, `scoreCriterion`, `compare`, `simulateCounterOffer`, `recordDecision` | `assumptions` e `tax_table_version` obrigatórios (RN-080); PJ exige alíquota efetiva informada |
| `growth` | `createPlan`, `addItem`, `logHours`, `completeItem`, `createGoal`, `updateGoalProgress`, `addMilestone`, `gapToPlanItem` | item sugerido pelo sistema entra sem provedor, URL ou preço (RF-GRW-07) |
| `market-intelligence` | `getSalaryStats`, `getSkillFrequency`, `getTrend`, `getGapAnalysis`, `exportCsv` | devolve `{ value, sampleSize, periodStart, periodEnd, source }` ou `{ insufficientSample: true, sampleSize }` (RN-004) |
| `notifications` | `markRead`, `markAllRead`, `updatePreferences` | respeita modo discreto em todos os canais (RN-092) |
| `settings` | `updateSettings`, `updateLimits`, `toggleSource`, `saveCredential`, `deleteCredential`, `setPin`, `clearAiCache`, `resetDefaults` | `saveCredential` cifra e devolve só os últimos 4 dígitos; **nenhum campo de senha externa** (RN-091) |
| `stealth` | `toggleStealth`, `addToBlocklist`, `removeFromBlocklist`, `toggleMask` | empresa vetada tem precedência absoluta (RN-013) |
| `dashboard` | somente leitura: `getCounters` (função `dashboard_counters`), `getTopOpportunities`, `getAgenda`, `getFunnel`, `getSourceHealth` | nenhum card exibe zero quando o dado não existe (RF-DSH-08) |

## 9. Contratos internos que não são HTTP

```ts
// lib/queue/index.ts — trocável por fila externa sem mudar o chamador (documento 04 §8)
enqueue(lot: LotInput): Promise<string>;
claim(): Promise<Lot | null>;
complete(id: string, counters: RunCounters): Promise<void>;
fail(id: string, error: Error): Promise<void>;

// lib/ratelimit/index.ts
check(userId: string, bucket: Bucket): Promise<{ allowed: boolean; retryAfterSeconds: number }>;

// lib/ai/client.ts — único ponto de chamada ao provedor (documento 20 §2)
complete<T extends z.ZodTypeAny>(args: {
  feature: AiFeature; schema: T; system: string; input: AiInput;
  promptVersion: string; maxTokens: number; userId: string;
  entity?: { type: string; id: string };
  validators?: Array<(out: z.infer<T>, input: unknown) => ValidationIssue[]>;
}): Promise<{ data: z.infer<T>; aiRunId: string; cached: boolean; costUsd: number }>;

// lib/mail/index.ts
send(template: MailTemplate, to: string, vars: Record<string, string>): Promise<void>;

// lib/notifications/index.ts
create(input: NotificationInput): Promise<{ created: boolean; suppressed: boolean; reason?: string }>;

// lib/storage/index.ts
buildPath(userId: string, kind: DocumentKind, ext: string): string;   // {user}/{kind}/{uuid}.{ext}
signedReadUrl(storagePath: string): Promise<{ url: string; expiresInSeconds: 300 }>;
```

`complete()` é o único lugar que verifica o teto de custo, consulta o cache, escolhe o modelo,
valida com Zod, roda os validadores anti-invenção e grava `ai_runs`. Nenhuma feature faz isso por
conta própria — é essa centralização que torna RN-006, RN-070 a RN-075 verificáveis.
