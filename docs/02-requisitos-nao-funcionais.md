# 02 — Requisitos Não Funcionais

**Convenção:** `RNF-<categoria>-<nº>`. Toda meta é mensurável; quando houver forma de medir,
ela está declarada.

---

## 1. Desempenho (PERF)

| ID | Requisito | Meta | Como medir |
|---|---|---|---|
| RNF-PERF-01 | Carregamento inicial de qualquer página autenticada | LCP ≤ 2,5 s em conexão 4G simulada | Lighthouse CI / Vercel Speed Insights |
| RNF-PERF-02 | Resposta de listagem do Job Radar com 500 vagas | ≤ 500 ms no servidor (p95), com paginação de 25 | log de duração da query |
| RNF-PERF-03 | Movimentação de cartão no Kanban | feedback visual ≤ 100 ms (otimista), persistência ≤ 1 s | medição manual + teste e2e |
| RNF-PERF-04 | Consultas ao banco em listagens | nenhuma consulta sem índice; zero N+1 | `EXPLAIN ANALYZE` nas 10 queries principais, revisadas na Fase 5 |
| RNF-PERF-05 | Execução de um lote de coleta (1 perfil × 1 fonte) | ≤ 45 s, para caber no limite de 60 s da função | `collector_runs.duration_ms` |
| RNF-PERF-06 | Auditoria de LinkedIn (chamada de IA) | ≤ 60 s; executada em background com status consultável, nunca bloqueando a UI | `ai_runs.latency_ms` |
| RNF-PERF-07 | Tamanho do bundle JS da rota mais pesada | ≤ 300 kB gzip | `next build` analyzer |
| RNF-PERF-08 | Paginação obrigatória | nenhuma listagem retorna mais de 50 registros por requisição | revisão de código |

## 2. Escalabilidade (SCAL)

| ID | Requisito |
|---|---|
| RNF-SCAL-01 | Toda tabela de dado pessoal possui `user_id` e índice que o inclui como primeira coluna, de modo que o crescimento do número de usuários não degrade as consultas de um usuário. |
| RNF-SCAL-02 | O sistema deve suportar 100.000 vagas em `jobs` e 1.000.000 de linhas em `job_matches` sem alteração de schema, mantendo as metas de RNF-PERF-02. |
| RNF-SCAL-03 | A coleta é horizontalmente paralelizável: a fila `collector_queue` é consumida com `FOR UPDATE SKIP LOCKED`, permitindo N executores simultâneos sem trabalho duplicado. |
| RNF-SCAL-04 | Tabelas de histórico de alto volume (`recruiter_activities`, `collector_runs`, `audit_logs`, `ai_runs`) possuem política de retenção configurável, com expurgo agendado (padrão: 180 dias). |
| RNF-SCAL-05 | Nenhum estado de aplicação é mantido em memória do processo; qualquer instância serverless atende qualquer requisição. |
| RNF-SCAL-06 | O limite de perfis de busca, fontes por perfil e teto de IA são configuração por usuário (`user_limits`), não constantes no código — é o que permite virar SaaS com planos. |

## 3. Disponibilidade e resiliência (RES)

| ID | Requisito |
|---|---|
| RNF-RES-01 | Falha de uma fonte de vagas não pode interromper a coleta das demais: cada lote é isolado, com try/catch por adaptador e registro do erro em `collector_runs.error_message`. |
| RNF-RES-02 | Toda chamada HTTP externa tem timeout (padrão: 15 s), 3 tentativas com backoff exponencial e jitter, e falha registrada. |
| RNF-RES-03 | Indisponibilidade da API de IA degrada o produto graciosamente: módulos não-IA continuam funcionando e a UI informa a indisponibilidade. |
| RNF-RES-04 | Toda operação de coleta é idempotente: reexecução do mesmo lote não cria vaga duplicada (garantido por `UNIQUE (source_id, external_id)` e por `fingerprint`). |
| RNF-RES-05 | O sistema distingue falha transitória (retry) de falha permanente (fonte marcada `degraded` após 5 falhas consecutivas e notificação ao usuário). |
| RNF-RES-06 | Perda de uma execução de cron não causa perda de dados: a fila persiste e a próxima execução retoma o pendente. |
| RNF-RES-07 | Toda mutação crítica na UI usa atualização otimista com reversão em caso de erro, e mensagem de erro acionável em pt-BR. |

## 4. Segurança (SEC)

Detalhamento completo no documento 16. Requisitos verificáveis:

