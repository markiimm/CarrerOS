# 03 — Regras de Negócio

**Convenção:** `RN-<nº>`. Estas regras são **normativas**: a implementação deve seguí-las
literalmente. Quando uma regra define constante, ela deve viver em `lib/config/rules.ts` (ou em
`user_limits`, quando configurável), nunca espalhada pelo código.

---

## Grupo A — Integridade e honestidade de dados

> Este grupo é o coração do produto. Qualquer dúvida de implementação se resolve pelo princípio:
> **é melhor exibir "não identificado" do que exibir um número que ninguém pode defender.**

**RN-001 — Proibição de dado inferido silenciosamente.**
Nenhum campo exibido como fato pode ter origem em estimativa, dedução ou geração de IA sem que
isso esteja (a) registrado em coluna `*_source`/`*_confidence` ou campo `evidence`, e (b)
sinalizado na interface.

**RN-002 — Data de publicação.**
`jobs.published_at` só é preenchido quando a fonte fornece a data. A origem é registrada em
`published_at_source` com um de: `api_field` (campo estruturado da fonte), `page_metadata`
(JSON-LD `JobPosting.datePosted`, `meta` ou `<time datetime>`), `http_header` (`Last-Modified`),
`source_relative` (texto como "há 2 dias", convertido, confiança `approximate`),
`first_seen` (inferido, confiança `unknown`).
A confiança é:
- `exact` — data absoluta com dia definido, vinda de `api_field` ou `page_metadata`;
- `approximate` — derivada de texto relativo ou cabeçalho HTTP;
- `unknown` — não obtida; nesse caso `published_at` recebe `first_seen_at` **apenas para
  ordenação**, e a interface exibe "detectada em", nunca "publicada em".

**RN-003 — Filtro de recência só considera data confiável.**
Uma vaga entra no resultado de uma janela de recência (24h/3d/7d/15d) se:
`published_at_confidence IN ('exact','approximate') AND published_at >= now() - janela`
**OU** `published_at_confidence = 'unknown' AND first_seen_at >= now() - janela`.
No segundo caso, a vaga recebe o selo "data não confirmada" e o componente de recência do score
é tratado como dado ausente (ver RN-030).

**RN-004 — Estatística exige amostra mínima.**
Nenhuma estatística de mercado é exibida com amostra inferior a `MIN_SAMPLE_SIZE` (padrão: 8).
Abaixo disso, a interface exibe "amostra insuficiente (n=X)". Toda estatística exibida declara
`n`, período e origem.

**RN-005 — Salário informado nunca se mistura a salário estimado.**
`jobs.salary_is_estimated = true` quando o valor vier de inferência (ex.: faixa textual
ambígua, conversão de periodicidade). Estatísticas salariais usam apenas
`salary_is_estimated = false`, e informam quantas vagas foram excluídas por falta de dado.

**RN-006 — Toda recomendação de IA é rastreável.**
Qualquer artefato gerado por IA grava `model`, `prompt_version`, `created_at` e o identificador
da execução em `ai_runs`. Artefato sem essa rastreabilidade não é exibido.

**RN-007 — Proibição de criação de fato sobre a vida do usuário.**
A IA não pode afirmar, sugerir como texto final, ou inserir em currículo/perfil: empresa, cargo,
período, certificação, formação, tecnologia, número, percentual ou resultado que não exista nos
dados fornecidos pelo usuário. Quando a melhoria depender de informação inexistente, o texto
sugerido deve conter marcador no formato `[PREENCHER: descrição do que falta]`. Saída que
contenha afirmação não suportada deve ser rejeitada pelo validador (documento 20 §5).

**RN-008 — Moeda e periodicidade sempre explícitas.**
Nenhum valor monetário é armazenado sem `currency` (ISO-4217) e, para salário, `salary_period`
(`hour`, `month`, `year`). Conversões para comparação são calculadas na exibição, nunca
sobrescrevendo o valor original.

---

## Grupo B — Perfis profissionais e perfis de busca

**RN-010 — Separação entre perfil profissional e perfil de busca.**
*Perfil profissional* descreve **quem o usuário é** (competências, experiências, senioridade).
*Perfil de busca* descreve **o que ele procura** (filtros). A relação é N:N na prática, modelada
como: um perfil de busca referencia zero ou um perfil profissional
(`search_profiles.career_profile_id`). Sem perfil profissional vinculado, o componente de
compatibilidade do score é dado ausente.

