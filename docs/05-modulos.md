# 05 — Especificação dos 12 Módulos

Cada módulo é documentado em nove eixos fixos: **Objetivo · Funcionalidades · Regras de negócio ·
Dados necessários · Ações do usuário · Automações · Dependências · Integrações externas ·
Critérios de conclusão.**

Os três módulos de maior complexidade (Job Radar, monitoramento de recrutadores + Opportunity
Score, LinkedIn Analyzer) têm detalhamento algorítmico próprio nos documentos 06, 07, 08 e 09.

---

## Módulo 1 — Dashboard

**Objetivo.** Responder, em menos de dez segundos, à única pergunta que importa ao abrir o
sistema: *o que exige minha atenção agora?* Não é uma tela de relatórios; é uma tela de decisão.

**Funcionalidades.**
1. Faixa de indicadores do dia: vagas novas (24h), vagas com score ≥ 70, candidaturas ativas,
   entrevistas nos próximos 7 dias, ações atrasadas.
2. "Top 5 oportunidades": melhores `job_matches` não vistos/não descartados, com score, tempo de
   publicação e empresa.
3. Agenda de próximas ações (follow-ups, entrevistas, prazos), ordenada por urgência, com
   atrasados no topo.
4. Funil de candidaturas por estágio (barras horizontais).
5. Série temporal de vagas encontradas (30 dias).
6. Card de saúde do LinkedIn: score atual, variação desde a auditoria anterior, nº de
   recomendações pendentes.
7. Card de saúde das fontes: última execução, fontes degradadas, último erro legível.
8. Card de consumo de IA no mês contra o teto.

**Regras de negócio.** RN-001 (sem dado inferido), RN-030 (score de baixa confiança sinalizado),
RN-004 (amostra mínima em qualquer estatística), RN-013 (empresas vetadas nunca aparecem),
RN-055/RN-056 (estagnação e ações atrasadas), RN-092 (modo discreto oculta valores).
Adicional: **nenhum card exibe zero quando o dado não existe** — exibe "sem dados ainda" com a
ação que gera o dado (RF-DSH-08).

**Dados necessários.** Leitura agregada de `job_matches`, `jobs`, `applications`,
`application_events`, `interviews`, `linkedin_audits`, `collector_runs`, `notifications`,
`ai_runs`, `user_limits`. Nenhuma escrita.

**Ações do usuário.** Abrir vaga; enviar vaga ao Kanban; descartar vaga; concluir ação pendente;
disparar coleta manual; navegar para qualquer módulo; alternar período do gráfico (7/30/90 dias).

**Automações.** Nenhuma própria. O dashboard consome o que os coletores e as rotinas produzem.
Recomenda-se uma *materialized view* `dashboard_daily_metrics` atualizada ao fim de cada coleta
(Fase 5, apenas se a medição mostrar necessidade — não otimizar antes).

**Dependências.** Módulos 2, 3, 4 e 12 para ter dado; autenticação (Fase 1). Na Fase 1 o
dashboard existe com os cards de perfil e estados vazios; os cards de radar aparecem na Fase 2.

**Integrações externas.** Nenhuma.

**Critérios de conclusão.**
- [ ] Todos os oito cards implementados, com estado vazio próprio e com skeleton de carregamento.
- [ ] Nenhum card exibe número sem origem rastreável até uma tabela.
- [ ] Carrega em ≤ 2,5 s de LCP com 500 vagas e 50 candidaturas em base de teste.
- [ ] Cards de score de baixa confiança exibem o selo correspondente.
- [ ] Funciona em dark e light, 1280 px e 360 px.

---

## Módulo 2 — Job Radar

**Objetivo.** Substituir a busca manual por um mecanismo que colete vagas recentes de múltiplas
fontes, deduplique, filtre por perfis de busca independentes, pontue e entregue uma lista curta e
priorizada. Detalhe completo no **documento 06**.

**Funcionalidades.**
1. Coleta agendada no servidor e coleta manual sob demanda.
2. Arquitetura de adaptadores: uma classe por fonte, registry central, zero mudança no núcleo
   para adicionar fonte.
3. Janela de recência: 24h (padrão), 3, 7 e 15 dias.
4. Filtros por perfil de busca: cargo, área, palavras-chave, exclusões, localização, modalidade,
   contratação, faixa salarial, senioridade.
5. Validação e rotulagem da data de publicação com origem e confiança.
6. Deduplicação exata (fonte) e entre fontes (fingerprint + fuzzy).
7. Normalização de título, empresa, local, modalidade e salário.
8. Lista com ordenação (score, recência, salário), filtros rápidos e visão em cartões ou tabela.
9. Detalhe da vaga: descrição, requisitos, decomposição do score, empresa, recrutador, outras
   fontes que publicaram a mesma vaga, histórico de detecção.
