# 00 — Visão, Escopo e Decisões Arquiteturais

## 1. Problema

O usuário **já tem emprego**. Isso muda tudo:

1. Ele tem pouco tempo — não pode passar 2h/dia garimpando vagas em seis sites.
2. Ele não pode ser visto procurando — sinalizar busca ativa é risco real no emprego atual.
3. Ele não precisa de *qualquer* vaga; precisa de **oportunidade melhor** que a atual, o que é
   uma comparação, não uma busca.
4. Vagas antigas e recrutadores inativos são o maior desperdício de energia: candidatar-se a uma
   vaga de 40 dias com 900 candidatos é tempo jogado fora.

O CareerOS resolve isso sendo um **sistema que trabalha enquanto o usuário trabalha**: coleta
agendada, pontuação por evidência, organização em Kanban e assistência de IA sobre o material
real do usuário.

## 2. Objetivo do produto

Entregar, todo dia, uma lista curta e priorizada de oportunidades **novas, reais e compatíveis**,
com o contexto necessário para agir (recrutador, empresa, currículo adequado, comparação com o
emprego atual) — sem expor a busca.

### Métricas de sucesso (usuário único)

| Métrica | Alvo |
|---|---|
| Tempo diário gasto procurando vaga | < 10 min |
| Vagas com ≤ 24h de publicação no radar diário | ≥ 60% do total exibido |
| Taxa de resposta das candidaturas | ≥ 15% (vs. ~5% em candidatura indiscriminada) |
| Score médio das vagas às quais se candidatou | ≥ 70 |
| Recomendações de LinkedIn aplicadas e rastreadas | 100% com evolução de score registrada |

## 3. Escopo

### Dentro do escopo (Fases 1–5)

Os 12 módulos do documento 05, operando para **um usuário**, com arquitetura multi-tenant.

### Fora do escopo (explicitamente)

| Item | Por quê |
|---|---|
| Candidatura automática ("auto-apply") | Viola termos de uso de praticamente toda plataforma, gera spam e destrói a reputação do candidato. O CareerOS prepara a candidatura; o envio é humano. |
| Scraping autenticado do LinkedIn / automação de conta | Violação dos termos de uso e risco de banimento da conta do usuário — que é o ativo profissional dele. Ver documentos 09 e 14. |
| Mensagens automáticas a recrutadores | Mesma razão. O sistema redige; o usuário envia. |
| App mobile nativo | Desktop é prioridade declarada. Web responsivo cobre o uso móvel. |
| Billing, planos, times, convites | Fase 6+ (pós-SaaS). O schema já suporta. |
| Pipeline de dados em tempo real (streaming) | Overkill. Coleta agendada resolve o problema de "últimas 24h". |

## 4. Decisões arquiteturais fechadas (ADRs)

Estas decisões **não devem ser reabertas** pela IA implementadora. Cada uma tem alternativa
considerada e motivo da escolha.

### ADR-001 — Next.js 15 App Router como aplicação única (full-stack)

- **Decisão:** um único projeto Next.js serve UI, rotas de API (Route Handlers) e Server Actions.
- **Alternativa rejeitada:** frontend Next + backend separado (NestJS/Fastify). Rejeitada por
  dobrar deploy, autenticação e tipos sem ganho algum para 1 usuário.
- **Consequência:** todo segredo vive no servidor; o cliente nunca fala com fonte de vaga nem
  com a API de IA diretamente.

### ADR-002 — Supabase como plataforma de dados (Postgres + Auth + Storage)

- **Decisão:** Postgres gerenciado, Auth com JWT, Storage com buckets privados, RLS como
  mecanismo primário de autorização.
- **Alternativa rejeitada:** Postgres puro (Neon/RDS) + Auth.js. Rejeitada porque perderíamos RLS
  integrada ao JWT e Storage com políticas — seria necessário reimplementar autorização na
  aplicação, com risco muito maior de vazamento entre usuários.
- **Limitação aceita:** acoplamento ao Supabase. Mitigado por SQL padrão (nada exclusivo além de
  RLS e `auth.uid()`) e acesso ao banco encapsulado em `lib/db`.

### ADR-003 — Agendamento com Vercel Cron chamando rotas protegidas

- **Decisão:** `vercel.json` define os crons; cada cron chama `POST /api/cron/<job>` com header
  `Authorization: Bearer ${CRON_SECRET}`. A rota enfileira/executa lotes e registra em
  `collector_runs`.
- **Alternativa rejeitada:** `pg_cron` + Edge Functions (mais partes móveis, depuração pior em
  Deno) ou worker Node dedicado (custo fixo de servidor).