**RN-011 — Multiplicidade obrigatória.**
O sistema nunca restringe o usuário a um cargo ou área. Perfis de busca ativos são processados
todos em cada ciclo de coleta, de forma independente.

**RN-012 — Independência de filtros.**
Nenhum filtro de um perfil de busca influencia outro. Não há filtro global, exceto a lista de
empresas vetadas (RN-013) e as fontes desabilitadas pelo usuário em Configurações.

**RN-013 — Empresas vetadas têm precedência absoluta.**
Vaga cuja empresa esteja em `company_blocklist` do usuário não é exibida em nenhum módulo, não
gera notificação e não entra em estatística — independentemente do score. A vaga permanece no
catálogo global, apenas o `job_match` é criado com `status='blocked'` ou não é criado
(preferência: não criar, registrando o motivo no contador do run).

**RN-014 — Perfil de busca inativo não coleta.**
Somente `search_profiles.is_active = true` entram na fila. Desativar preserva histórico.

**RN-015 — Limite de perfis ativos.**
Máximo de `MAX_ACTIVE_SEARCH_PROFILES` (padrão: 10, configurável em `user_limits`). Tentativa de
ativar o 11º retorna erro de validação explicativo.

**RN-016 — Palavras-chave excluídas vencem palavras-chave incluídas.**
Se o título ou a descrição da vaga casar com qualquer `excluded_keywords`, a vaga é descartada
para aquele perfil, mesmo que case com todas as palavras-chave incluídas.

**RN-017 — Janela de recência válida.**
Valores aceitos: 24, 72, 168 e 360 horas. Qualquer outro valor é rejeitado na validação.

---

## Grupo C — Coleta de vagas (Job Radar)

**RN-020 — Legalidade precede funcionalidade.**
O núcleo do coletor recusa executar adaptador de fonte com `job_sources.legal_status` diferente
de `allowed`. Os valores possíveis são: `allowed` (API oficial, feed público ou permissão
explícita), `review_needed` (não avaliada — não executa), `disallowed` (proibida por ToS ou
robots.txt — não executa, nem com flag), `requires_user_key` (executa somente se o usuário
tiver fornecido a própria credencial da fonte).

**RN-021 — Identidade de vaga e deduplicação.**
Duas chaves:
1. **Identidade na fonte:** `UNIQUE (source_id, external_id)`. Mesma vaga re-coletada da mesma
   fonte faz `UPDATE` de `last_seen_at` e dos campos mutáveis, nunca `INSERT`.
2. **Identidade entre fontes (`fingerprint`):** hash SHA-256 de
   `normalize(title) | normalize(company) | normalize(city) | work_model`.
   `normalize` = minúsculas, sem acentos, sem pontuação, sem sufixos de senioridade
   duplicados, espaços colapsados.
Ao inserir, se existir vaga com mesmo `fingerprint` nos últimos 45 dias, a nova linha é criada e
registrada em `job_duplicates` apontando para a mais antiga (`canonical`), com `similarity` e
`strategy`. A interface exibe apenas a canônica, listando as outras fontes.

**RN-022 — Deduplicação de segundo nível (probabilística).**
Quando `fingerprint` não casa, compara-se similaridade de título (`pg_trgm`, limiar 0,82) **e**
igualdade de empresa normalizada **e** mesma cidade. Casando, registra-se duplicata com
`strategy='fuzzy'` e `similarity` real. Abaixo do limiar, são vagas distintas.
Nenhuma mesclagem é destrutiva: as duas linhas permanecem.

**RN-023 — Encerramento de vaga.**
Vaga ativa que não apareça em `CLOSE_AFTER_MISSES` (padrão: 3) execuções consecutivas da mesma
fonte, estando a fonte com execução bem-sucedida, recebe `is_active=false` e `closed_at=now()`.
Fonte que falhou **não** conta como ausência. Vaga encerrada permanece visível em candidaturas e
no histórico, com selo "vaga encerrada".

**RN-024 — Um `job_match` por (usuário, perfil de busca, vaga).**
Garantido por índice único. Reexecução atualiza score e `matched_at` apenas se o score mudar.