10. Histórico completo de vagas, inclusive encerradas.
11. Cadastro manual de vaga.
12. Painel de execuções (quando rodou, o que achou, o que falhou).

**Regras de negócio.** RN-002, RN-003 (recência só com data confiável), RN-013, RN-016, RN-017,
RN-020 (legalidade antes de funcionalidade), RN-021, RN-022 (dedupe), RN-023 (encerramento),
RN-024, RN-025 (descarte definitivo por perfil), RN-026 (filtro no servidor), RN-027, RN-028
(rate limit), RN-029 (toda execução registrada).

**Dados necessários.** `job_sources`, `user_job_sources`, `search_profiles`, `companies`, `jobs`,
`job_raw_payloads`, `job_duplicates`, `job_matches`, `collector_queue`, `collector_runs`,
`company_blocklist`.

**Ações do usuário.** Criar/editar/duplicar/ativar/desativar perfil de busca; escolher fontes;
disparar coleta; filtrar e ordenar; abrir vaga; salvar; descartar com motivo; enviar ao Kanban;
cadastrar vaga manual; marcar vaga como encerrada manualmente; ver execuções e erros.

**Automações.**
- `POST /api/cron/collect-jobs` (diário): enfileira e processa lotes.
- `POST /api/cron/close-stale-jobs` (diário): aplica RN-023.
- `POST /api/cron/recalc-scores` (diário): recalcula scores afetados por decurso de prazo
  (uma vaga de 20h vira de 30h e muda o componente de recência).
- Marcação automática de fonte como `degraded` após 5 falhas consecutivas, com notificação.

**Dependências.** Autenticação e perfis de busca (Fase 1–2); Opportunity Score (módulo 7);
monitoramento de recrutadores (módulo 6) para o componente de recrutador — ausente, o componente
fica indisponível e o score é normalizado.

**Integrações externas.** Fontes de vagas conforme documento 14. **Nenhuma fonte é presumida
disponível:** a Fase 2 fecha com, no mínimo, um adaptador manual/RSS funcionando, e o sistema
opera com qualquer subconjunto de fontes.

**Critérios de conclusão.**
- [ ] Dois adaptadores distintos implementados e testados com fixture (sem rede).
- [ ] Adicionar um terceiro adaptador exige apenas novo arquivo + linha no registry + seed; provado
      por exercício real durante a entrega.
- [ ] Coleta agendada roda e registra `collector_runs` com todos os contadores.
- [ ] Duas fontes publicando a mesma vaga produzem uma entrada visível e um registro em
      `job_duplicates`.
- [ ] Vaga sem data confiável **nunca** aparece rotulada como "publicada há X"; aparece como
      "detectada em".
- [ ] Falha simulada de uma fonte não impede as demais e fica registrada.
- [ ] Vaga descartada não reaparece no mesmo perfil de busca.
- [ ] Fonte com `legal_status != 'allowed'` não é executada nem com flag ligada (teste
      automatizado).

---

## Módulo 3 — Kanban de candidaturas

**Objetivo.** Ser o registro único e confiável de todo processo seletivo em andamento, de forma
que o usuário nunca perca um follow-up nem esqueça em que pé está cada empresa.

**Funcionalidades.**
1. Dez colunas (RN-051), com contador e soma de score por coluna.
2. Arrastar e soltar entre colunas, com persistência otimista e alternativa por teclado.
3. Cartão com empresa, cargo, score, dias no estágio, próxima ação, selos (estagnado, atrasado,
   vaga encerrada, remoto).
4. Painel de detalhe: dados da vaga, linha do tempo de eventos, notas, contatos, anexos,
   currículo usado, recrutador vinculado, proposta vinculada.
5. Linha do tempo imutável de eventos.
6. Próxima ação com data e geração de notificação.
7. Arquivamento e filtros (por empresa, estágio, score, período, estagnados).
8. Métricas do funil: taxa de conversão entre estágios e tempo médio por estágio.

**Regras de negócio.** RN-050 (candidatura independente da vaga), RN-051 (estágios e transições),
RN-052 (terminais), RN-053 (uma ativa por vaga), RN-054 (histórico imutável), RN-055
(estagnação), RN-056 (próxima ação é data).

**Dados necessários.** `applications`, `application_events`, `interviews`, `jobs` (opcional),
`companies`, `recruiters`, `resumes`, `documents`, `job_offers`.

**Ações do usuário.** Criar candidatura (de vaga ou manual); mover estágio; editar; registrar
nota/contato/entrevista; definir próxima ação; anexar documento; vincular recrutador e currículo;
arquivar; excluir; exportar quadro em CSV.

**Automações.** Criação automática ao enviar vaga do radar; `applied_at` automático ao entrar em
`applied`; marcação de estagnado (rotina diária); notificação de follow-up vencido e de entrevista
em 24h; limpeza de `next_action` ao entrar em estado terminal.

