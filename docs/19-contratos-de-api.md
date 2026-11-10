# 19 — Contratos de API, Server Actions e jobs

> Toda rota e ação listada aqui é **normativa**: nome, método, entrada, saída e erro.
> A IA implementadora não deve inventar endpoint fora desta lista; se faltar algo, a lacuna é
> deste documento e deve ser registrada, não suprida por improviso.

## 1. Regras gerais

1. **Leitura** acontece em Server Components consultando o banco direto (com RLS). Não se cria
   rota `GET` para alimentar a própria tela.
2. **Mutação** é **Server Action** por padrão. Route Handler só quando o chamador não é a nossa
   UI: cron, webhook, download, upload assinado, exportação.
3. Toda entrada passa por **Zod** antes de qualquer uso (RNF-SEC-04).
4. Toda Server Action retorna o mesmo envelope:

```ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; field?: string; meta?: unknown } };

export type ErrorCode =
  | 'unauthorized' | 'forbidden' | 'not_found' | 'validation'
  | 'rate_limited' | 'limit_reached' | 'ai_cap_reached'
  | 'source_not_allowed' | 'conflict' | 'external_unavailable' | 'internal';
```

`message` é texto em pt-BR já pronto para exibição (vem de `lib/i18n/pt-BR.ts`). O cliente nunca
monta mensagem a partir do `code`, para não duplicar tradução.

5. Erro **nunca** devolve stack, SQL ou payload bruto. Detalhe vai para o log do servidor.
6. Toda mutação chama `revalidateTag()` das tags afetadas (lista em §6).

## 2. Server Actions por módulo

Caminho: `src/modules/<modulo>/actions.ts`. Toda função é `async` e começa com `'use server'`.

### Perfil profissional
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `createCareerProfile` | nome, cargo-alvo, áreas, senioridade, pretensão, preferências | `{ id }` | nome único por usuário |
| `updateCareerProfile` | id + campos parciais | `{ id }` | |
| `deleteCareerProfile` | id | `{}` | perfis de busca vinculados ficam com `career_profile_id = null` (RN-010) |
| `setPrimaryCareerProfile` | id | `{}` | desmarca os outros (índice parcial garante) |
| `upsertExperience` / `upsertEducation` / `upsertCertification` / `upsertProject` | id? + campos | `{ id }` | datas coerentes; `is_current` ⇔ `ended_on IS NULL` |
| `deleteExperience` (e análogas) | id | `{}` | |
| `reorderItems` | tipo, lista de ids | `{}` | atualiza `display_order` em transação |

### Perfis de busca
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `createSearchProfile` | nome, keywords[], excluded[], locations, modalidades, contratos, senioridades, salário, `recencyHours`, fontes | `{ id }` | `recencyHours ∈ {24,72,168,360}` (RN-017); `keywords` não vazio |
| `updateSearchProfile` | id + parciais | `{ id }` | |
| `toggleSearchProfile` | id, isActive | `{}` | ativar além do limite ⇒ `limit_reached` (RN-015) |
| `deleteSearchProfile` | id | `{}` | apaga `job_matches` em cascata; candidaturas permanecem |
| `setProfileSources` | id, [{sourceId, isEnabled, config}] | `{}` | fonte não permitida ⇒ `source_not_allowed` |

### Job Radar
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `runManualCollect` | `searchProfileId?` | `{ runIds[], queued }` | `check_rate_limit` 5/h ⇒ `rate_limited` com segundos (RN-028) |
| `dismissMatch` | matchId, motivo | `{}` | definitivo naquele perfil (RN-025) |
| `saveMatch` / `markMatchSeen` | matchId | `{}` | |
| `createManualJob` | url, título, empresa, + opcionais | `{ jobId, matchId }` | fonte `manual`; `published_at_source='user_input'`; data informada ⇒ `confidence='exact'`, ausente ⇒ `unknown` |
| `blockCompany` | companyId? \| padrão de nome, motivo | `{}` | remove matches existentes dessa empresa (RN-013) |
| `unblockCompany` | id | `{}` | |
| `recalculateScores` | `searchProfileId?` | `{ updated }` | enfileira; não recalcula em linha |

### Candidaturas
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `createApplication` | `jobId?` ou dados manuais, `stage?` | `{ id }` | copia dados da vaga (RN-050); duplicata ativa ⇒ `conflict` com o id existente (RN-053) |
| `moveApplicationStage` | id, novoEstágio | `{ id, stage }` | trigger grava evento; `applied` preenche `applied_at`; terminal zera ação (RN-051, RN-052) |
| `updateApplication` | id + parciais | `{ id }` | `next_action` exige `next_action_at` (RN-056) |
| `addApplicationNote` | id, texto | `{ eventId }` | insere `note_added`; **nunca** edita evento anterior (RN-054) |
| `archiveApplication` | id | `{}` | libera o índice único de `(user_id, job_id)` |
| `attachDocument` | applicationId, documentId | `{}` | grava `document_attached` |