**RN-025 — Descarte é definitivo por perfil.**
`job_match.status='dismissed'` com `dismissed_reason`. A vaga não reaparece naquele perfil de
busca. Pode aparecer em outro perfil, e isso é intencional. Vaga descartada não gera notificação
e não conta como "nova".

**RN-026 — Filtro no servidor, não na interface.**
Todo filtro de perfil de busca é aplicado durante a coleta/indexação; a interface filtra apenas o
que já foi persistido. Isso evita exibir vaga que o usuário excluiu por filtro.

**RN-027 — Rate limit por fonte é respeitado em nível global.**
`job_sources.rate_limit_per_min` é aplicado por fonte, somando todos os usuários e perfis.
O coletor serializa requisições à mesma fonte e aplica espera.

**RN-028 — Coleta manual é limitada.**
Máximo de `MANUAL_RUNS_PER_HOUR` (padrão: 5) por usuário. Excedido, retorna 429 com tempo de
espera. Coleta manual não ignora `rate_limit_per_min` da fonte.

**RN-029 — Toda execução é registrada.**
Mesmo falha total gera linha em `collector_runs` com `status='failed'` e mensagem. Execução sem
registro é bug.

---

## Grupo D — Opportunity Score

Detalhamento algorítmico no documento 08. Regras normativas:

**RN-030 — Dado ausente é neutro, não zero, e reduz a confiança.**
Quando um componente não tem dados, ele **não** recebe 0 pontos (isso penalizaria a vaga por
limitação do sistema) nem 25 (isso seria invenção). O componente é marcado `available: false`,
excluído do somatório, e o score final é **normalizado pelos componentes disponíveis**:

```
score_final = round( (soma dos pontos obtidos) / (soma dos máximos disponíveis) * 100 )
data_coverage = (soma dos máximos disponíveis) / 100
```

`data_coverage < 0,5` ⇒ o score é exibido com selo "baixa confiança" e **não** gera notificação,
por mais alto que seja.

**RN-031 — Componentes e tetos fixos.**
Recência 25, Atividade do recrutador 25, Compatibilidade 25, Qualidade 25. A soma dos máximos é
sempre 100 quando todos estão disponíveis. Pesos customizados (RF-SCR-07) reescalam os tetos,
mantendo soma 100.

**RN-032 — Score é função pura.**
`calculateOpportunityScore(input): ScoreResult` não acessa banco nem rede. Toda informação chega
pelo `input`. Isso a torna testável e recalculável.

**RN-033 — Score é versionado.**
`SCORE_VERSION` em `lib/scoring/version.ts`. Mudança de algoritmo incrementa a versão; scores
antigos permanecem com a versão antiga até recálculo explícito.

**RN-034 — Explicação é derivada, não gerada.**
O texto exibido ao usuário é montado por templates a partir do `score_breakdown`. A IA não
escreve a explicação do score. (A IA pode escrever a *análise da vaga*, que é outra coisa e vive
em outro módulo.)

**RN-035 — Sem recrutador identificado, o componente de recrutador é ausente.**
Vaga sem recrutador vinculado não perde pontos: `recruiter.available = false`. Isso evita
privilegiar artificialmente fontes que expõem recrutador.

---

## Grupo E — Recrutadores

**RN-040 — Atividade exige evidência datada.**
Um recrutador só muda de classificação com base em linha de `recruiter_activities` contendo:
`activity_type`, `occurred_at` (ou `observed_at` com confiança declarada), `url` e `excerpt`.
Sem isso, a classificação é `no_activity_found`.

**RN-041 — Classificação (janelas fixas).**
Com base na atividade **relacionada a recrutamento** mais recente (`job_post`, `recruiting_post`,
`hiring_comment`):
- `active_recent` — evidência com `occurred_at` ≤ 14 dias **e** confiança `exact` ou `approximate`;
- `possibly_active` — evidência entre 15 e 60 dias, **ou** ≤ 14 dias com confiança `unknown`,
  **ou** atividade genérica (post não relacionado a recrutamento) ≤ 14 dias;
- `no_activity_found` — nenhuma evidência, ou a mais recente > 60 dias.

**RN-042 — Perfil existente não é atividade.**
Existência de perfil público, foto, número de conexões, atualização de headline ou "aberto para
oportunidades" **não** constituem atividade de recrutamento e não podem elevar a classificação.
Esta regra é verificada por teste unitário.