**Dependências.** Job Radar (origem das vagas); CRM (vínculo de recrutador, Fase 4); biblioteca
(anexos, Fase 5). Funciona sem nenhum deles, com cadastro manual.

**Integrações externas.** Nenhuma na Fase 2. Exportação `.ics` de entrevistas é opcional
(Fase 5).

**Critérios de conclusão.**
- [ ] Mover cartão persiste em ≤ 1 s e reverte visualmente em erro simulado.
- [ ] Toda transição gera evento; tentativa de `UPDATE`/`DELETE` em `application_events` é negada
      pela RLS (teste).
- [ ] Vaga encerrada na origem mantém a candidatura íntegra e exibe o selo.
- [ ] Cartão estagnado aparece destacado e no dashboard.
- [ ] Operável inteiramente por teclado.

---

## Módulo 4 — LinkedIn Analyzer

**Objetivo.** Transformar o perfil do LinkedIn, que é o principal ponto de contato com
recrutadores, em um ativo auditável: identificar o que está fraco, explicar o impacto, mostrar
como corrigir com exemplo pronto, priorizar e medir a evolução ao longo do tempo. Detalhe completo
no **documento 09**.

**Funcionalidades.**
1. Quatro formas de entrada: URL pública (quando acessível), texto colado, PDF exportado pelo
   usuário, formulário manual.
2. Relatório de cobertura: o que foi detectado, o que não foi e como fornecer.
3. Avaliação de 13 seções com nota individual e score geral ponderado.
4. Para cada achado: problema, impacto, correção, exemplo de texto melhorado, prioridade
   calculada.
5. Comparação lado a lado original versus otimizado, seção por seção, com cópia em um clique.
6. Histórico de auditorias, comparação entre duas auditorias e gráfico de evolução.
7. Rastreamento de recomendações (pendente/aplicada/ignorada) com data.
8. Alinhamento do perfil a um perfil de busca escolhido (palavras-chave da área-alvo versus
   presentes).

**Regras de negócio.** RN-060 (a entrada determina o escopo; seção não avaliável não recebe zero),
RN-061 (URL pública não é garantida; sem tentativa de burla), RN-062 (pesos declarados), RN-063
(cinco partes obrigatórias), RN-064 (prioridade calculada), RN-065 (exemplo é reescrita, não
criação — `[PREENCHER: ...]` quando falta informação), RN-066 (auditorias imutáveis e
comparáveis), RN-067 (PDF é dado sensível), RN-007 e RN-073 (anti-invenção e saída validada).

**Dados necessários.** `linkedin_audits`, `linkedin_audit_sections`, `linkedin_audit_findings`,
`linkedin_profile_versions`, `documents` (PDF), `career_profiles` e `search_profiles` (para
alinhamento), `ai_runs`.

**Ações do usuário.** Escolher forma de entrada; colar texto / enviar PDF / informar URL /
preencher formulário; revisar o snapshot extraído antes de analisar (obrigatório); disparar
análise; ler achados por prioridade; copiar textos sugeridos; marcar recomendação como aplicada
ou ignorada; comparar com auditoria anterior; excluir auditoria.

**Automações.** Análise assíncrona com status consultável; extração de texto de PDF no upload;
cálculo de score e prioridade determinístico (não é a IA que calcula o score — a IA avalia
seções e devolve notas e achados estruturados; o somatório ponderado é código);
cache por hash da entrada (RN-071).

**Dependências.** API de IA; Storage (PDF); perfil profissional (para checar coerência entre o
que o usuário declara no CareerOS e o que está no perfil público — divergência é um achado
legítimo).

**Integrações externas.** Leitura de URL pública **tratada como best-effort** e opcional. O módulo
é especificado para funcionar 100% sem acesso ao LinkedIn, com texto colado ou PDF. Nenhuma
automação de conta, nenhum login, nenhuma API privada.

**Critérios de conclusão.**
- [ ] As quatro entradas funcionam; a de URL falha graciosamente e oferece as alternativas.
- [ ] Seção sem dado aparece como "não avaliada" e é excluída da normalização do score.
- [ ] Todo achado tem as cinco partes; achado incompleto é rejeitado pelo validador (teste).
- [ ] Validador anti-invenção rejeita saída com empresa, cargo, data, número ou tecnologia
      ausente na entrada (teste com caso preparado).
- [ ] Duas auditorias geram comparação e gráfico de evolução.
- [ ] Marcar recomendação como aplicada persiste com data e aparece no dashboard.
- [ ] Excluir auditoria remove o PDF do Storage.

---

## Módulo 5 — AI Career Assistant

**Objetivo.** Converter o material real do usuário (perfil, currículo, vaga, histórico) em
artefatos de candidatura de qualidade — análise de vaga, currículo adaptado, carta, mensagem a
recrutador e simulação de entrevista — sem inventar nada e com custo controlado.

