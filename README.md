# CareerOS — Personal Career Intelligence Platform

> **Status deste repositório:** Fase 1 (Fundação) implementada — autenticação, shell, painel,
> perfil profissional e configurações de conta e aparência. As Fases 2–5 seguem o roadmap do
> [documento 17](docs/17-roadmap-e-criterios-de-aceite.md). A especificação em `docs/` continua
> sendo a referência normativa.

## Como executar

```bash
npm install
cp .env.example .env.local   # preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

O banco precisa das migrations `supabase/migrations/0001`–`0019` aplicadas, na ordem
(`npm run db:push` com o Supabase CLI vinculado ao projeto, ou pelo SQL Editor). No painel do
Supabase, em *Authentication → URL Configuration*, inclua `http://localhost:3000/auth/confirm`
(e o domínio de produção) nas URLs de redirecionamento.

| Comando | O que verifica |
|---|---|
| `npm run lint` | estilo, dependência entre camadas e string solta em JSX |
| `npm run typecheck` | tipos (TypeScript strict) |
| `npm run test:unit` | funções puras: completude, validação, normalização |
| `npm run test:rls` | isolamento entre usuários — exige banco de **teste** e `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run build` | build de produção |

Depois de aplicar as migrations, rode `npm run db:types` para substituir o
`lib/db/database.types.ts` provisório pelos tipos gerados do banco.

O CareerOS é uma plataforma pessoal de inteligência de carreira para alguém **que já está
empregado e busca uma oportunidade melhor**, operando de forma discreta e automatizada.

---

## Como usar esta especificação

Leia nesta ordem. Os documentos 01 a 03 definem *o que* construir; 04 a 11 definem *como*;
12 a 20 definem *em que ordem* e *com quais cuidados*.

| # | Documento | Entregável do prompt |
|---|---|---|
| 00 | [docs/00-visao-e-decisoes.md](docs/00-visao-e-decisoes.md) | Visão, escopo, decisões fechadas (ADRs) |
| 01 | [docs/01-requisitos-funcionais.md](docs/01-requisitos-funcionais.md) | 1. Requisitos funcionais |
| 02 | [docs/02-requisitos-nao-funcionais.md](docs/02-requisitos-nao-funcionais.md) | 2. Requisitos não funcionais |
| 03 | [docs/03-regras-de-negocio.md](docs/03-regras-de-negocio.md) | 3. Regras de negócio |
| 04 | [docs/04-arquitetura-tecnica.md](docs/04-arquitetura-tecnica.md) | 4. Arquitetura técnica |
| 05 | [docs/05-modulos.md](docs/05-modulos.md) | Os 12 módulos, documentados em 9 eixos |
| 06 | [docs/06-job-radar.md](docs/06-job-radar.md) | Arquitetura do Job Radar e dos adaptadores |
| 07 | [docs/07-monitoramento-recrutadores.md](docs/07-monitoramento-recrutadores.md) | Monitoramento de recrutadores |
| 08 | [docs/08-opportunity-score.md](docs/08-opportunity-score.md) | Opportunity Score (0–100) |
| 09 | [docs/09-linkedin-analyzer.md](docs/09-linkedin-analyzer.md) | LinkedIn Analyzer (módulo prioritário) |
| 10 | [docs/10-modelo-de-dados.md](docs/10-modelo-de-dados.md) | 5. Modelo de banco de dados |
| 11 | [docs/11-estrutura-de-pastas.md](docs/11-estrutura-de-pastas.md) | 6. Estrutura de pastas |
| 12 | [docs/12-mapa-de-navegacao.md](docs/12-mapa-de-navegacao.md) | 7. Mapa de navegação |
| 13 | [docs/13-fluxos.md](docs/13-fluxos.md) | 8. Fluxos de funcionamento |
| 14 | [docs/14-plano-de-integracoes.md](docs/14-plano-de-integracoes.md) | 9. Plano de integrações |
| 15 | [docs/15-interface-e-design-system.md](docs/15-interface-e-design-system.md) | 11. Interface e experiência |
| 16 | [docs/16-seguranca.md](docs/16-seguranca.md) | 12. Segurança |
| 17 | [docs/17-roadmap-e-criterios-de-aceite.md](docs/17-roadmap-e-criterios-de-aceite.md) | 10 + 11. Roadmap e critérios de aceite |
| 18 | [docs/18-riscos-e-limitacoes.md](docs/18-riscos-e-limitacoes.md) | 12. Riscos e limitações técnicas |
| 19 | [docs/19-contratos-de-api.md](docs/19-contratos-de-api.md) | Contratos de rotas, jobs e payloads |
| 20 | [docs/20-contratos-de-ia.md](docs/20-contratos-de-ia.md) | Contratos de prompt e política anti-invenção |

**SQL inicial:** [`supabase/migrations/`](supabase/migrations/) — migrations idempotentes, da
extensão ao seed, incluindo todas as políticas de Row Level Security.

**Variáveis de ambiente:** [`.env.example`](.env.example)

---

## Resumo de uma página

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase
  (Postgres + Auth + Storage), Vercel Cron para agendamento, API de IA (Claude) via rotas
  server-side. Nada além disso nas Fases 1–4.
- **Multi-tenant desde o dia 1:** toda tabela de dado pessoal tem `user_id` e RLS ativa.
  Uso pessoal hoje; virar SaaS depois é ligar billing, não refazer o banco.
- **Job Radar:** núcleo + adaptadores. Cada fonte de vagas é um módulo que implementa
  `JobSourceAdapter`. Adicionar fonte = adicionar arquivo + linha no registry + registro na
  tabela `job_sources`. Zero mudança no núcleo.
- **Honestidade de dados é regra de produto:** nenhuma data, score, atividade de recrutador ou
  recomendação de IA existe sem evidência rastreável. Dado ausente é `unknown`, nunca estimado
  em silêncio. Isso está codificado no schema (`*_confidence`, `*_source`, `evidence`) e nos
  prompts.
- **Nenhuma senha de plataforma externa é armazenada.** Jamais. Ver documento 16.
- **Econômico por desenho:** roda inteiro no free/hobby tier para 1 usuário e alguns milhares de
  vagas/mês. O custo variável real é a API de IA, com teto configurável por usuário.
