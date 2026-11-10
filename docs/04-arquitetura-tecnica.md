# 04 — Arquitetura Técnica

## 1. Visão em camadas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR (desktop prioritário)                                            │
│  React 19 Server Components + Client Components  ·  Tailwind + shadcn/ui     │
└───────────────▲──────────────────────────────┬──────────────────────────────┘
                │ HTML/RSC payload              │ Server Actions / fetch
┌───────────────┴──────────────────────────────▼──────────────────────────────┐
│  NEXT.JS 15 (Vercel) — aplicação única                                      │
│                                                                             │
│  app/                     Rotas, layouts, Server Components (leitura)       │
│  app/api/                 Route Handlers (cron, webhooks, operações longas) │
│  features/<dominio>/      Regra de negócio por domínio (actions, queries)   │
│  lib/                     Infra: db, radar, scoring, ai, linkedin, i18n     │
│                                                                             │
│  Middleware: refresh de sessão + proteção de rotas                          │
└───┬─────────────────┬───────────────────┬──────────────────┬────────────────┘
    │ postgres-js     │ storage           │ https            │ https
    │ (RLS, JWT user) │ (URL assinada)    │                  │
┌───▼─────────────────▼───────────────────┐  ┌───────────────▼────────────────┐
│  SUPABASE                               │  │  SERVIÇOS EXTERNOS             │
│  · PostgreSQL 15 (+ pg_trgm, unaccent)  │  │  · API de IA (Claude)          │
│  · Auth (JWT, e-mail/senha, magic link) │  │  · Fontes de vagas (adapters)  │
│  · Storage (buckets privados)           │  │    APIs oficiais, feeds RSS,   │
│  · RLS = autorização                    │  │    sitemaps permitidos         │
└─────────────────────────────────────────┘  │  · SMTP (e-mail transacional)  │
                                             └────────────────────────────────┘
          ▲
          │ Authorization: Bearer CRON_SECRET
┌─────────┴───────────────────────────────────────────────────────────────────┐
│  VERCEL CRON  →  POST /api/cron/collect-jobs | refresh-recruiters |         │
│                  recalc-scores | digest | retention                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Princípio de fluxo:** o navegador nunca fala com fonte de vagas, com a API de IA ou com o banco
usando chave privilegiada. Tudo passa pelo servidor Next.

## 2. Componentes: vantagens e limitações

### 2.1 Next.js 15 (App Router)

| Vantagens | Limitações / mitigação |
|---|---|
| Server Components eliminam a maior parte do código de fetch e mantêm segredos no servidor. | Modelo mental mais complexo (server vs. client). **Mitigação:** regra fixa — `use client` só em componente com estado/evento; dados sempre descem por props. |
| Server Actions dão mutação tipada sem construir API REST. | Server Action não serve para operação longa. **Mitigação:** operações > 10 s (coleta, auditoria) vão para Route Handler + registro de status no banco, consultado por polling. |
| Streaming/Suspense permitem dashboard que carrega por partes. | Cache do App Router é sutil e causa dado velho. **Mitigação:** leituras de dado pessoal com `export const dynamic = 'force-dynamic'` ou `revalidateTag` explícito após mutação; proibido cachear por tempo dado de usuário. |
| Deploy, preview por branch e cron na mesma plataforma. | Limites serverless: 60 s (Hobby) / 300 s (Pro) e cron 1x/dia no Hobby. **Mitigação:** ADR-003 (lotes + fila). |
| Um repositório, um deploy, tipos compartilhados ponta a ponta. | Acoplamento à Vercel para cron. **Mitigação:** as rotas de cron são HTTP comuns; qualquer agendador externo (GitHub Actions, cron-job.org, Supabase pg_cron) as chama com o mesmo segredo. |

### 2.2 TypeScript (strict)

| Vantagens | Limitações / mitigação |
|---|---|
| Contratos de adaptador, de score e de saída de IA verificados em compilação. | Não valida dado externo em runtime. **Mitigação:** Zod na borda — toda resposta de fonte externa e toda saída de IA é parseada, nunca apenas "tipada". |
| Tipos do banco gerados eliminam divergência schema/código. | Regeneração precisa ser lembrada. **Mitigação:** script `npm run db:types` executado no `postmigrate` e verificado no CI (diff vazio). |