**Funcionalidades.**
1. **Análise de vaga:** requisitos obrigatórios versus desejáveis, lacunas em relação ao perfil,
   pontos fortes a destacar, perguntas a fazer ao recrutador, sinais de alerta (ex.: descrição
   genérica, salário ausente, excesso de requisitos para a senioridade).
2. **Currículo adaptado:** reordenação e reescrita de bullets do currículo mestre para uma vaga,
   mantendo todos os fatos; diff lado a lado contra o mestre.
3. **Carta de apresentação e mensagem curta** a recrutador, com tom configurável (formal,
   neutro, direto) e limite de caracteres.
4. **Simulação de entrevista:** geração de perguntas prováveis a partir da vaga e do perfil,
   resposta por texto do usuário, avaliação com pontos fortes, pontos a melhorar e sugestão de
   estrutura (contexto–ação–resultado).
5. **Estimativa de aderência a ATS:** palavras-chave presentes/ausentes, estrutura e legibilidade,
   declarada como heurística.
6. Histórico de artefatos por vaga/candidatura, com modelo, versão de prompt e data.
7. Painel de consumo e teto de custo.

**Regras de negócio.** RN-006 (rastreabilidade), RN-007 (nenhum fato inventado), RN-070 (teto
bloqueia), RN-071 (cache), RN-072 (contexto por lista de permissão), RN-073 (saída estruturada),
RN-074 (modelo por tarefa), RN-075 (a IA não age nem decide).

**Dados necessários.** `assistant_threads`, `assistant_messages`, `ai_runs`, `resumes`,
`career_profiles`, `experiences`, `user_skills`, `jobs`, `applications`, `interviews`,
`user_limits`.

**Ações do usuário.** Pedir análise de vaga; gerar currículo adaptado e salvar como nova versão;
gerar carta/mensagem e copiar; iniciar simulação, responder, receber avaliação; aceitar ou
descartar cada sugestão; definir teto de custo; apagar histórico.

**Automações.** Nenhuma chamada automática de IA (RNF-COST-03). Tudo é disparado pelo usuário.
Exceção permitida e configurável: ao enviar vaga ao Kanban, oferecer análise com custo estimado
exibido — nunca executar sem clique.

**Dependências.** Perfil profissional e currículo mestre (sem eles, o assistente recusa com
mensagem explicando o que falta); API de IA.

**Integrações externas.** API de IA somente.

**Critérios de conclusão.**
- [ ] As cinco funcionalidades operam com saída validada por Zod.
- [ ] Custo registrado em `ai_runs` para 100% das chamadas; teto bloqueia de fato (teste).
- [ ] Currículo adaptado não contém nenhum fato ausente no mestre (teste com caso preparado).
- [ ] Cache evita segunda cobrança para entrada idêntica (teste).
- [ ] Indisponibilidade da IA não quebra nenhuma outra tela.
- [ ] Toda saída exibe modelo, versão de prompt e data.

---

## Módulo 6 — Recruiter CRM

**Objetivo.** Tratar relacionamento com recrutadores como ativo de longo prazo: quem são, em que
empresa estão, o que publicaram, o que foi conversado e qual o próximo passo — sem depender da
memória do usuário. Detalhe do mecanismo de detecção de atividade no **documento 07**.

**Funcionalidades.**
1. Cadastro de recrutadores (nome, headline, empresa, perfil público, especialidades, canais).
2. Cadastro de empresas (site, carreiras, setor, porte, local, notas, status alvo/vetada).
3. Registro de interações: data, canal, direção, assunto, notas, resultado.
4. Follow-up com data e notificação.
5. Linha do tempo unificada por recrutador: atividades públicas detectadas (com evidência) +
   interações do usuário.
6. Classificação de atividade visível (Ativo recentemente / Possivelmente ativo / Sem atividade
   identificada) com a evidência e a data que a sustentam.
7. Visão por empresa: vagas coletadas, candidaturas, recrutadores, histórico.
8. Detecção de duplicidade com sugestão de mesclagem.
9. Alerta de vaga nova em empresa alvo.

**Regras de negócio.** RN-040 a RN-046 (evidência datada, janelas de classificação, perfil não é
atividade, exclusão sob demanda, recrutador global versus anotação pessoal), RN-013 (empresa
vetada), RN-091 (nenhuma senha externa), RN-090 (nenhuma ação em nome do usuário).

**Dados necessários.** `recruiters`, `recruiter_activities`, `recruiter_contacts`, `companies`,
`company_blocklist`, `company_watchlist`, `jobs`, `applications`.

**Ações do usuário.** Criar/editar/excluir recrutador e empresa; registrar interação; agendar
follow-up; mesclar duplicatas; marcar empresa como alvo ou vetada; adicionar atividade observada
manualmente; vincular recrutador a candidatura; gerar mensagem de abordagem (via módulo 5).

