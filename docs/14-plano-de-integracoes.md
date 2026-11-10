# 14 — Plano de integrações

> Princípio que organiza este documento: **nenhuma integração é presumida disponível.**
> Toda fonte entra no sistema com status legal declarado, e o produto funciona com qualquer
> subconjunto — inclusive com nenhuma (cadastro manual, RF-RAD-15).

## 1. Classificação de status (é o `job_sources.legal_status`)

| Status | Significado | O coletor executa? |
|---|---|---|
| `allowed` | API oficial, feed público documentado ou permissão explícita, com `terms_url` registrada | sim |
| `requires_user_key` | funciona apenas com credencial do próprio usuário | sim, se houver chave |
| `review_needed` | termos de uso ainda não avaliados | **não** |
| `disallowed` | vedada por termos de uso ou `robots.txt` | **não**, nem com flag ligada |

O guard (`lib/radar/core/guard.ts`) lê o banco antes de qualquer requisição de rede. Fonte não
permitida aparece em Configurações **desabilitada com o motivo escrito** (RF-CFG-07) — não é
escondida, porque o usuário precisa entender por que o LinkedIn não aparece no radar.

## 2. Fontes de vagas — avaliação realista

### 2.1 ATS públicos por empresa (a base prática do radar)

| Fonte | Status | Como funciona | Limites reais |
|---|---|---|---|
| **Greenhouse Job Board** | `allowed` | endpoint público por `board_token` da empresa; JSON com título, local, descrição, data | não tem busca por palavra-chave: traz o quadro inteiro e o núcleo filtra localmente; salário raramente presente; recrutador quase nunca |
| **Lever Postings** | `allowed` | endpoint público por `site` da empresa | mesma limitação de busca; data de criação disponível |
| **Ashby** | `review_needed` | existe quadro público | termos a verificar por empresa antes de habilitar |
| **Recruitee / Workable / SmartRecruiters** | `review_needed` | padrões semelhantes | avaliar um a um; adicionar é um arquivo de adaptador (RNF-MNT-05) |

**Consequência de produto:** o valor desta categoria depende de **cadastrar as empresas que
interessam**. O onboarding orienta o usuário a montar sua lista (empresas da região, do setor,
concorrentes do empregador atual) — e essa lista é, na prática, o ativo do radar.

### 2.2 Feeds e páginas públicas

| Fonte | Status | Observação |
|---|---|---|
| **Feed RSS/Atom de vagas** | `allowed` | o usuário cadastra a URL; muitos sites de vaga e páginas de carreira publicam feed. Respeita `robots.txt` e intervalo mínimo |
| **Página de carreiras com JSON-LD `JobPosting`** | `allowed` | lê metadados estruturados (inclui `datePosted`, o que resolve a confiança da data). Uma requisição por página por execução, sem navegador headless |
| **Sitemap de vagas** | `allowed` quando o `robots.txt` permite | usado para descobrir URLs de vaga; cada URL é lida pelo adaptador JSON-LD |

### 2.3 Grandes portais

| Plataforma | Status | Por quê |
|---|---|---|
| **LinkedIn** | `disallowed` | os termos de uso vedam coleta automatizada; não há API pública de vagas para este caso. Nenhum login, nenhuma automação de conta (RN-090). O LinkedIn Analyzer funciona com PDF, texto colado ou formulário |
| **Indeed** | `review_needed` | acesso programático depende de parceria/aprovação comercial. Sem contrato, fica desabilitado. Scraping não é alternativa aceita |
| **Glassdoor, InfoJobs, Catho, Vagas.com** | `review_needed` | avaliar individualmente `robots.txt` e ToS; nenhuma é presumida disponível. Alguns oferecem feed ou alerta por e-mail — caminho preferencial |
| **Portais públicos (concursos, prefeituras, universidades)** | normalmente `allowed` | dado público; frequentemente com RSS |

### 2.4 Alternativa quando a API não existe: alerta por e-mail (Fase 5)

Adaptador `email-alert`, `requires_user_key`:

```
o usuário cria alertas nos portais que usa (algo que ele já faz hoje)
  → encaminha para um endereço dedicado do CareerOS
  → o adaptador lê a caixa, extrai título, empresa, URL e data do e-mail
  → entra no pipeline normal, com published_at_confidence = 'approximate'
```

Isso respeita os termos de uso (é o próprio usuário recebendo seus alertas) e cobre justamente as
plataformas que não permitem coleta. É a integração de maior retorno por esforço depois dos ATS.

## 3. Integração de IA