### 2.3 Tailwind CSS + shadcn/ui

| Vantagens | Limitações / mitigação |
|---|---|
| Tokens de design em um só lugar; dark mode por variável CSS. | HTML verboso. **Mitigação:** componentes de domínio (`JobCard`, `ScoreBadge`) encapsulam as classes; `cn()` para composição. |
| shadcn/ui é código copiado, não dependência opaca: dá para adaptar tudo. | Atualização é manual. Aceito — o ganho de controle vale mais aqui. |
| Acessibilidade de base vem do Radix (foco, teclado, ARIA). | Componentes complexos (Kanban) não existem prontos. **Mitigação:** `@dnd-kit` para arrastar e soltar, com alternativa por teclado. |

### 2.4 Supabase — PostgreSQL

| Vantagens | Limitações / mitigação |
|---|---|
| Relacional é o ajuste natural: o domínio é cheio de relações (vaga↔empresa↔recrutador↔candidatura). | Nada relevante para esta escala. |
| `jsonb` para o que é genuinamente variável (payload bruto da fonte, decomposição de score, snapshot de perfil) sem abrir mão de schema no resto. | `jsonb` tenta virar "schema preguiçoso". **Mitigação:** regra — `jsonb` apenas para payload bruto, decomposições e snapshots; nunca para dado consultado por filtro de lista. |
| `pg_trgm` resolve similaridade de título (dedupe) sem serviço de busca. | Busca textual em português exige configuração. **Mitigação:** `unaccent` + dicionário `portuguese` em índice GIN de `tsvector`. |
| Fila com `FOR UPDATE SKIP LOCKED` evita broker externo. | Não substitui fila dedicada em alta escala. Aceito (ADR-010). |

### 2.5 Supabase Auth

| Vantagens | Limitações / mitigação |
|---|---|
| `auth.uid()` disponível dentro do Postgres é o que torna a RLS possível — este é o motivo central da escolha. | Customização de fluxo limitada. Irrelevante aqui. |
| E-mail/senha, magic link e OAuth sem código próprio de credenciais. | Templates de e-mail precisam ser traduzidos manualmente. **Mitigação:** tarefa explícita da Fase 1 (RNF-UX-01). |
| Refresh de token tratado pelo helper `@supabase/ssr` no middleware. | Cookies em Server Components exigem cuidado. **Mitigação:** três factories fixas em `lib/db/` (server, client, service) e nenhuma criação de cliente fora delas. |

### 2.6 Supabase Storage

| Vantagens | Limitações / mitigação |
|---|---|
| Buckets privados com políticas baseadas no mesmo `auth.uid()`. | Não processa arquivo (não extrai texto de PDF). **Mitigação:** extração no servidor Next com `pdf-parse`/`unpdf` no momento do upload. |
| URL assinada de curta duração evita servir arquivo pela aplicação. | URL assinada vazada dá acesso até expirar. **Mitigação:** validade de 5 min, gerada só quando o usuário pede o arquivo. |
| Convenção de caminho `userId/kind/uuid.ext` torna a política trivial e auditável. | — |

### 2.7 API de inteligência artificial

| Vantagens | Limitações / mitigação |
|---|---|
| Resolve o que é inviável por heurística: avaliar clareza de um texto "Sobre", reescrever headline, gerar perguntas de entrevista. | Custo variável. **Mitigação:** teto mensal, cache por hash, modelo por tarefa, limite de tokens (RN-070 a RN-074). |
| Saída estruturada permite tratar a IA como função tipada. | Pode inventar. **Mitigação:** documento 20 — contrato de prompt, validação Zod e validador anti-invenção que compara a saída com a entrada. |
| Latência alta é tolerável em operação assíncrona. | Indisponibilidade do provedor. **Mitigação:** RNF-RES-03; a fila de auditoria reprocessa. |
| **Decisão:** não se usa IA na coleta de vagas (classificação por regra determinística), o que mantém o custo recorrente próximo de zero. | — |

### 2.8 Agendadores e workers