**Automações.** Vinculação automática recrutador↔vaga quando a fonte expõe o responsável
(RN-043); recálculo diário da classificação de atividade (RN-044); notificação de follow-up
vencido; alerta de vaga nova em empresa alvo; sugestão de duplicidade por nome normalizado e
domínio.

**Dependências.** Job Radar (vagas e responsáveis); notificações; módulo 5 para redigir
mensagens.

**Integrações externas.** Somente sinais públicos coletados por fontes permitidas (documento 14).
**Não há** integração com LinkedIn para listar ou monitorar recrutadores. Entrada manual é
cidadã de primeira classe neste módulo — e, na prática, será a principal.

**Critérios de conclusão.**
- [ ] Recrutador sem evidência de atividade exibe "Sem atividade identificada", nunca "ativo".
- [ ] Teste unitário garante que atualização de perfil ou perfil existente não eleva a
      classificação (RN-042).
- [ ] Toda classificação exibida vem acompanhada de evidência clicável e data.
- [ ] Classificação muda sozinha por decurso de prazo (teste com dado de 14 e 15 dias).
- [ ] Follow-up vencido gera notificação e aparece no dashboard.
- [ ] Exclusão de recrutador remove atividades e contatos vinculados.

---

## Módulo 7 — Career Intelligence

**Objetivo.** Usar as vagas que o próprio sistema coletou para responder perguntas de mercado com
números defensáveis: quanto pagam, o que exigem, o que está crescendo e onde estão as lacunas do
usuário.

**Funcionalidades.**
1. Estatísticas salariais por cargo/área/senioridade/local: mediana, p25, p75, mínimo, máximo,
   com `n` e período.
2. Tecnologias e competências mais exigidas, com frequência absoluta e relativa.
3. Tendência entre dois períodos (ex.: últimos 30 dias versus 30 anteriores), com variação
   percentual e `n` de cada período.
4. Comparação "mercado versus você": competências exigidas que o usuário não tem, priorizadas por
   frequência × peso salarial.
5. Distribuição de modalidade e tipo de contratação.
6. Empresas que mais publicam na área do usuário.
7. Recortes por localidade e senioridade.

**Regras de negócio.** RN-004 (amostra mínima 8; abaixo, "amostra insuficiente"), RN-005 (salário
informado não se mistura a estimado), RN-006, RN-008 (moeda e periodicidade explícitas), RN-013
(vagas de empresas vetadas fora das estatísticas), RN-001.
Adicional: **toda estatística declara que a base é o conjunto de vagas coletado pelo CareerOS, não
o mercado inteiro** — é uma amostra de conveniência, e o texto na interface diz isso.

**Dados necessários.** `jobs`, `job_skills`, `skills`, `companies`, `job_matches`, `user_skills`,
`market_insights` (snapshots periódicos para não recalcular tudo sempre).

**Ações do usuário.** Escolher cargo/área/local/senioridade e período; ver detalhe de uma
estatística (quais vagas a compõem); exportar CSV; enviar uma lacuna de competência direto para um
plano de estudo (módulo 9).

**Automações.** `POST /api/cron/compute-insights` (semanal): calcula e grava snapshots em
`market_insights`; extração de competências da descrição da vaga por dicionário determinístico
(`skills.aliases`) no momento da coleta — **sem IA**, para manter custo zero e resultado
reproduzível.

**Dependências.** Job Radar (é a fonte de tudo); dicionário de competências (seed inicial de
~300 termos com aliases); Career Growth (consome as lacunas).

**Integrações externas.** Nenhuma. Decisão explícita: **não** se usa base salarial de terceiros
nas Fases 1–5 (custo, licenciamento e risco de dado não verificável). Se entrar depois, entra como
fonte declarada, com `n` e origem próprios, nunca misturada às vagas coletadas.

**Critérios de conclusão.**
- [ ] Nenhuma estatística aparece com `n < 8`; aparece "amostra insuficiente (n=X)".
- [ ] Toda estatística exibe `n`, período e origem.
- [ ] É possível clicar em uma estatística e ver exatamente quais vagas a compõem.
- [ ] Extração de competências é determinística e testada com 20 descrições reais de fixture.
- [ ] Salário estimado nunca entra em estatística de salário informado (teste).

---

## Módulo 8 — Offer Comparator

**Objetivo.** Decidir trocar de emprego com números, não com sensação: comparar propostas e o
emprego atual em remuneração total, líquido estimado e critérios não financeiros ponderados pelo
próprio usuário.

**Funcionalidades.**
1. Cadastro de proposta: salário base, periodicidade, bônus, equity, VR/VA, plano de saúde,
   auxílios, férias, PLR, modalidade, deslocamento, tipo de contrato (CLT/PJ), observações.
