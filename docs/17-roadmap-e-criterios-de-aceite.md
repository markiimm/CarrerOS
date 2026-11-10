# 17 — Roadmap de implementação e critérios de aceite

> Cada fase tem escopo fechado, entregáveis verificáveis e **critérios binários**: passa ou não
> passa. Fase não fechada não libera a seguinte — a ordem existe porque cada fase é insumo da
> próxima.
> Estimativas em "sessões de trabalho" (≈ 3 h de implementação focada), não em dias de calendário.

## Visão geral

| Fase | Nome | Entrega central | Esforço |
|---|---|---|---|
| 1 | Fundação | autenticação, banco completo, perfil profissional, dashboard com estados vazios | 8–11 sessões |
| 2 | Radar | coleta multi-fonte, dedupe, score, recrutadores, Kanban | 14–18 sessões |
| 3 | LinkedIn | auditoria, pontuação, recomendações, otimizador, evolução | 9–12 sessões |
| 4 | Inteligência | IA aplicada, CRM, mercado, propostas, evolução profissional | 14–18 sessões |
| 5 | Finalização | biblioteca, notificações, modo discreto, testes, segurança, desempenho | 9–12 sessões |

Regra de ouro: **nenhuma fase entrega tela sem dado real atrás.** Se o dado não existe ainda, a
tela mostra estado vazio honesto, com a ação que gera o dado.

---

## FASE 1 — Fundação

### Escopo

1. Projeto Next.js 15 + TypeScript strict + Tailwind + shadcn/ui, com tokens do documento 15.
2. Supabase local e remoto; **todas** as migrations 0001–0019 aplicadas (o banco nasce completo —
   criar schema por fase geraria retrabalho e migrations de correção).
3. Autenticação: cadastro, confirmação, login, magic link, recuperação, middleware, `/bloqueio`.
4. Trigger de criação de usuário; `profiles`, `user_settings`, `user_limits`.
5. Perfil profissional: múltiplos perfis, experiências, formação, certificações, competências,
   links, emprego atual (sensível), completude.
6. Shell da aplicação: sidebar, topbar, tema escuro padrão com alternância, i18n pt-BR.
7. Dashboard com `dashboard_counters()` e os oito cards em estado vazio guiado.
8. Configurações: conta e aparência.
9. CI: lint, typecheck, teste unitário, teste de RLS, build.

### Critérios de aceite (binários)

- [ ] `supabase db reset` aplica todas as migrations em banco limpo, sem erro, duas vezes
      seguidas (idempotência).
- [ ] `app_private.rls_coverage` não lista nenhuma tabela com `rls_enabled = false`.
- [ ] Teste de travessia A→B passa para **todas** as tabelas pessoais (RNF-TST-03).
- [ ] `application_events` e `linkedin_audit_sections` negam `UPDATE`/`DELETE` ao próprio dono.
- [ ] Cadastro cria as 4 linhas padrão (teste).
- [ ] Nenhuma rota de `(app)` responde sem sessão (teste varrendo as rotas).
- [ ] `npm run db:types` gera tipos e o CI falha se o arquivo versionado estiver defasado.
- [ ] Tema escuro é o padrão, persiste e não pisca ao carregar.
- [ ] Toda a interface em pt-BR, sem string solta em JSX (lint).
- [ ] Perfil profissional calcula completude e lista o que falta.
- [ ] Dashboard distingue "sem dados ainda" de zero em 100% dos cards (RF-DSH-08).
- [ ] CI verde: lint + typecheck + unit + rls + build.

---

## FASE 2 — Radar

### Escopo

1. Perfis de busca com filtros independentes, limite de ativos, pesos de score.
2. Contrato do adaptador + registry + **dois adaptadores reais** (`manual` + um de
   `greenhouse`/`rss-generic`) com fixtures.