**RN-043 — Vaga publicada é a evidência mais forte.**
Vaga coletada cujo responsável identificado é o recrutador gera automaticamente
`recruiter_activities` do tipo `job_post`, com `occurred_at = jobs.published_at` e herdando a
confiança da data da vaga. Se a data da vaga é `unknown`, a atividade entra com confiança
`unknown` (logo, no máximo `possibly_active`).

**RN-044 — Reclassificação por decurso de prazo.**
A classificação é recalculada (a) a cada coleta e (b) por rotina diária, pois uma evidência de 14
dias vira 15 sem nenhum evento novo. Classificação defasada é bug.

**RN-045 — Dado mínimo e direito de exclusão.**
Armazenam-se apenas dados profissionais públicos. Não se armazenam dados pessoais sensíveis, nem
contato privado obtido fora de interação com o usuário. Há exclusão completa de recrutador sob
demanda.

**RN-046 — Recrutador é global, anotação é pessoal.**
A identidade do recrutador pode ser compartilhada (`recruiters.user_id IS NULL` = global);
anotações, contatos e follow-ups são sempre do usuário (`recruiter_contacts.user_id`). No uso
pessoal atual, todo recrutador criado pelo usuário é pessoal.

---

## Grupo F — Candidaturas e Kanban

**RN-050 — Candidatura é independente da vaga.**
Ao criar candidatura a partir de uma vaga, copiam-se título, empresa, URL e salário para a
`applications`. Se a vaga for encerrada ou removida, a candidatura permanece íntegra.

**RN-051 — Estágios e transições.**
Ordem canônica: `radar(0) → interested(1) → applied(2) → screening(3) → interview(4) →
technical_test(5) → offer(6) → accepted(7)`; terminais laterais: `rejected(8)`,
`withdrawn(9)`.
Qualquer transição é permitida (processos reais pulam etapas), mas toda transição gera evento. Ir
para `applied` sem `applied_at` preenche `applied_at = now()`.

**RN-052 — Estados terminais.**
`accepted`, `rejected` e `withdrawn` encerram o processo: zeram `next_action`, permitem
arquivamento e disparam cálculo de métricas do funil. Mover de volta a partir de terminal é
permitido e registrado.

**RN-053 — Uma candidatura ativa por (usuário, vaga).**
Índice único parcial sobre `(user_id, job_id) WHERE job_id IS NOT NULL AND is_archived = false`.
Tentativa de duplicar leva à candidatura existente.

**RN-054 — Histórico é imutável.**
`application_events` é somente inserção. Correção se faz por novo evento, nunca por `UPDATE` ou
`DELETE`. Garantido por política de RLS (sem `UPDATE`/`DELETE` para o usuário).

**RN-055 — Estagnação.**
Cartão em estágio não terminal sem evento há `STALE_AFTER_DAYS` (padrão: 7) recebe marcador de
estagnado e entra em "ações pendentes" do dashboard.

**RN-056 — Próxima ação é data, não intenção.**
`next_action` só é válida com `next_action_at`. Ação com data passada é "atrasada" e aparece no
topo do dashboard.

---

## Grupo G — LinkedIn Analyzer

**RN-060 — A entrada determina o escopo da avaliação.**
Cada seção avaliável tem pré-requisito de entrada. Se o dado não estiver na entrada, a seção é
`not_evaluable` — **não** recebe nota zero e é excluída da normalização do score (mesma mecânica
do RN-030). A interface lista as seções não avaliadas e como fornecê-las.

| Seção | Avaliável por URL pública | Texto colado | PDF exportado | Formulário |
|---|---|---|---|---|
| Foto, Capa | sim (se acessível) | não | não (o PDF não traz imagens de perfil) | declaração do usuário |
| Headline, Sobre | sim | sim | sim | sim |
| Experiências, Formação, Certificações | sim | sim | sim | sim |
| Competências | sim | parcial | sim | sim |
| Projetos, Recomendações | parcial | parcial | parcial | sim |
| GitHub, Portfólio | sim (se no perfil) | sim | sim | sim |
| Palavras-chave, Clareza | sim | sim | sim | sim |

**RN-061 — URL pública não é garantida.**
A tentativa de leitura por URL deve tratar como resultado esperado: bloqueio, redirecionamento a
login, conteúdo parcial ou rejeição automatizada. Nesse caso, o sistema **não falha**: informa o
ocorrido e oferece as outras três entradas. Nenhuma tentativa de autenticação ou burla é feita.

