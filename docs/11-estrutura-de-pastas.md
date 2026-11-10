# 11 — Estrutura de pastas

> Esta árvore é **normativa**. A IA implementadora não deve inventar pastas nem mover
> responsabilidades. Arquivos e pastas em inglês; texto de interface em pt-BR (RNF-MNT-08).

## 1. Raiz

```
careeros/
├─ app/                      rotas, layouts e Server Components
├─ features/                 regra de negócio por domínio
├─ lib/                      infraestrutura e regras puras
├─ components/               componentes de interface reutilizáveis (sem domínio)
├─ supabase/                 migrations, seeds, config do CLI
├─ docs/                     esta especificação
├─ tests/                    testes de RLS, e2e e fixtures compartilhadas
├─ public/                   estáticos
├─ middleware.ts             sessão + proteção de rotas
├─ vercel.json               definição dos crons
├─ .env.example
├─ eslint.config.mjs         inclui as regras de dependência entre camadas
├─ tailwind.config.ts
├─ tsconfig.json             strict, paths "@/*"
└─ package.json
```

## 2. `app/` — rotas

```
app/
├─ layout.tsx                 html/lang="pt-BR", ThemeProvider (dark padrão), Toaster
├─ globals.css                tokens de cor (documento 15 §2)
├─ page.tsx                   redireciona: sessão → /painel, sem sessão → /login
│
├─ (auth)/                    rotas públicas
│   ├─ layout.tsx
│   ├─ login/page.tsx
│   ├─ cadastro/page.tsx
│   ├─ recuperar-senha/page.tsx
│   └─ nova-senha/page.tsx
│
├─ (app)/                     rotas protegidas (middleware exige sessão)
│   ├─ layout.tsx             shell: sidebar + topbar + PIN lock + indicador de modo discreto
│   ├─ painel/page.tsx                        Dashboard
│   ├─ radar/
│   │   ├─ page.tsx                           lista de vagas
│   │   ├─ [jobId]/page.tsx                   detalhe da vaga + decomposição do score
│   │   ├─ perfis/page.tsx                    perfis de busca
│   │   ├─ perfis/[profileId]/page.tsx        edição de filtros
│   │   ├─ execucoes/page.tsx                 painel de execuções e erros
│   │   └─ nova-vaga/page.tsx                 cadastro manual (RF-RAD-15)
│   ├─ candidaturas/
│   │   ├─ page.tsx                           Kanban
│   │   ├─ [applicationId]/page.tsx           detalhe + linha do tempo
│   │   └─ metricas/page.tsx                  funil e conversão
│   ├─ linkedin/
│   │   ├─ page.tsx                           histórico de auditorias + evolução
│   │   ├─ nova/page.tsx                      escolha de entrada + revisão do snapshot
│   │   ├─ [auditId]/page.tsx                 relatório
│   │   └─ [auditId]/comparar/page.tsx        original versus otimizado / entre auditorias
│   ├─ assistente/
│   │   ├─ page.tsx                           threads
│   │   └─ [threadId]/page.tsx
│   ├─ recrutadores/
│   │   ├─ page.tsx
│   │   ├─ [recruiterId]/page.tsx             linha do tempo unificada + evidências
│   │   └─ empresas/
│   │       ├─ page.tsx
│   │       └─ [companyId]/page.tsx
│   ├─ mercado/page.tsx                       Career Intelligence
│   ├─ propostas/
│   │   ├─ page.tsx                           lista
│   │   ├─ nova/page.tsx
│   │   └─ comparar/page.tsx                  comparação lado a lado
│   ├─ evolucao/
│   │   ├─ page.tsx                           competências, lacunas, metas
│   │   └─ planos/[planId]/page.tsx
│   ├─ biblioteca/page.tsx
│   ├─ perfil/
│   │   ├─ page.tsx                           perfis profissionais
│   │   ├─ experiencias/page.tsx
│   │   └─ emprego-atual/page.tsx             dado sensível
│   ├─ notificacoes/page.tsx
│   └─ configuracoes/
│       ├─ page.tsx                           conta
│       ├─ aparencia/page.tsx
│       ├─ fontes/page.tsx                    status legal de cada fonte (RF-CFG-07)
│       ├─ ia/page.tsx                        teto e consumo
│       ├─ regras/page.tsx                    janela, score mínimo, estagnação, pesos
│       ├─ notificacoes/page.tsx
│       ├─ privacidade/page.tsx               modo discreto, vetadas, PIN, logs, retenção
│       ├─ credenciais/page.tsx               chaves do próprio usuário
│       └─ diagnostico/page.tsx
│
└─ api/
    ├─ cron/
    │   ├─ collect-jobs/route.ts
    │   ├─ close-stale-jobs/route.ts
    │   ├─ recalc-scores/route.ts
    │   ├─ refresh-recruiters/route.ts
    │   ├─ daily-digest/route.ts
    │   ├─ compute-insights/route.ts
    │   └─ retention/route.ts
    ├─ radar/
    │   ├─ collect/route.ts                   coleta manual (202 + runId)
    │   └─ runs/[runId]/route.ts              polling de status
    ├─ linkedin/
    │   ├─ ingest/route.ts                    URL, texto, PDF → snapshot
    │   └─ audits/
    │       ├─ route.ts                       POST → 202 { auditId }
    │       └─ [auditId]/route.ts             GET status/resultado
    ├─ ai/[feature]/route.ts                  operações longas de IA
    ├─ documents/
    │   ├─ upload-url/route.ts                URL assinada de upload
    │   └─ [documentId]/signed-url/route.ts   URL assinada de leitura (5 min)
    ├─ export/route.ts                        portabilidade LGPD (RF-AUT-07)
    └─ account/delete/route.ts                exclusão de conta (RF-AUT-06)
```