| ID | Requisito |
|---|---|
| RNF-SEC-01 | 100% das tabelas com dado pessoal têm `ENABLE ROW LEVEL SECURITY` e política baseada em `auth.uid()`. Verificado por teste automatizado que falha se qualquer tabela nova ficar sem RLS. |
| RNF-SEC-02 | A chave `service_role` do Supabase existe somente em variável de ambiente do servidor e nunca é importada em arquivo com `"use client"`. Verificado por regra de lint/CI. |
| RNF-SEC-03 | Nenhuma senha de plataforma externa é solicitada, transmitida ou armazenada, em nenhuma circunstância. |
| RNF-SEC-04 | Toda entrada do usuário é validada com Zod na borda do servidor (Route Handler ou Server Action) antes de qualquer uso. |
| RNF-SEC-05 | Buckets do Storage são privados; o acesso se dá por URL assinada com validade ≤ 5 min. |
| RNF-SEC-06 | Rotas de cron e webhooks exigem segredo compartilhado comparado em tempo constante. |
| RNF-SEC-07 | Rate limiting aplicado a: coleta manual, chamadas de IA, upload e autenticação. |
| RNF-SEC-08 | Headers de segurança configurados: CSP, `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `X-Content-Type-Options`. |
| RNF-SEC-09 | Dependências auditadas (`npm audit`) no CI; build falha em vulnerabilidade crítica. |
| RNF-SEC-10 | Segredos nunca aparecem em log; `console.log` de objetos de configuração é proibido. |
| RNF-SEC-11 | Campos sensíveis (remuneração atual, PIN) marcados no schema e excluídos de qualquer exportação não solicitada e de qualquer contexto enviado à IA sem necessidade. |

## 5. Privacidade e conformidade (PRIV)

| ID | Requisito |
|---|---|
| RNF-PRIV-01 | Conformidade com a LGPD no papel de controlador dos próprios dados: direito de acesso (RF-AUT-07), correção, exclusão (RF-AUT-06) e portabilidade. |
| RNF-PRIV-02 | Dados de terceiros (recrutadores) armazenados limitam-se a informação profissional pública e ao mínimo necessário; há função de exclusão de um recrutador a pedido. |
| RNF-PRIV-03 | Nenhum dado pessoal do usuário é enviado a serviço externo sem necessidade funcional; o contexto enviado à IA é montado por lista de permissão explícita de campos, não por "despejo" do perfil. |
| RNF-PRIV-04 | Nenhum rastreador de terceiros, pixel de publicidade ou analytics com dado pessoal. Analytics, se houver, é agregado e sem identificação. |
| RNF-PRIV-05 | O usuário pode desativar o registro de logs de atividade. |
| RNF-PRIV-06 | Retenção declarada por tipo de dado, com expurgo automatizado. |
| RNF-PRIV-07 | A política de privacidade e o uso de IA são exibidos ao usuário na primeira execução. |

## 6. Usabilidade e acessibilidade (UX)

| ID | Requisito |
|---|---|
| RNF-UX-01 | Toda a interface em português brasileiro, incluindo mensagens de erro, estados vazios, e-mails e textos de validação. |
| RNF-UX-02 | Dark mode como padrão; light mode funcional em todas as telas (sem contraste quebrado). |
| RNF-UX-03 | Contraste mínimo WCAG 2.1 AA (4,5:1 para texto normal, 3:1 para texto grande e elementos de interface). |
| RNF-UX-04 | Navegação completa por teclado nas ações principais; o Kanban tem alternativa por teclado ao arrastar e soltar. |
| RNF-UX-05 | Todo estado vazio explica o que fazer em seguida, com ação primária visível. |
| RNF-UX-06 | Todo carregamento usa skeleton específico da tela, não spinner genérico de página inteira. |
| RNF-UX-07 | Dado indisponível tem representação visual própria ("não identificado"), distinta de zero. |
| RNF-UX-08 | Layout responsivo de 1280 px (prioritário) a 360 px; o Kanban rola horizontalmente no móvel sem quebrar. |
| RNF-UX-09 | Nenhuma ação destrutiva sem confirmação; exclusão de conta exige digitação de confirmação. |
| RNF-UX-10 | Toda operação longa (coleta, auditoria) mostra progresso e permite sair da tela sem cancelar. |
| RNF-UX-11 | Datas exibidas em formato pt-BR e no fuso do usuário; "há 3 horas" acompanhado da data absoluta em tooltip. |
| RNF-UX-12 | Respeito a `prefers-reduced-motion`. |

## 7. Manutenibilidade (MNT)

| ID | Requisito |
|---|---|
| RNF-MNT-01 | TypeScript em modo `strict`; `any` proibido fora de pontos de desserialização explicitamente comentados. |
| RNF-MNT-02 | Tipos do banco gerados pelo CLI do Supabase e versionados; a aplicação não declara tipos de tabela à mão. |
| RNF-MNT-03 | Camadas respeitadas: `app/` (UI e rotas) → `features/` (regra de negócio por domínio) → `lib/` (infra). `lib/` nunca importa de `features/` nem de `app/`. Verificado por ESLint (`import/no-restricted-paths`). |
| RNF-MNT-04 | Toda regra de negócio pura (score, dedupe, normalização, cálculo de proposta) vive em função pura testável, sem acesso a banco. |
| RNF-MNT-05 | Adicionar fonte de vaga não altera arquivo do núcleo: apenas novo arquivo em `lib/radar/adapters/`, uma linha no registry e uma linha de seed em `job_sources`. |
| RNF-MNT-06 | Toda migration é idempotente, numerada, versionada e aplicada por CLI; nunca alteração manual no painel. |
| RNF-MNT-07 | Lint e formatação automatizados (ESLint + Prettier), executados no CI. |
| RNF-MNT-08 | Nomes de arquivos e pastas em inglês; texto voltado ao usuário em pt-BR. Evita mistura no código. |
| RNF-MNT-09 | Cada módulo tem um `README.md` curto na sua pasta de feature, explicando entrada, saída e invariantes. |

## 8. Testabilidade (TST)

| ID | Requisito |
|---|---|
| RNF-TST-01 | Cobertura de testes unitários ≥ 80% nas funções puras de: Opportunity Score, deduplicação, normalização, validação de data de publicação, classificação de recrutador e cálculo de proposta. |
| RNF-TST-02 | Cada adaptador de fonte tem teste com *fixture* de resposta real salva em arquivo, sem rede. |
| RNF-TST-03 | Testes de RLS: para cada tabela pessoal, um teste garante que o usuário A não lê nem escreve dado do usuário B. |
| RNF-TST-04 | Testes e2e (Playwright) dos fluxos críticos: login, criar perfil de busca, coletar, mover cartão no Kanban, rodar auditoria de LinkedIn. |
| RNF-TST-05 | Nenhum teste depende de rede externa; chamadas de IA e HTTP são mockadas. |
| RNF-TST-06 | O CI roda lint, typecheck, testes unitários e de RLS em todo push. |

## 9. Observabilidade (OBS)

| ID | Requisito |
|---|---|
| RNF-OBS-01 | Toda execução de coleta registra: fonte, perfil, início, fim, duração, itens encontrados/novos/duplicados/filtrados, erro. |
| RNF-OBS-02 | Toda chamada de IA registra: feature, modelo, versão do prompt, tokens de entrada e saída, custo estimado, latência, status. |
| RNF-OBS-03 | Logs estruturados em JSON com `request_id` correlacionando UI → rota → coleta. |
| RNF-OBS-04 | Logs nunca contêm conteúdo de documento do usuário, token ou segredo. |
| RNF-OBS-05 | Página de diagnóstico em Configurações mostra saúde das fontes, últimas execuções e últimos erros, em linguagem compreensível. |
| RNF-OBS-06 | Erros não tratados no servidor são registrados com stack trace; o usuário recebe mensagem genérica com código de correlação. |

## 10. Custo (COST)

| ID | Requisito |
|---|---|
| RNF-COST-01 | A operação para 1 usuário deve caber nos planos gratuitos de Vercel e Supabase, exceto a API de IA. |
| RNF-COST-02 | Custo de IA controlado por: teto mensal por usuário, cache de resultados idênticos (hash da entrada), escolha de modelo por tarefa (modelo barato para classificação/extração, modelo capaz para auditoria e redação) e limite de tokens por chamada. |
| RNF-COST-03 | Nenhuma chamada de IA é disparada automaticamente sem ação ou agendamento explícito do usuário — a coleta de vagas em si não usa IA. |
| RNF-COST-04 | O custo estimado de cada operação de IA é exibido antes da execução de operações caras (auditoria completa, geração de currículo). |
| RNF-COST-05 | Armazenamento controlado por limite de tamanho por arquivo e cota total por usuário (padrão: 500 MB). |

## 11. Portabilidade e implantação (DEP)

| ID | Requisito |
|---|---|
| RNF-DEP-01 | O projeto roda localmente com `supabase start` + `npm run dev`, sem depender de serviço pago, com dados de seed. |
| RNF-DEP-02 | Três ambientes: local, preview (por branch) e produção, com projetos Supabase distintos. |
| RNF-DEP-03 | Nenhum segredo no repositório; `.env.example` documenta todas as variáveis com descrição e obrigatoriedade. |
| RNF-DEP-04 | Deploy é push na branch principal; migrations aplicadas por comando explícito, nunca automaticamente no build. |
| RNF-DEP-05 | Backup: PITR do Supabase quando disponível no plano; caso contrário, exportação lógica diária agendada e armazenada fora da plataforma. Teste de restauração documentado e executado ao fim da Fase 5. |

## 12. Internacionalização (I18N)

| ID | Requisito |
|---|---|
| RNF-I18N-01 | Strings de interface centralizadas em `lib/i18n/pt-BR.ts`, tipadas, sem texto solto em componentes. |
| RNF-I18N-02 | Formatação de data, número e moeda via `Intl`, com locale do usuário (padrão `pt-BR`, moeda `BRL`). |
| RNF-I18N-03 | Todo timestamp é armazenado em UTC (`timestamptz`) e convertido na exibição. |
| RNF-I18N-04 | O conteúdo gerado por IA respeita o idioma configurado pelo usuário (padrão pt-BR), inclusive ao analisar vaga em inglês. |