| Item | Decisão |
|---|---|
| Provedor | API da Anthropic (Claude), via `@anthropic-ai/sdk`, **somente no servidor** |
| Encapsulamento | `lib/ai/client.ts` expõe `complete<TSchema>()`; nenhuma feature conhece o SDK (ADR-006) |
| Modelos | por tarefa (RN-074): modelo econômico para extração/classificação; modelo capaz para auditoria de LinkedIn, currículo e simulação de entrevista |
| Onde **não** se usa | coleta de vagas, extração de competências, cálculo de score, prioridade, estatísticas (RNF-COST-03) |
| Controle de custo | teto por usuário, cache por hash, limite de tokens, custo estimado exibido antes de operação cara |
| Indisponibilidade | degrada graciosamente: módulos não-IA seguem funcionando (RNF-RES-03) |
| Troca de provedor | trocar `lib/ai/client.ts` e `lib/ai/models.ts`; os schemas de saída permanecem |

## 4. Integrações de infraestrutura

| Serviço | Uso | Alternativa prevista |
|---|---|---|
| Supabase (Postgres, Auth, Storage) | dados, sessão, arquivos | Postgres gerenciado + Auth.js (perde RLS integrada — ADR-002) |
| Vercel (hospedagem + Cron) | deploy e agendamento | qualquer agendador HTTP com o mesmo segredo (ADR-003) |
| SMTP (Supabase ou provedor próprio) | e-mail transacional e resumo diário | Resend/SES por `lib/mail/index.ts` |

## 5. Integrações explicitamente **fora** de escopo

| Item | Motivo |
|---|---|
| Automação de conta em qualquer plataforma (login, aplicar, enviar mensagem, aceitar convite) | viola termos de uso; risco para o ativo profissional do usuário (RN-090) |
| Serviço terceirizado de scraping | transfere o problema jurídico, não o resolve; e cria dependência paga |
| Base salarial licenciada (Glassdoor, Levels) | custo e licenciamento; se entrar, entra como fonte declarada com `n` próprio, nunca misturada às vagas coletadas |
| Catálogo de cursos | o sistema não inventa curso nem URL (RF-GRW-07); sugere tema de estudo |
| Google Drive / Dropbox | a biblioteca usa Storage privado, por simplicidade e privacidade |
| Calendário (Google/Outlook) | opcional na Fase 5 apenas como **exportação `.ics`**, sem OAuth de calendário |

## 6. Como adicionar uma fonte (procedimento fechado)

```
1. Avaliar: ler robots.txt e os termos de uso. Registrar a URL dos termos.
2. Decidir o legal_status. Em dúvida → review_needed (não executa).
3. Criar lib/radar/adapters/<nome>.ts implementando JobSourceAdapter.
4. Declarar capabilities honestamente — o núcleo refiltra o que a fonte não filtrou.
5. Salvar fixture real em tests/fixtures/adapters/<nome>.json e escrever o teste (sem rede).
6. Registrar no ADAPTERS (uma linha).
7. Inserir a linha em job_sources via migration de seed, com terms_url e legal_notes.
8. Nenhuma alteração no núcleo. Se o núcleo precisou mudar, o contrato está errado — pare e
   corrija o contrato, documentando no documento 06.
```

## 7. Contrato de robustez para qualquer integração

| Exigência | Implementação |
|---|---|
| Timeout | 15 s por requisição (`COLLECTOR_HTTP_TIMEOUT_MS`) |
| Retry | 3 tentativas, backoff exponencial com jitter; `429` respeita `Retry-After` |
| Rate limit | por fonte, global entre usuários (RN-027) |
| Identificação | `User-Agent` próprio e verificável, com URL explicativa; **nunca** com dado pessoal do usuário |
| `robots.txt` | lido e respeitado, com cache de 24 h |
| Erros | `SourceError` com `kind` tipado; isolamento por lote (RNF-RES-01) |
| Observabilidade | toda execução em `collector_runs`; amostra de payload em erro de parse, truncada e sem dado pessoal |
| Credenciais | só do próprio usuário, cifradas, nunca senha de plataforma (RN-091) |

## 8. Plano de disponibilidade por fase

| Fase | Integrações que precisam existir |
|---|---|
| 1 | nenhuma (Supabase Auth e banco já contam como infraestrutura) |
| 2 | **mínimo:** `manual` + um adaptador real (`greenhouse` ou `rss-generic`). A fase fecha com dois adaptadores testados por fixture |
| 3 | IA (Claude) e Storage |
| 4 | nenhuma nova — Career Intelligence usa apenas as vagas já coletadas |
| 5 | SMTP; opcionalmente `email-alert` e exportação `.ics` |

Se nenhuma fonte externa estiver disponível no momento da implementação, a Fase 2 ainda fecha:
cadastro manual, importação por feed informado pelo usuário e o pipeline completo (dedupe, data,
score, Kanban) são verificáveis com fixtures. Essa é a razão de o `manual` ser um adaptador de
primeira classe, e não um atalho.