3. Núcleo: guard, planner, runner (fila com `SKIP LOCKED`), nove etapas do `processLot`.
4. `resolvePublishedAt` com proveniência e confiança; rótulos da interface.
5. Deduplicação em três níveis; `job_duplicates`; exibição da canônica com as fontes irmãs.
6. Normalização por dicionário (título, local, modalidade, contrato, senioridade, salário,
   competências).
7. Opportunity Score completo, com `score_breakdown` e explicação derivada.
8. Recrutadores: registro, evidências, classificação, vinculação automática, rotina diária.
9. Kanban com dez colunas, arrastar e soltar, histórico imutável, próxima ação, estagnação.
10. Painel de execuções e saúde das fontes; coleta manual com rate limit.
11. Crons: `collect-jobs`, `close-stale-jobs`, `recalc-scores`, `refresh-recruiters`.

### Critérios de aceite

- [ ] Fonte com `legal_status != 'allowed'` não é executada **nem com a fonte habilitada pelo
      usuário** (teste).
- [ ] Adicionar um terceiro adaptador exige apenas novo arquivo + linha no registry + seed —
      comprovado fazendo isso de verdade durante a entrega, sem tocar no núcleo.
- [ ] Cada adaptador tem teste com fixture, sem rede (RNF-TST-02).
- [ ] Vaga sem data confiável **nunca** aparece como "publicada há X"; aparece como
      "detectada em" e seu componente de recência fica indisponível.
- [ ] Duas fontes com a mesma vaga ⇒ uma entrada visível + linha em `job_duplicates` com
      `strategy` e `similarity`.
- [ ] Recoletar o mesmo lote duas vezes não cria vaga duplicada nem atividade de recrutador
      duplicada (idempotência).
- [ ] `score = null` quando nenhum componente está disponível; nunca 0.
- [ ] `data_coverage < 0,5` ⇒ selo de baixa confiança e **nenhuma notificação**, mesmo com score 95.
- [ ] Explicação do score contém apenas o que está em `score_breakdown`.
- [ ] Recrutador só é "Ativo recentemente" com evidência datada de confiança ≥ `approximate` nos
      últimos 14 dias; `profile_update` nunca eleva classificação (testes).
- [ ] Classificação muda sozinha entre D+14 e D+15 pela rotina diária.
- [ ] Vaga de empresa vetada não aparece em radar, dashboard, estatística nem notificação.
- [ ] Vaga descartada não reaparece no mesmo perfil de busca.
- [ ] Falha simulada de uma fonte não impede as outras e fica registrada em `collector_runs`.
- [ ] Mover cartão no Kanban persiste em ≤ 1 s, gera evento e reverte visualmente em erro.
- [ ] Kanban operável só com teclado.
- [ ] Listagem do radar com 500 vagas responde em ≤ 500 ms no servidor (p95), paginada em 25.
- [ ] Coleta manual respeita `MANUAL_RUNS_PER_HOUR` e devolve 429 com tempo de espera.
- [ ] Cobertura ≥ 80% nas funções puras de score, dedupe, normalização, data e classificação.

---

## FASE 3 — LinkedIn

### Escopo

1. Quatro entradas (URL best-effort, texto, PDF, formulário) → `ProfileSnapshot`.
2. Relatório de cobertura e matriz de avaliabilidade.
3. Revisão humana obrigatória do snapshot.
4. Camada determinística por seção + camada de IA com saída estruturada.
5. Validador anti-invenção + Zod + retentativa única.
6. Score ponderado, prioridade calculada, achados com cinco partes.
7. Comparação original versus otimizado; cópia em um clique.
8. Histórico, comparação entre auditorias, gráfico de evolução, rastreamento de recomendações.
9. Upload e exclusão do PDF em bucket privado; `ai_runs` com custo.

### Critérios de aceite

- [ ] As quatro entradas produzem snapshot válido; a de URL falha graciosamente nos quatro
      cenários testados (parcial, redirecionamento para login, 403, timeout) e oferece as outras.