Regras de rota:
- rota pública nova entra **somente** em `(auth)`; qualquer outra pasta é protegida por
  `middleware.ts` (RF-DIS-06);
- Server Component por padrão; `'use client'` só em componente com estado ou evento;
- toda leitura de dado pessoal declara `export const dynamic = 'force-dynamic'` ou usa
  `revalidateTag` explícito (documento 04 §2.1).

## 3. `features/` — um domínio por pasta, forma fixa

```
features/
├─ auth/
├─ career-profile/
├─ search-profiles/
├─ dashboard/
├─ job-radar/
├─ recruiters/
├─ applications/
├─ linkedin/
├─ assistant/
├─ market-intelligence/
├─ offers/
├─ growth/
├─ library/
├─ notifications/
├─ settings/
└─ stealth/
```

Cada pasta tem exatamente esta forma (documento 04 §4):

```
features/<dominio>/
├─ actions.ts        'use server' — mutações, validadas com Zod, chamam revalidateTag
├─ queries.ts        leituras tipadas para Server Components
├─ schemas.ts        Zod de entrada e saída
├─ types.ts          tipos de domínio derivados dos schemas
├─ components/       componentes do domínio
└─ README.md         entradas, saídas, invariantes e as RN aplicáveis
```

## 4. `lib/` — infraestrutura e regra pura