### Recrutadores
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `createRecruiter` | nome, empresa, URL, headline | `{ id }` | URL única por usuário |
| `updateRecruiter` | id + parciais | `{ id }` | **proibido** alterar `activity_status` (derivado) |
| `logRecruiterActivity` | recruiterId, tipo, `occurredAt?`, url, trecho | `{ id }` | sem `occurredAt` ⇒ `confidence='unknown'` (RN-040); reclassifica em seguida |
| `logRecruiterContact` | recruiterId, canal, direção, data, assunto, notas, próxima ação | `{ id }` | |
| `deleteRecruiter` | id | `{}` | cascata total, sem soft delete (RN-045) |

### LinkedIn
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `startAudit` | `inputType`, payload (url \| textos \| storagePath \| formulário), `careerProfileId?` | `{ auditId, status }` | cria `draft`; dispara processamento |
| `fetchPublicProfile` | url | `{ ok, sections?, coverage?, reason? }` | falha é **resultado**, não exceção (RN-061) |
| `processAudit` | auditId | `{ status, overallScore?, coverage? }` | verificações → IA → validador → `completed` (imutável) |
| `updateRecommendationStatus` | id, status, `userEditedText?` | `{ id }` | `applied` preenche `applied_at` |
| `compareAudits` | auditIdA, auditIdB | `{ deltas, basisChanged, commonSections }` | só seções comuns; declara mudança de base (RN-066) |
| `deleteAudit` | id | `{}` | apaga o PDF no Storage explicitamente (RN-067) |

### Assistente de IA
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `analyzeJobFit` | jobId, careerProfileId | `{ analysis, aiRunId, cached }` | não altera o score (RN-034) |
| `generateTailoredResume` | resumeId, applicationId \| jobId | `{ resumeVersionId, aiRunId }` | só fatos do perfil; marcadores `[PREENCHER:]` |
| `generateCoverLetter` | applicationId, tom | `{ documentId, aiRunId }` | idem |
| `simulateInterview` | applicationId \| jobId, tipo, nº de perguntas | `{ interviewId, questions, aiRunId }` | `kind='mock'` dispensa candidatura |
| `evaluateInterviewAnswers` | interviewId, respostas | `{ assessment, aiRunId }` | avaliação é sugestão (RN-075) |
| `suggestStudyPlan` | careerGoalId \| cargo-alvo | `{ planId, items, aiRunId }` | entra como sugestão editável |

Todas estas: teto de custo ⇒ `ai_cap_reached` com consumo e data de reinício (RN-070).

### Propostas, evolução e biblioteca
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `upsertOffer` | campos da proposta + premissas | `{ id, computedTotalAnnual, computedVsCurrentPct }` | calcula e **persiste as premissas** (RN-080) |
| `setCurrentEmployment` | empresa, cargo, remuneração, benefícios | `{}` | sugere a empresa para a blocklist (RN-093) |
| `compareOffers` | ids[], pesos | `{ rows, assumptions, weightedScores }` | pesos do usuário (RN-085) |
| `upsertUserSkill` | skillId, nível, anos, `isTarget` | `{ id }` | |
| `upsertCareerGoal` / `upsertStudyPlanItem` | campos | `{ id }` | |
| `createDocumentUploadUrl` | kind, nome, mime, tamanho | `{ uploadUrl, storagePath, documentId }` | valida cota e tamanho **antes** de assinar |
| `confirmDocumentUpload` | documentId, checksum | `{ id }` | confere tipo real por *magic bytes* |
| `createDocumentDownloadUrl` | documentId | `{ url, expiresIn: 60 }` | URL assinada de 60 s |
| `deleteDocument` | id | `{}` | apaga o objeto no Storage explicitamente |

### Configurações
| Action | Entrada | Saída | Regras |
|---|---|---|---|
| `updateSettings` | parciais | `{}` | `score_weights` soma 100 (`CHECK` no banco) |
| `updateScoreWeights` | pesos | `{ recalcQueued }` | oferece recálculo, não recalcula sem confirmação |
| `addUserCredential` | sourceId, label, segredo | `{ id, last4 }` | cifra; **nunca** retorna o segredo |
| `deleteUserCredential` | id | `{}` | |
| `exportUserData` | — | `{ downloadUrl }` | JSON + CSV, URL assinada |
| `deleteAccount` | confirmação (e-mail digitado) | `{}` | Storage → `auth.users` → cascata (RN-094) |