- [ ] Nenhuma tentativa de autenticação, proxy ou navegador headless no código (revisão).
- [ ] Parsers de texto e PDF testados com ≥ 5 fixtures reais cada.
- [ ] Seção `not_evaluable` não recebe nota, sai da normalização e aparece listada com a ação
      para fornecê-la.
- [ ] Análise não roda sem `reviewed_at` no snapshot (teste de rota).
- [ ] Todo achado tem issue, impact, how_to_fix, example_text e priority; achado incompleto é
      rejeitado antes de gravar (teste).
- [ ] Validador anti-invenção rejeita empresa, cargo, data, número e tecnologia ausentes na
      entrada — um teste por categoria.
- [ ] `[PREENCHER: ...]` presente sempre que a sugestão depender de dado inexistente.
- [ ] Prioridade confere com a fórmula do RN-064 em três casos manuais documentados.
- [ ] Auditoria concluída é imutável; só `status` de achado muda (teste de RLS + trigger).
- [ ] Comparação entre duas auditorias ignora seções não avaliadas em uma delas e declara isso.
- [ ] Excluir auditoria remove o PDF do Storage (teste conferindo ausência do objeto).
- [ ] Auditoria executa em ≤ 60 s, em background, com polling e possibilidade de sair da tela.
- [ ] Cache por hash evita segunda cobrança para snapshot idêntico (teste).
- [ ] Toda saída exibe modelo, versão do prompt e data.

---

## FASE 4 — Inteligência

### Escopo

1. AI Career Assistant: análise de vaga, currículo adaptado, carta, mensagem, simulação de
   entrevista, estimativa de ATS.
2. Teto de custo, cache, modelo por tarefa, contexto por lista de permissão, painel de consumo.
3. Recruiter CRM: empresas, interações, follow-up, linha do tempo unificada, mesclagem,
   alerta de empresa alvo.
4. Career Intelligence: estatísticas com `n` e período, tendências, mercado versus usuário,
   `compute-insights` semanal.
5. Offer Comparator: cálculo CLT/PJ com premissas versionadas, comparação, pesos do usuário,
   contraproposta, decisão.
6. Career Growth: competências, lacunas, planos, itens, metas, marcos.
7. Currículos versionados com versão mestre.
8. Configurações: IA, regras e pesos de score.

### Critérios de aceite

- [ ] 100% das chamadas de IA registram `ai_runs` com modelo, versão de prompt, tokens, custo e
      latência.
- [ ] Teto de IA **bloqueia** de fato, com mensagem de consumo e data de reinício (teste).
- [ ] Nenhuma chamada de IA ocorre sem ação explícita do usuário (revisão + teste).
- [ ] Cache evita segunda cobrança para entrada idêntica (teste).
- [ ] Currículo adaptado não contém nenhum fato ausente no currículo mestre (teste preparado).
- [ ] Toda saída de IA declara quais dados do usuário foram usados como contexto.
- [ ] Nenhuma estatística com `n < 8` é exibida; aparece "amostra insuficiente (n = X)".
- [ ] Toda estatística declara `n`, período e origem, e é possível ver quais vagas a compõem.
- [ ] Salário estimado nunca entra em estatística de salário informado (teste).
- [ ] Extração de competências é determinística e testada com 20 descrições de fixture.
- [ ] Cálculo de proposta confere com três casos manuais documentados (CLT, PJ, CLT com
      benefícios).
- [ ] Toda comparação grava e exibe premissas e versão da tabela de alíquotas; proposta PJ exige
      alíquota informada.
- [ ] Ressalva de "não é aconselhamento fiscal" visível em toda tela de cálculo.
- [ ] Nenhuma sugestão de estudo contém curso, provedor, preço ou URL inventados (constraint +
      teste).
- [ ] Classificação de recrutador, follow-up vencido e alerta de empresa alvo geram notificação e
      aparecem no dashboard.
- [ ] Indisponibilidade da IA não quebra nenhuma tela não-IA.

---

## FASE 5 — Finalização

### Escopo

1. Biblioteca profissional completa: upload, categorias, etiquetas, busca, cota,
   pré-visualização, vínculos, validade de certificações.