```
lib/
├─ db/
│   ├─ server.ts            createServerClient() — RLS do usuário
│   ├─ client.ts            createBrowserClient()
│   ├─ service.ts           createServiceClient() — 'server-only', só cron e radar
│   └─ database.types.ts    GERADO por `npm run db:types` — não editar à mão
│
├─ radar/
│   ├─ types.ts             contrato congelado do adaptador (documento 06 §2)
│   ├─ adapters/
│   │   ├─ index.ts         registry: uma linha por fonte
│   │   ├─ greenhouse.ts
│   │   ├─ lever.ts
│   │   ├─ rss-generic.ts
│   │   ├─ jsonld-careers.ts
│   │   └─ manual.ts
│   ├─ core/
│   │   ├─ guard.ts             assertCollectable (RN-020)
│   │   ├─ planner.ts           expande (perfil × fonte) → fila
│   │   ├─ runner.ts            consome a fila dentro do orçamento de tempo
│   │   ├─ process-lot.ts       as nove etapas
│   │   ├─ normalize.ts         funções puras de normalização
│   │   ├─ published-at.ts      resolvePublishedAt (RN-002)
│   │   ├─ filters.ts           applyProfileFilters + FilterReason
│   │   ├─ dedupe.ts            fingerprint + fuzzy
│   │   ├─ persist.ts           upsertCompany/upsertJob/insertRawPayload
│   │   ├─ recruiter-link.ts    RN-043
│   │   └─ close-stale.ts       RN-023
│   ├─ dictionaries/
│   │   ├─ titles.ts
│   │   ├─ locations-br.ts
│   │   ├─ work-models.ts
│   │   ├─ contracts.ts
│   │   ├─ seniority.ts
│   │   └─ requirement-headings.ts
│   └─ http/
│       ├─ client.ts        timeout, retry com jitter, user-agent, rate limit
│       └─ robots.ts        leitura e cache de robots.txt
│
├─ scoring/
│   ├─ opportunity-score.ts     função pura (RN-032)
│   ├─ components/              recency.ts · recruiter.ts · fit.ts · quality.ts
│   ├─ explain.ts               monta a explicação por template (RN-034)
│   └─ version.ts               SCORE_VERSION
│
├─ recruiters/
│   ├─ classify.ts          classifyRecruiter (documento 07 §3)
│   ├─ update-status.ts     único lugar que escreve activity_status
│   └─ normalize.ts
│
├─ linkedin/
│   ├─ ingest/              from-url.ts · from-text.ts · from-pdf.ts · from-form.ts
│   ├─ evaluability.ts      matriz do RN-060
│   ├─ heuristics/          uma por seção
│   ├─ weights.ts           pesos do RN-062
│   ├─ section-score.ts
│   ├─ priority.ts          RN-064
│   └─ compare.ts           RN-066
│
├─ ai/
│   ├─ client.ts            complete<TSchema>() — único ponto de chamada
│   ├─ models.ts            modelo por tarefa (RN-074)
│   ├─ cost.ts              estimativa e registro em ai_runs
│   ├─ cache.ts             hash de entrada (RN-071)
│   ├─ context/             montagem de contexto por lista de permissão (RN-072)
│   ├─ prompts/             um arquivo por feature, com PROMPT_VERSION
│   ├─ schemas/             Zod de saída por feature
│   └─ validators/
│       ├─ no-fabrication.ts
│       └─ allowlist-generic.ts
│
├─ offers/
│   ├─ calculate.ts         função pura
│   └─ tax-tables.ts        versionada, com valid_from (RN-080)
│
├─ insights/
│   ├─ compute.ts           estatísticas com n e período (RN-004)
│   └─ skills-extract.ts    extração determinística por dicionário
│
├─ queue/index.ts           enqueue/claim/complete — trocável (documento 04 §8)
├─ ratelimit/index.ts
├─ mail/index.ts
├─ storage/index.ts         caminhos e URLs assinadas
├─ notifications/index.ts   criação, supressão por modo discreto, resumo diário
├─ config/rules.ts          TODAS as constantes do RN-101
├─ i18n/pt-BR.ts            todas as strings de interface
├─ format/                  date.ts · currency.ts · number.ts (Intl)
├─ validation/              schemas compartilhados
└─ utils/                   cn.ts · hash.ts · result.ts · logger.ts
```

## 5. `components/` — interface sem domínio

```
components/
├─ ui/                  shadcn/ui (copiado, adaptado aos tokens)
├─ layout/              Sidebar · Topbar · PageHeader · EmptyState · ErrorState
├─ data/                DataTable · Pagination · FilterBar · SortMenu
├─ charts/              LineChart · BarChart · Sparkline (recharts)
└─ feedback/            ScoreBadge · ConfidenceBadge · UnknownValue · Skeletons
```