2. Registro do emprego atual como linha de base.
3. Cálculo de remuneração total anual e líquido estimado, com premissas declaradas (CLT com 13º e
   1/3 de férias; PJ com alíquota efetiva informada pelo usuário).
4. Comparação lado a lado de até 4 propostas + atual, com diferencial percentual contra a atual.
5. Eixos não financeiros com pesos do usuário: aprendizado, estabilidade, flexibilidade,
   qualidade da gestão, perspectiva de carreira, risco — gerando nota ponderada.
6. Custo e tempo mensal de deslocamento no cálculo.
7. Simulação de contraproposta ("quanto preciso pedir para empatar/ganhar X%").
8. Registro da decisão e do motivo.

**Regras de negócio.** RN-080 (premissas declaradas e versionadas), RN-081 (fórmula CLT),
RN-082 (PJ versus CLT é aproximado; FGTS/estabilidade como diferenças qualitativas), RN-083
(deslocamento no líquido; tempo não convertido em dinheiro), RN-084 (atual é a linha de base),
RN-085 (pesos são do usuário), RN-008 (moeda e periodicidade).
Adicional: a tela exibe, em destaque permanente, que os cálculos são estimativas simplificadas e
não constituem aconselhamento fiscal ou contábil (RF-OFR-07).

**Dados necessários.** `job_offers`, `current_employment`, `offer_criteria_weights`,
`applications`, `companies`, tabelas de alíquotas versionadas em código.

**Ações do usuário.** Cadastrar/editar proposta; definir emprego atual; ajustar pesos; comparar;
simular contraproposta; registrar decisão; exportar comparação em PDF/CSV.

**Automações.** Cálculo reativo ao editar qualquer campo; sugestão de criar proposta quando uma
candidatura entra no estágio `offer`; alerta de prazo de resposta da proposta.

**Dependências.** Perfil (emprego atual); Kanban (vínculo com candidatura).

**Integrações externas.** Nenhuma. Sem consulta a API de impostos ou de custo de vida — as
alíquotas são tabela versionada no código, com `valid_from`, e o usuário pode sobrescrever a
alíquota efetiva.

**Critérios de conclusão.**
- [ ] Cálculo de remuneração total e líquido conferido contra três casos manuais documentados em
      teste (CLT, PJ, CLT com benefícios).
- [ ] Toda comparação exibe as premissas usadas e a versão da tabela de alíquotas.
- [ ] Comparação funciona com 1, 2 e 4 propostas, com e sem emprego atual cadastrado.
- [ ] Ressalva de "não é aconselhamento fiscal" visível em toda tela de cálculo.
- [ ] Pesos do usuário alteram a nota ponderada de forma visível e reversível.

---

## Módulo 9 — Career Growth

**Objetivo.** Ligar a busca de emprego ao desenvolvimento: transformar as lacunas identificadas
pelo mercado e pelas vagas em um plano com competências, itens de estudo, metas e progresso
medido.

**Funcionalidades.**
1. Inventário de competências do usuário: nível 1–5, anos de prática, evidência (projeto,
   certificação, experiência).
2. Cargo-alvo e quadro de lacunas (atual versus exigido), alimentado por Career Intelligence.
3. Plano de desenvolvimento com itens tipados (curso, livro, certificação, projeto, prática),
   custo, horas estimadas, prazo, status.
4. Progresso por horas e por itens; linha do tempo de execução.
5. Metas de carreira mensuráveis (métrica, valor-alvo, prazo) com acompanhamento.
6. Linha do tempo de marcos profissionais.
7. Sugestão de temas de estudo para as lacunas priorizadas.

**Regras de negócio.** RN-007 e RN-075 (nenhuma criação de fato; nenhuma decisão automática),
RN-070 a RN-074 (uso de IA), RN-004 (lacuna derivada de estatística respeita amostra mínima).
Adicional **RN-GRW**: o sistema **não inventa cursos, provedores, preços nem URLs**. Sugestão sem
fonte verificável é apresentada como *tema de estudo* ("Aprofundar: redes — VLAN e roteamento"),
e o usuário cadastra o curso concreto que escolher (RF-GRW-07).

**Dados necessários.** `skills`, `user_skills`, `career_goals`, `learning_plans`,
`learning_items`, `career_milestones`, `market_insights`, `career_profiles`.

**Ações do usuário.** Cadastrar/avaliar competências; definir cargo-alvo; criar plano; adicionar,
concluir e reordenar itens; lançar horas; criar metas e atualizar progresso; registrar marcos;
transformar lacuna em item de plano em um clique.

**Automações.** Recálculo do quadro de lacunas quando `market_insights` é atualizado;
recálculo de progresso ao concluir item; notificação de item com prazo próximo e de meta vencendo;
sugestão de atualizar o nível da competência quando um item relacionado é concluído (sugestão,
nunca alteração automática — RN-075).