- **Limitação aceita:** o plano Hobby da Vercel limita cron a **1x/dia** e a função a 60s
  (Pro: 300s). **Mitigação obrigatória:** o coletor é *chunked* — cada execução processa um lote
  (`search_profile` × `source`) retirado de `collector_queue` e devolve o restante à fila, nunca
  dependendo de uma execução longa. A UI também permite disparo manual da coleta.

### ADR-004 — Catálogo de vagas global, vínculo usuário–vaga separado

- **Decisão:** `jobs` é um catálogo compartilhado (dado público coletado). O que é pessoal vive em
  `job_matches` (score, status, perfil de busca que encontrou) e `applications`.
- **Motivo:** deduplicação real entre perfis de busca e economia — uma vaga coletada serve N
  perfis e, no futuro, N usuários.
- **Segurança:** `jobs` é legível por qualquer usuário autenticado (é informação pública);
  escrita somente via `service_role`. Nenhum dado pessoal em `jobs`. Variante mais restritiva
  documentada em 10 §8, caso o produto passe a usar fontes licenciadas.

### ADR-005 — Toda pontuação é explicável e versionada

- **Decisão:** `job_matches.score_breakdown` (jsonb) guarda cada subcomponente, a evidência usada
  e o que faltou. `score_version` identifica o algoritmo. Scores são recalculáveis em lote.
- **Motivo:** score sem explicação é inútil para decidir e impossível de depurar; e a
  especificação proíbe pontuação sem evidência.

### ADR-006 — IA só roda no servidor, sempre com contrato de saída

- **Decisão:** toda chamada de IA passa por `lib/ai/client.ts`, usa *structured output* validado
  com Zod, registra custo em `ai_runs` e respeita teto mensal por usuário.
- **Motivo:** controle de custo, auditabilidade e proibição de invenção (documento 20).

### ADR-007 — Coleta respeita robots.txt, termos de uso e rate limits; fontes são declarativas

- **Decisão:** nenhuma fonte entra no sistema sem registro em `job_sources` com `terms_url`,
  `legal_status` e `legal_notes`. Fonte com `legal_status = 'disallowed'` não é coletada, nem com
  flag ligada — o núcleo se recusa a executar o adaptador.
- **Motivo:** a especificação exige não presumir disponibilidade de integrações; a alternativa
  (scraping indiscriminado) cria risco jurídico e técnico (bloqueio de IP, ação por ToS).

### ADR-008 — Português brasileiro é a língua do produto; en-US fica preparado

- **Decisão:** toda a UI em pt-BR. Strings centralizadas em `lib/i18n/pt-BR.ts` (objeto tipado,
  nunca texto solto em JSX). Sem biblioteca de i18n na Fase 1.
- **Motivo:** cumpre o requisito sem custo de infraestrutura de tradução e permite extrair para
  `next-intl` depois sem caçar strings pelo código.

### ADR-009 — Dark mode é o padrão real, não um tema alternativo

- **Decisão:** tokens de cor definidos em `:root` já no esquema escuro (grafite + azul);
  light mode é override sob `[data-theme="light"]`. `next-themes` com `defaultTheme="dark"`.

### ADR-010 — Sem fila externa, sem Redis, sem microserviços nas Fases 1–4

- **Decisão:** a fila é uma tabela Postgres (`collector_queue`) consumida com
  `FOR UPDATE SKIP LOCKED`. Rate limiting é tabela + função SQL. Cache é `unstable_cache`/
  `revalidateTag` do Next.
- **Motivo:** economia e simplicidade. Postgres resolve bem até ordens de magnitude acima da
  carga esperada. Trocar por Upstash/QStash é troca de adaptador (documento 04 §8).

### ADR-011 — Dado faltante é modelado, não contornado

- **Decisão:** todo campo cuja origem é incerta tem par `*_source` e `*_confidence`. A UI tem um
  estado visual próprio para "não identificado", distinto de "zero" e de "carregando".
- **Motivo:** é o único jeito de cumprir "não inventar dados" de forma verificável.

## 5. Princípios de implementação (não negociáveis)

1. **Sem dado inventado.** Se não há evidência, o campo é nulo e a UI mostra "não identificado".
2. **Server-first.** Leitura em Server Components; mutação em Server Actions ou Route Handlers.
   `use client` apenas onde há interação real.
3. **RLS é a autorização.** Nenhuma consulta confia em filtro de aplicação para isolar usuário.
4. **Idempotência.** Todo coletor, migration e job pode rodar duas vezes sem efeito duplicado.
5. **Tipos gerados, não escritos à mão.** `supabase gen types typescript` →
   `lib/db/database.types.ts`, versionado.
6. **Nenhuma credencial de terceiro em texto claro** — nem em `.env` exposto ao cliente, nem no
   banco.
7. **Fase fechada é fase testada.** Os critérios de aceite do documento 17 são binários.