| Vantagens | Limitações / mitigação |
|---|---|
| Vercel Cron é configuração declarativa em `vercel.json`, sem infraestrutura. | Hobby: 1 execução diária por cron e sem garantia de horário exato. **Mitigação:** uma execução diária satisfaz o requisito de "últimas 24h"; coleta manual cobre o resto; no Pro, a frequência sobe sem mudança de código. |
| Fila no banco dá retentativa, visibilidade e idempotência de graça. | Sem *dead letter queue* nativa. **Mitigação:** `attempts` + `last_error` na própria linha; `attempts >= 5` move para `status='dead'` e notifica. |

### 2.9 Bibliotecas adicionais permitidas (lista fechada)

Nada fora desta lista deve ser adicionado sem justificativa escrita no documento 00.

| Pacote | Uso | Por que não dá para fazer sem |
|---|---|---|
| `zod` | validação de borda e saída de IA | contrato em runtime |
| `@supabase/supabase-js`, `@supabase/ssr` | acesso e sessão | cliente oficial |
| `next-themes` | dark/light com persistência | evita flash de tema |
| `@dnd-kit/core`, `@dnd-kit/sortable` | Kanban | arrastar e soltar acessível |
| `recharts` | gráficos | gráficos React declarativos, leves |
| `date-fns` + `date-fns-tz` | datas e fusos | `Intl` não cobre aritmética de datas |
| `fast-xml-parser` | feeds RSS/Atom e sitemaps | parse de XML |
| `cheerio` | extração de metadados (JSON-LD) de páginas permitidas | parse de HTML no servidor |
| `unpdf` ou `pdf-parse` | extração de texto de PDF (LinkedIn, currículo) | leitura de PDF |
| `react-hook-form` | formulários longos (perfil, proposta) | performance e validação com Zod |
| `sonner` | notificações de interface | padrão do shadcn |
| `@anthropic-ai/sdk` | chamadas de IA | SDK oficial |
| `nanoid` | identificadores curtos de correlação | — |
| `vitest`, `@playwright/test` | testes | — |

**Proibidos nas Fases 1–5:** ORM (Prisma/Drizzle — a tipagem gerada do Supabase já resolve e o
ORM conflita com RLS e com SQL de dedupe), biblioteca de estado global (Zustand/Redux — Server
Components cobrem), tRPC, GraphQL, Redis, Docker em produção, qualquer serviço de scraping
terceirizado, qualquer biblioteca de "automação de LinkedIn".

## 3. Fluxo de autenticação e autorização

```
Requisição → middleware.ts
  ├─ cria cliente Supabase SSR a partir dos cookies
  ├─ chama getUser() (revalida o JWT, renova o refresh token)
  ├─ rota pública (/login, /cadastro, /recuperar) + sessão válida → redireciona para /painel
  ├─ rota protegida (/(app)/**) sem sessão → redireciona para /login?next=<rota>
  └─ segue, com cookies de sessão atualizados na resposta
```

Três clientes de banco, e somente três:

| Factory | Onde roda | Chave | Autorização |
|---|---|---|---|
| `lib/db/server.ts` → `createServerClient()` | Server Components, Server Actions, Route Handlers com usuário | `anon` + JWT do usuário | **RLS do usuário** |
| `lib/db/client.ts` → `createBrowserClient()` | Client Components (realtime, upload direto) | `anon` + JWT | **RLS do usuário** |
| `lib/db/service.ts` → `createServiceClient()` | **somente** rotas de cron e coletores | `service_role` | ignora RLS |

`lib/db/service.ts` começa com `import 'server-only'` e é importado exclusivamente por arquivos
sob `app/api/cron/` e `lib/radar/`. Regra de lint impede qualquer outro import.

## 4. Organização do código por domínio

Cada domínio em `features/` segue a mesma forma, para que a IA implementadora não invente
estrutura:

```
features/job-radar/
  actions.ts        'use server' — mutações (descartar, salvar, enviar ao Kanban)
  queries.ts        leituras tipadas usadas por Server Components
  schemas.ts        Zod de entrada e saída
  types.ts          tipos de domínio derivados dos schemas
  components/       componentes específicos do domínio
  README.md         entradas, saídas, invariantes e regras aplicáveis (RN-0xx)
```

Regras de dependência (verificadas por ESLint):
- `lib/**` não importa de `features/**` nem de `app/**`.
- `features/<a>` não importa de `features/<b>`; o que é comum sobe para `lib/`.
- `app/**` importa de `features/**` e `lib/**`, nunca o contrário.

## 5. Estratégia de dados (leitura e mutação)