**Dependências.** Career Intelligence (lacunas); perfil profissional (competências).

**Integrações externas.** Nenhuma. Catálogos de cursos ficam fora de escopo por decisão explícita.

**Critérios de conclusão.**
- [ ] Quadro de lacunas deriva de `market_insights` e declara `n` e período.
- [ ] Nenhuma sugestão de estudo contém nome de curso, provedor ou URL inventados (teste de
      validador).
- [ ] Progresso do plano calculado por horas e por itens, conferido em teste.
- [ ] Lacuna vira item de plano em um clique, preservando o vínculo com a competência.

---

## Módulo 10 — Biblioteca profissional

**Objetivo.** Centro único e privado de todo material profissional: currículos versionados,
certificados, diplomas, cartas, PDFs de perfil, propostas e links — encontrável em segundos no
momento em que o recrutador pede.

**Funcionalidades.**
1. Upload para bucket privado, com validação de tipo e tamanho.
2. Categorias tipadas, etiquetas livres e busca por nome/tipo/etiqueta.
3. Versionamento de currículo com versão mestre marcada e histórico.
4. Metadados de certificação: emissor, data de emissão, validade.
5. Links profissionais categorizados.
6. Pré-visualização de PDF e imagem; download por URL assinada de curta duração.
7. Cota de armazenamento com indicador de uso.
8. Vínculo de documento a candidatura, auditoria ou proposta.

**Regras de negócio.** RN-067 (documentos são sensíveis), RNF-SEC-05 (bucket privado, URL
assinada ≤ 5 min), RF-BIB-07 (validação de MIME e tamanho), RF-BIB-08 (exclusão real do arquivo),
RN-094 (exclusão de conta remove arquivos), RN-101 (`STORAGE_QUOTA_MB`, `MAX_UPLOAD_MB`).
Adicional: caminho no Storage é sempre `{user_id}/{kind}/{uuid}.{ext}` — a política de Storage
depende disso.

**Dados necessários.** `documents`, `document_links`, `resumes`, `resume_versions`,
`certifications`, `user_limits`.

**Ações do usuário.** Enviar, renomear, etiquetar, categorizar, pré-visualizar, baixar, excluir;
marcar currículo mestre; comparar versões de currículo; cadastrar links; vincular documento a
candidatura.

**Automações.** Extração de texto de PDF no upload (para busca e para alimentar o LinkedIn
Analyzer e o assistente); notificação de certificação vencendo em 30 dias; cálculo de cota;
expurgo de arquivos órfãos (rotina semanal).

**Dependências.** Storage; LinkedIn Analyzer e assistente de IA consomem os textos extraídos.

**Integrações externas.** Nenhuma. Sem Google Drive, sem Dropbox — decisão por simplicidade e
privacidade.

**Critérios de conclusão.**
- [ ] Upload rejeita tipo não permitido e arquivo acima do limite, com mensagem clara em pt-BR.
- [ ] Usuário A não consegue acessar arquivo do usuário B nem com o caminho exato (teste de
      política de Storage).
- [ ] URL assinada expira em 5 min (teste).
- [ ] Excluir documento remove a linha e o objeto no Storage.
- [ ] Cota respeitada e exibida.

---

## Módulo 11 — Modo busca discreta

**Objetivo.** Garantir que procurar emprego pelo CareerOS não crie risco no emprego atual — nem
por notificação na tela, nem por e-mail com assunto revelador, nem por vaga da própria empresa
aparecendo no radar, nem por alguém olhando o monitor.

**Funcionalidades.**
1. Interruptor global de modo discreto, com indicador visível de estado.
2. Título de página e nome da aba neutros e configuráveis (padrão: "Painel").
3. Supressão de notificações imediatas: somente resumo diário, em horário escolhido.
4. E-mail com assunto e remetente neutros configuráveis.
5. Lista de empresas vetadas (a atual entra por sugestão automática) cujas vagas não aparecem.
6. Modo de privacidade visual: salários e nomes de empresa ocultos até revelar (clique ou atalho).
7. Bloqueio por PIN após inatividade configurável.
8. Desativação do registro de logs de atividade.
9. Declaração permanente de que o sistema não executa nenhuma ação em plataformas externas em
   nome do usuário.

**Regras de negócio.** RN-090 (nenhuma ação externa), RN-091 (nenhuma senha externa), RN-092
(modo discreto afeta todos os canais), RN-093 (empresa atual sugerida para vetadas), RN-013
(vetadas têm precedência absoluta), RF-DIS-06 (nenhuma rota pública com dado do usuário),
RNF-PRIV-05 (desativar logs).
Adicional: o PIN é armazenado apenas como hash (Argon2id ou bcrypt) e **não** é mecanismo de
segurança contra atacante remoto — é proteção contra olhar casual; isso é dito ao usuário.