2. Notificações: tipos, canais, horário silencioso, resumo diário, leitura e limpeza.
3. Modo discreto completo: título neutro, máscara, PIN, e-mail neutro, logs desligáveis.
4. Exclusão de conta, exportação de dados, encerramento de sessões, OAuth opcional.
5. Importação de perfil por PDF (RF-PRF-09) e adaptador `email-alert` (opcional).
6. Testes e2e dos cinco fluxos críticos; revisão de desempenho; revisão de segurança;
   backup com restauração testada.
7. Documentação final: `README` de execução, variáveis, procedimento de migration, runbook de
   incidentes.

### Critérios de aceite

- [ ] Upload rejeita tipo não permitido (por magic bytes) e arquivo acima do limite, com mensagem
      em pt-BR.
- [ ] Usuário A não acessa arquivo de B nem com o caminho exato (teste de política de Storage).
- [ ] URL assinada expira em 5 min (teste).
- [ ] Excluir documento remove linha e objeto; expurgo de órfãos funciona.
- [ ] Cota de armazenamento respeitada e exibida.
- [ ] Com modo discreto ativo, nenhuma notificação imediata é emitida em nenhum canal (teste).
- [ ] Assunto de e-mail não revela busca de emprego com o modo ativo.
- [ ] Resumo diário consolida as notificações do dia em uma só mensagem.
- [ ] PIN bloqueia a interface após o tempo configurado; armazenado apenas como hash.
- [ ] Máscara oculta salário e empresa até ação explícita.
- [ ] Exclusão de conta remove todas as linhas pessoais e todos os objetos do Storage (teste em
      base de desenvolvimento, conferindo contagem zero).
- [ ] Exportação gera JSON completo, sem `pin_hash` nem segredos.
- [ ] Nenhum campo em todo o sistema pede senha de plataforma externa (revisão documentada).
- [ ] Cinco fluxos e2e verdes: login, criar perfil de busca, coletar, mover cartão, auditar
      LinkedIn.
- [ ] `EXPLAIN ANALYZE` das 10 consultas principais sem varredura sequencial em tabela grande.
- [ ] LCP ≤ 2,5 s nas rotas principais com base de teste (500 vagas, 50 candidaturas).
- [ ] Bundle da rota mais pesada ≤ 300 kB gzip.
- [ ] Restauração de backup executada e documentada.
- [ ] `npm audit` sem vulnerabilidade crítica.

---

## Pontos de verificação transversais (todas as fases)

Avaliados ao fim de cada fase; reprovar em qualquer um reabre a fase:

| # | Verificação |
|---|---|
| T1 | Nenhum número exibido na interface sem origem rastreável até uma tabela |
| T2 | Nenhum dado ausente exibido como zero |
| T3 | RLS ativa e testada em toda tabela nova |
| T4 | Nenhuma string de interface fora de `lib/i18n/pt-BR.ts` |
| T5 | Nenhuma regra de negócio nova fora de `lib/config/rules.ts`, `user_settings` ou `user_limits` |
| T6 | Toda função pura nova tem teste de tabela |
| T7 | `lib/` não importa de `features/` nem de `app/` (lint) |
| T8 | Nenhum segredo em log, repositório ou bundle do cliente |
| T9 | Dark e light funcionando em toda tela nova, a 1280 px e 360 px |
| T10 | Documentação atualizada quando a implementação divergir da especificação (a divergência é bug de um dos dois lados, e precisa ser resolvida) |

## Ordem de implementação dentro de cada fase (recomendada)

```
1. migration + tipos gerados        (o banco primeiro: o resto deriva dele)
2. funções puras + testes           (score, dedupe, classificação, cálculo)
3. queries e actions da feature     (com Zod)
4. rota e componentes               (estados vazios desde o começo)
5. automação (cron/rota longa)
6. testes de RLS e e2e do fluxo
7. revisão dos pontos transversais T1–T10
```