**RN-062 — Score ponderado e declarado.**
Pesos padrão (soma 100), em `lib/linkedin/weights.ts`: headline 12, sobre 15, experiências 20,
competências 10, formação 6, certificações 6, projetos 6, palavras-chave 10, GitHub/portfólio 6,
foto 5, capa 2, clareza 12. Normalizado pelas seções avaliáveis. O peso é exibido ao usuário.

**RN-063 — Toda recomendação tem cinco partes.**
`issue`, `impact`, `how_to_fix`, `example_text`, `priority`. Recomendação incompleta é descartada
pelo validador antes de ser gravada.

**RN-064 — Prioridade é calculada, não opinada.**
`priority = round( peso_da_seção × severidade × fator_de_lacuna )`, onde severidade é
`critical=3, high=2, medium=1.5, low=1`, e `fator_de_lacuna = (1 - nota_da_seção/10)`.
Resultado ordenado decrescente. Isso torna a priorização reproduzível.

**RN-065 — `example_text` é reescrita, não criação.**
O exemplo deve usar apenas fatos presentes na entrada. Faltando informação para um bom texto,
usa-se `[PREENCHER: ...]`. O validador rejeita exemplo que contenha número, empresa, cargo,
tecnologia ou data ausente na entrada (documento 20 §5).

**RN-066 — Auditorias são imutáveis e comparáveis.**
Auditoria concluída nunca é alterada. Nova análise cria nova auditoria com
`previous_audit_id`. A comparação entre duas auditorias usa apenas seções avaliáveis em ambas, e
declara quando a base mudou (ex.: "a auditoria anterior não avaliou foto").

**RN-067 — O PDF do usuário é dado sensível.**
Armazenado em bucket privado, com exclusão em cascata ao excluir a auditoria. Enviado à IA apenas
como texto extraído, com o mínimo necessário.

---

## Grupo H — IA, custo e assistente

**RN-070 — Teto de custo bloqueia, não degrada silenciosamente.**
Atingido `user_limits.ai_monthly_cost_cap_usd`, novas chamadas retornam erro explicativo com o
consumo atual e a data de reinício do ciclo. Nenhuma chamada é feita "pela metade".

**RN-071 — Cache por hash de entrada.**
Antes de chamar a IA, calcula-se `sha256(feature | prompt_version | model | input_canônico)`.
Havendo `ai_runs` bem-sucedido com o mesmo hash nos últimos `AI_CACHE_DAYS` (padrão: 30), o
resultado é reaproveitado e marcado como `cached` na interface.

**RN-072 — Contexto por lista de permissão.**
O que vai para a IA é montado por função específica da feature, que seleciona campos
explicitamente. Proibido enviar objeto de perfil inteiro, `select *`, ou campos marcados como
sensíveis (remuneração atual, PIN, documentos não relacionados à tarefa).

**RN-073 — Saída estruturada obrigatória.**
Toda chamada usa schema de saída validado com Zod. Falha de validação gera uma única nova
tentativa com instrução de correção; falhando de novo, a operação falha e é registrada — nunca se
exibe saída não validada.

**RN-074 — Modelo por tarefa.**
Classificação, extração e normalização usam o modelo mais econômico disponível; auditoria de
LinkedIn, geração de currículo e simulação de entrevista usam o modelo mais capaz. A escolha fica
em `lib/ai/models.ts`, não espalhada nas features.

**RN-075 — A IA não decide nem age.**
A IA não move cartão, não altera score, não envia mensagem, não aplica recomendação, não altera
perfil. Toda saída é sugestão que exige confirmação do usuário.

---

## Grupo I — Propostas e comparação

**RN-080 — Premissas de cálculo são declaradas e versionadas.**
Toda comparação grava e exibe: alíquotas usadas, se considerou 13º e férias (+1/3), base de
cálculo PJ (padrão: Simples Nacional anexo III com alíquota efetiva informada pelo usuário),
encargos e período. Tabelas em `lib/offers/tax-tables.ts` com `version` e `valid_from`.