`UnknownValue` e `ConfidenceBadge` não são enfeite: são a materialização do RNF-UX-07 e do
RN-001. "Não identificado" tem componente próprio, distinto de zero.

## 6. `supabase/` e `tests/`

```
supabase/
├─ config.toml
├─ migrations/
│   ├─ 0001_extensions_and_types.sql    extensões, enums, helpers de RLS
│   ├─ 0002_identity.sql
│   ├─ 0003_catalog_base.sql            companies · skills · job_sources
│   ├─ 0004_documents.sql
│   ├─ 0005_career_profile.sql
│   ├─ 0006_search_profiles.sql
│   ├─ 0007_jobs.sql
│   ├─ 0008_recruiters.sql
│   ├─ 0009_collector.sql
│   ├─ 0010_applications.sql
│   ├─ 0011_ai.sql
│   ├─ 0012_linkedin.sql
│   ├─ 0013_resumes.sql
│   ├─ 0014_intelligence_growth.sql
│   ├─ 0015_offers.sql
│   ├─ 0016_notifications_system.sql
│   ├─ 0017_bootstrap_and_maintenance.sql
│   ├─ 0018_storage.sql
│   └─ 0019_seed.sql
└─ seed.sql                              dados de desenvolvimento (não vão para produção)

tests/
├─ rls/                 um arquivo por tabela pessoal (RNF-TST-03)
├─ e2e/                 Playwright: login, perfil de busca, coleta, kanban, auditoria
├─ fixtures/
│   ├─ adapters/        respostas reais salvas por fonte (RNF-TST-02)
│   ├─ linkedin/        PDFs e textos de perfil
│   └─ jobs/            descrições para teste de extração de competências
└─ helpers/             clientes autenticados como A e como B
```

Testes unitários ficam ao lado do código (`*.test.ts`), porque a proximidade aumenta a chance de
serem mantidos.

## 7. Regras de dependência (verificadas por ESLint)

```
app/       →  features/, lib/, components/
features/  →  lib/, components/            (nunca outra feature)
lib/       →  lib/                         (nunca features/, nunca app/)
components/→  lib/utils, lib/i18n, lib/format
```

```js
// eslint.config.mjs (trecho normativo)
'import/no-restricted-paths': ['error', { zones: [
  { target: './lib',        from: './features', message: 'lib não pode depender de features' },
  { target: './lib',        from: './app',      message: 'lib não pode depender de app' },
  { target: './features',   from: './app',      message: 'features não pode depender de app' },
  { target: './components', from: './features', message: 'components é agnóstico de domínio' },
]}],
'no-restricted-imports': ['error', { patterns: [
  { group: ['**/lib/db/service'], message: 'service_role só em app/api/cron/** e lib/radar/**' },
]}],
```

A exceção para `lib/db/service` é configurada por override nas duas pastas autorizadas.

## 8. Scripts de `package.json`

| Script | Comando | Finalidade |
|---|---|---|
| `dev` | `next dev` | desenvolvimento |
| `build` | `next build` | build de produção |
| `lint` | `eslint .` | camadas e estilo |
| `typecheck` | `tsc --noEmit` | tipos |
| `test:unit` | `vitest run` | funções puras |
| `test:rls` | `vitest run tests/rls` | isolamento entre usuários |
| `test:e2e` | `playwright test` | fluxos críticos |
| `db:start` | `supabase start` | banco local |
| `db:push` | `supabase db push` | aplica migrations (deliberado, RNF-DEP-04) |
| `db:reset` | `supabase db reset` | recria o banco local com seed |
| `db:types` | `supabase gen types typescript --local > lib/db/database.types.ts` | tipos gerados |
| `score:recalc` | `tsx scripts/recalc-scores.ts` | recálculo em lote (RF-SCR-06) |