## 3. Route Handlers

### Cron (`src/app/api/cron/*`)

Todos: `POST`, header `Authorization: Bearer ${CRON_SECRET}` comparado em tempo constante.
Sem o header ⇒ `401` + registro em `audit_logs`. Nunca aceitam sessão de usuário.

| Rota | Horário (UTC) | O que faz | Saída |
|---|---|---|---|
| `/api/cron/collect-jobs` | `0 9 * * *` | planner + runner *chunked*; no plano Hobby encadeia as demais etapas | `{ queued, processed, remaining, runs[] }` |
| `/api/cron/close-stale-jobs` | `30 9 * * *` | `miss_count ≥ 3` ⇒ encerra (RN-023) | `{ closed }` |
| `/api/cron/recalc-scores` | `0 10 * * *` | lote de 500 por `score_computed_at` | `{ updated }` |
| `/api/cron/refresh-recruiters` | `15 10 * * *` | lote de 200 por `status_computed_at` (RN-044) | `{ reclassified }` |
| `/api/cron/daily-digest` | `0 11 * * *` | resumo por usuário no fuso local | `{ sent, suppressed }` |
| `/api/cron/compute-insights` | `0 4 * * 1` | agregados com `sample_size` (RN-004) | `{ metrics }` |
| `/api/cron/retention` | `30 4 * * 0` | apaga `job_raw_payloads` > 90 d, logs > 180 d | `{ deleted }` |

Contrato comum: **idempotente**, respeita `RUN_BUDGET_MS` (45 s), registra em `collector_runs` e
devolve `200` mesmo com falha parcial — com o detalhe no corpo (falha total ⇒ `500`).

### Outros

| Rota | Método | Finalidade |
|---|---|---|
| `/auth/callback` | `GET` | troca de código OAuth/magic link |
| `/auth/sair` | `POST` | encerra sessão |
| `/api/documents/[id]/download` | `GET` | redireciona para URL assinada; valida dono |
| `/api/export` | `GET` | exportação completa (streaming) |
| `/api/health` | `GET` | `{ status, db, lastCollectAt }` — sem dado pessoal |

**Não existe** rota pública que receba vaga de fora, nem webhook de terceiro nas Fases 1–5.

## 4. Erros HTTP

| Código | Quando |
|---|---|
| 400 | validação (corpo com `field`) |
| 401 | sem sessão, ou `CRON_SECRET` inválido |
| 403 | recurso de outro usuário (normalmente a RLS devolve "não encontrado") |
| 404 | não existe ou não pertence ao usuário |
| 409 | conflito (candidatura duplicada) |
| 429 | rate limit, com `Retry-After` |
| 502 | fonte externa indisponível |
| 500 | erro interno, mensagem genérica |

## 5. Erros do coletor

```ts
export class SourceError extends Error {
  constructor(
    readonly kind: 'not_allowed' | 'auth' | 'network' | 'rate_limit' | 'parse' | 'blocked' | 'config',
    message: string,
    readonly retryable = false,
    readonly retryAfterMs?: number,
  ) { super(message); }
}
```

| `kind` | Retentável? | Efeito |
|---|---|---|
| `not_allowed` | não | lote falha sem nenhuma requisição de rede (RN-020) |
| `auth` | não | fonte exige chave do usuário |
| `config` | não | configuração inválida (ex.: board token ausente) |
| `network` | sim (3×) | backoff exponencial |
| `rate_limit` | sim | respeita `Retry-After` e reagenda |
| `parse` | não | registra amostra truncada; teste de fixture deve pegar |
| `blocked` | não | fonte `degraded`/`paused` |

## 6. Cache e invalidação

| Tag | Invalida ao |
|---|---|
| `radar:{userId}` | coletar, pontuar, descartar, bloquear empresa |
| `applications:{userId}` | criar/mover/arquivar candidatura |
| `recruiters:{userId}` | criar/atualizar/reclassificar recrutador |
| `linkedin:{userId}` | concluir auditoria, mudar status de recomendação |
| `dashboard:{userId}` | qualquer um dos acima |
| `settings:{userId}` | mudar configuração ou limites |

Leituras de Server Component usam `unstable_cache` com a tag correspondente; toda mutação chama
`revalidateTag`. **Nunca** se cacheia resposta que dependa de `auth.uid()` sem a tag por usuário.