**Dados necessários.** `user_settings` (`stealth_mode`, `neutral_title`, `quiet_hours`,
`digest_time`, `pin_hash`, `pin_timeout_minutes`, `mask_sensitive_values`, `activity_logging`),
`company_blocklist`.

**Ações do usuário.** Ativar/desativar modo discreto; configurar título, horário de resumo,
assunto de e-mail; gerenciar empresas vetadas; definir/remover PIN; alternar máscara de valores;
desativar logs.

**Automações.** Aplicação do modo em todos os canais de notificação; consolidação do resumo
diário; bloqueio automático por inatividade; sugestão de vetar a empresa atual ao cadastrá-la.

**Dependências.** Notificações, configurações, Job Radar (filtro de vetadas).

**Integrações externas.** Nenhuma.

**Critérios de conclusão.**
- [ ] Com modo discreto ativo, nenhuma notificação imediata é emitida em nenhum canal (teste).
- [ ] Assunto de e-mail não contém termos relacionados a emprego quando o modo está ativo.
- [ ] Vaga de empresa vetada não aparece em radar, dashboard, estatística nem notificação (teste).
- [ ] PIN bloqueia a interface após o tempo configurado; PIN armazenado apenas como hash.
- [ ] Máscara oculta salário e empresa até ação explícita.
- [ ] Nenhuma rota da aplicação responde sem sessão (teste automatizado varrendo as rotas).

---

## Módulo 12 — Configurações

**Objetivo.** Dar ao usuário controle explícito sobre conta, aparência, fontes de dados, custo de
IA, parâmetros de regra, privacidade e credenciais próprias — e ser honesto sobre o que cada
integração pode ou não fazer.

**Funcionalidades.**
1. **Conta:** dados básicos, troca de e-mail e senha, sessões, exclusão de conta, exportação de
   dados.
2. **Aparência:** tema (escuro padrão / claro), densidade de interface, idioma (pt-BR),
   fuso horário.
3. **Fontes de vagas:** lista com nome, tipo, status (`allowed` / `review_needed` /
   `disallowed` / `requires_user_key`), link para os termos de uso, limite de requisições,
   última execução, últimos erros, interruptor de ativação. **Fonte não permitida aparece
   desabilitada com o motivo escrito**, não escondida.
4. **IA:** teto mensal, consumo acumulado, modelo por tarefa (leitura), histórico de custo,
   limpeza de cache.
5. **Regras:** janela de recência padrão, score mínimo para notificar, dias para estagnação,
   pesos do score (Fase 4).
6. **Notificações:** canais, tipos, horário silencioso, horário do resumo.
7. **Privacidade:** modo discreto, empresas vetadas, logs, retenção, PIN.
8. **Credenciais próprias:** chaves de API que o usuário possua, cifradas, exibidas apenas pelos
   últimos 4 caracteres. **Campo de senha de plataforma não existe no sistema.**
9. **Diagnóstico:** saúde das fontes, últimas execuções, últimos erros, versão do app e do score.

**Regras de negócio.** RN-091 (nenhuma senha externa; chave cifrada e nunca retornada),
RN-100/RN-101 (o que é configurável versus o que é constante de integridade), RN-020 (status legal
da fonte é exibido e respeitado), RN-070 (teto de IA), RF-CFG-07 (declarar disponibilidade real
de cada integração).

**Dados necessários.** `profiles`, `user_settings`, `user_limits`, `job_sources`,
`user_job_sources`, `integration_credentials`, `ai_runs`, `collector_runs`, `audit_logs`.

**Ações do usuário.** Editar qualquer configuração; ativar/desativar fonte; definir teto; gerenciar
chaves; exportar dados; excluir conta; ver diagnóstico; redefinir configurações para o padrão.

**Automações.** Validação de chave ao salvar (chamada de teste quando a fonte permitir);
notificação quando fonte fica degradada; reinício mensal do contador de custo de IA.

**Dependências.** Todos os módulos leem configuração daqui. É entrega da Fase 1 (conta e
aparência), expandida nas fases seguintes.

**Integrações externas.** Apenas verificação de credencial fornecida pelo usuário, quando
aplicável.

**Critérios de conclusão.**
- [ ] Tema persiste entre sessões e não pisca ao carregar.
- [ ] Fonte com `legal_status != 'allowed'` aparece desabilitada com motivo em pt-BR.
- [ ] Teto de IA bloqueia chamadas quando atingido (teste).
- [ ] Chave de API salva não é legível depois (apenas últimos 4 caracteres).
- [ ] Exclusão de conta remove todos os dados e arquivos (teste em base de desenvolvimento).
- [ ] Exportação gera JSON completo e importável.
- [ ] Nenhum campo em todo o sistema solicita senha de plataforma externa (revisão de código
      documentada).