**Leitura.** Server Component chama `features/<dominio>/queries.ts`, que usa o cliente de servidor
e devolve tipo de domínio, não linha crua. Toda listagem é paginada por cursor
(`(score desc, id desc)` ou `(published_at desc, id desc)`), nunca por `OFFSET` grande.

**Mutação.** Server Action valida com Zod → executa → chama `revalidateTag` do domínio afetado.
Mutação em lista com interação direta (Kanban) usa `useOptimistic` e reverte em erro.

**Operação longa.** `POST /api/<op>` cria linha de status (`collector_runs`, `ai_runs`,
`linkedin_audits.status`), responde `202` com o id, e a interface faz polling de
`GET /api/<op>/<id>` a cada 2 s, com limite de 90 tentativas.

## 6. Pipeline do Job Radar (resumo; detalhe no documento 06)

```
cron diário
  → enfileira (search_profile × source) ativos em collector_queue
  → por lote (limite de tempo e de taxa):
       adapter.fetch(query)      → RawJob[]          (sem IA, sem heurística de negócio)
       normalize(RawJob)         → NormalizedJob     (puro, testável)
       resolveDate(NormalizedJob)→ data + origem + confiança     [RN-002]
       applyFilters(perfil)      → mantém/descarta                [RN-016, RN-026]
       upsertCompany / upsertJob → identidade na fonte            [RN-021]
       detectDuplicates          → job_duplicates                 [RN-021, RN-022]
       linkRecruiter             → recruiter_activities           [RN-043]
       calculateOpportunityScore → job_matches + breakdown        [RN-030..RN-035]
       notifyIfAboveThreshold    → notifications (resumo diário)  [RF-NOT-03]
  → fecha collector_runs com contadores
```

## 7. Tratamento de erros

| Camada | Comportamento |
|---|---|
| Adaptador | lança `SourceError` com `kind` (`network`, `rate_limited`, `parse`, `auth`, `blocked`, `not_allowed`); o núcleo decide retry versus marcar fonte como degradada. |
| Núcleo do coletor | isola por lote; erro de um lote não aborta os outros; registra em `collector_runs`. |
| Server Action | retorna `{ ok: false, error: { code, message_ptbr, field? } }`; nunca lança para o cliente. |
| Route Handler | status HTTP correto + corpo `{ error: { code, message } }` + `request_id`. |
| Interface | `error.tsx` por segmento de rota, com ação de nova tentativa; nunca tela branca. |
| IA | falha de validação → 1 retentativa → erro registrado e mensagem ao usuário. |

## 8. Pontos de troca previstos (para não travar o futuro)

| Hoje | Trocável por | Como |
|---|---|---|
| Fila em Postgres | QStash / Upstash | `lib/queue/index.ts` expõe `enqueue`/`claim`/`complete`; só a implementação muda. |
| Vercel Cron | GitHub Actions, pg_cron | as rotas são HTTP com segredo; só o chamador muda. |
| Rate limit em Postgres | Upstash Ratelimit | `lib/ratelimit/index.ts` com a mesma assinatura. |
| E-mail via SMTP do Supabase | Resend/SES | `lib/mail/index.ts` com `send(template, to, vars)`. |
| Provedor de IA | outro provedor | `lib/ai/client.ts` expõe `complete<TSchema>()`; nenhuma feature conhece o SDK. |

## 9. Ambientes e variáveis

| Ambiente | Banco | Observações |
|---|---|---|
| Local | `supabase start` (Docker) | seed com fontes de vaga e dados de exemplo; IA mockada por padrão (`AI_MOCK=1`). |
| Preview | projeto Supabase de staging | cron desligado; `AI_MOCK=1` por padrão. |
| Produção | projeto Supabase de produção | cron ligado; migrations aplicadas manualmente por comando. |

Variáveis em [`.env.example`](../.env.example). Somente `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` são expostas ao cliente.

## 10. Qualidade e CI

```
push → lint (ESLint) → typecheck (tsc --noEmit) → test:unit (vitest)
     → test:rls (vitest + supabase local) → build (next build)
     → [branch principal] deploy Vercel
```

Migrations **não** rodam no pipeline de build: `npm run db:push` é comando deliberado, executado
após revisão do diff de migration (RNF-DEP-04).