**RN-081 — Remuneração total anual (CLT).**
`base_mensal × 13 + (base_mensal/3) [1/3 de férias] + bônus_anual + (benefícios_mensais × 12) +
equity_anualizado`. Benefícios não monetários entram como valor declarado pelo usuário, nunca
estimados pelo sistema.

**RN-082 — Comparação PJ versus CLT é explicitamente aproximada.**
O resultado sempre vem acompanhado da ressalva de que não é aconselhamento fiscal/contábil, e de
que benefícios como FGTS, seguro-desemprego e estabilidade não têm equivalente direto em PJ —
listados como diferenças qualitativas, não convertidos em dinheiro sem premissa declarada.

**RN-083 — Custo de deslocamento entra no líquido.**
`custo_mensal_deslocamento × 12` é subtraído da remuneração total; o tempo mensal de
deslocamento é exibido como eixo não financeiro (horas/mês), nunca convertido em dinheiro
automaticamente.

**RN-084 — O emprego atual é sempre a linha de base.**
Toda proposta exibe o diferencial percentual contra o emprego atual registrado. Sem emprego atual
cadastrado, exibe-se a comparação apenas entre propostas, informando a ausência da linha de base.

**RN-085 — Nota ponderada é do usuário.**
Os pesos dos critérios não financeiros são definidos pelo usuário; o sistema não atribui pesos
"recomendados" sem que o usuário confirme.

---

## Grupo J — Privacidade e modo discreto

**RN-090 — Nenhuma ação em nome do usuário em plataforma externa.**
O sistema não autentica, publica, envia mensagem, aceita convite ou se candidata em qualquer
plataforma. Sem exceção, sem configuração que habilite.

**RN-091 — Nenhuma senha externa.**
O sistema nunca solicita senha de LinkedIn, e-mail ou portal de vagas. Campos de credencial
aceitam apenas chaves de API/tokens emitidos pelo próprio usuário, cifrados em repouso e nunca
retornados em leitura (apenas últimos 4 caracteres).

**RN-092 — Modo discreto afeta todos os canais.**
Ativo, altera: título do documento (configurável, padrão "Painel"), assunto e remetente de e-mail
(assunto neutro), supressão de notificações imediatas (apenas resumo diário), e ocultação de
valores sensíveis na tela.

**RN-093 — Empresa atual entra automaticamente na lista de vetadas.**
Ao registrar o emprego atual, a empresa é sugerida para a `company_blocklist`, com confirmação do
usuário.

**RN-094 — Exclusão é real.**
Exclusão de conta remove linhas e arquivos de Storage. Dados agregados anonimizados (estatísticas
de mercado sem vínculo de usuário) podem permanecer, e isso é informado.

---

## Grupo K — Limites e configuração

**RN-100 — Constantes versus configuração.**
Valores de regra que o usuário pode mudar vivem em `user_limits`/`user_settings`. Valores de
integridade do sistema (janelas de classificação, limiares de dedupe, versão de score) vivem no
código e mudam por deploy, não por configuração — para manter comparabilidade histórica.

**RN-101 — Valores padrão.**

| Constante | Padrão | Onde |
|---|---|---|
| `DEFAULT_RECENCY_HOURS` | 24 | código |
| `ALLOWED_RECENCY_HOURS` | 24, 72, 168, 360 | código |
| `MIN_SAMPLE_SIZE` | 8 | código |
| `CLOSE_AFTER_MISSES` | 3 | código |
| `FINGERPRINT_WINDOW_DAYS` | 45 | código |
| `FUZZY_TITLE_THRESHOLD` | 0,82 | código |
| `RECRUITER_ACTIVE_DAYS` | 14 | código |
| `RECRUITER_POSSIBLE_DAYS` | 60 | código |
| `STALE_AFTER_DAYS` | 7 | user_settings |
| `MAX_ACTIVE_SEARCH_PROFILES` | 10 | user_limits |
| `MANUAL_RUNS_PER_HOUR` | 5 | user_limits |
| `AI_MONTHLY_COST_CAP_USD` | 10 | user_limits |
| `AI_CACHE_DAYS` | 30 | código |
| `STORAGE_QUOTA_MB` | 500 | user_limits |
| `MAX_UPLOAD_MB` | 10 | código |
| `MIN_NOTIFY_SCORE` | 70 | user_settings / por perfil de busca |
| `DATA_RETENTION_DAYS` (logs) | 180 | user_settings |
