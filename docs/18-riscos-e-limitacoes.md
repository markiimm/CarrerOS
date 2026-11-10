# 18 — Riscos e limitações técnicas

> Este documento existe para que a IA implementadora **não descubra estes problemas tarde** e não
> tente resolvê-los violando a especificação. Cada risco tem probabilidade, impacto, mitigação já
> embutida no desenho e sinal de alerta.

## 1. Risco estrutural nº 1 — a oferta de fontes de vagas é menor do que parece

| | |
|---|---|
| **Probabilidade** | Alta (é a realidade, não um risco futuro) |
| **Impacto** | Alto — é o módulo que justifica o produto |

**O problema:** o usuário imagina "buscar em todos os sites". Na prática, LinkedIn, Indeed, Gupy,
Catho e Vagas.com **não** oferecem coleta automatizada autorizada. O que resta: ATS com quadro
público (por empresa), feeds RSS, JSON-LD e alguns agregadores com API oficial de cobertura
parcial no Brasil.

**Mitigação embutida no desenho:**
- arquitetura de adaptadores: adicionar fonte é adicionar arquivo, então o produto cresce em
  cobertura ao longo do tempo sem refatoração (doc 06 §2);
- cadastro manual de vaga em 20 segundos, entrando no mesmo pipeline (score, Kanban, recrutador);
- `jsonld-careers` e `rss-generic` cobrem qualquer empresa que publique de forma estruturada;
- empresas-alvo via ATS entregam dado **melhor** que agregador: data exata e menos concorrência.

**Reenquadramento honesto:** o CareerOS não vence por volume de vagas; vence por **qualidade de
sinal** (recência verificada, recrutador com evidência, score explicável) e por **organização**.
Um radar com 25 vagas certas por dia é melhor que 400 vagas repetidas e velhas.

**Sinal de alerta:** menos de 10 vagas novas por dia após a Fase 2 com fontes ativas ⇒ ampliar a
lista de empresas-alvo e cadastrar feeds, antes de considerar qualquer atalho proibido.

## 2. Risco nº 2 — "atividade de recrutador" é um sinal fraco na origem

| | |
|---|---|
| **Probabilidade** | Alta |
| **Impacto** | Médio |

Não há fonte pública de "recrutadores ativos". O módulo depende de evidência derivada de vaga
(automática) e de registro manual.

**Mitigação:** as três classificações e as janelas fixas (14/60 dias); a proibição de confundir
perfil com atividade (RN-042); o componente do score fica **indisponível** sem recrutador, em vez
de penalizar a vaga (RN-035); a interface diz "não encontramos evidência pública datada", nunca
"recrutador inativo".

**O que não fazer:** inferir atividade de "#hiring" na headline, de número de conexões ou de
qualquer proxy. É exatamente o tipo de dado inventado que a especificação proíbe.

## 3. Risco nº 3 — a data de publicação é frequentemente mentirosa

| | |
|---|---|
| **Probabilidade** | Alta |
| **Impacto** | Alto — o filtro de 24 h é a promessa central |

Agregadores republicam vaga antiga com data nova; sites mostram "há 2 dias" sem data absoluta;
alguns não informam nada.

**Mitigação:** `resolvePublishedAt` com cinco níveis de proveniência e três confianças (doc 06
§5); `isSane` rejeitando data futura e > 400 dias; data original **imutável** por trigger no
banco; `confidence='unknown'` ⇒ recência indisponível no score e rótulo "detectada em".

**Limitação que permanece:** se a fonte mente com um campo estruturado, o sistema acredita. Não há
como detectar isso sem uma segunda fonte para a mesma vaga — e é precisamente o que a dedupe entre
fontes passa a permitir com o tempo (a vaga vista antes em outra fonte expõe a republicação).
Melhoria futura, não Fase 2.

## 4. Risco nº 4 — limites do plano gratuito

| Limite | Consequência | Mitigação |
|---|---|---|
| Vercel Hobby: 1 cron/dia | as 7 rotinas não rodam separadas | cada etapa é função isolada; `collect-jobs` as encadeia em um pipeline no mesmo orçamento de tempo (ADR-003) |
| Vercel Hobby: 60 s por função | coleta grande estoura | runner *chunked* com `deadline` e fila persistente — nunca depende de execução longa |
| Supabase Free: 500 MB | banco cheio em ~1–2 anos | retenção de 90 dias em `job_raw_payloads` (a tabela volumosa); projeção em doc 10 §18 |
| Supabase Free: pausa após 7 dias sem uso | projeto suspenso | o cron diário mantém atividade |
| Supabase Free: 7 dias de backup | janela curta de recuperação | exportação sob demanda pelo usuário (RF-CFG-06) |
| Resend free: volume diário | e-mail limitado | notificação no app é o canal primário; e-mail é complemento |

**Decisão:** nenhum destes limites exige arquitetura diferente — exigem o *chunking* e a retenção
que já estão especificados. Migrar para Vercel Pro é troca de plano, não de código.

## 5. Risco nº 5 — custo e comportamento da IA

| Risco | Mitigação |
|---|---|
| Custo descontrolado | teto mensal por usuário que **bloqueia** (RN-070); cache por `input_hash` (RN-071); modelo econômico para extração (RN-074); extração de competências sem IA (dicionário) |
| Saída inválida | saída estruturada + Zod, 1 retry, falha explícita (RN-073) |
| **Invenção de fatos** | validador anti-invenção com suíte adversarial (doc 20 §5); marcadores `[PREENCHER:]`; proibição em RN-007 e RN-065 |
| Prompt injection via descrição de vaga ou texto colado | conteúdo externo entra delimitado e rotulado como dado; a IA não tem ferramenta, não executa ação, não decide (RN-075); doc 20 §6 |
| Mudança de modelo altera resultado | `prompt_version` e `model` gravados em todo artefato; auditorias antigas permanecem comparáveis porque guardam a régua usada |
| Latência alta na auditoria | streaming + processamento por seção + estado de progresso real |

## 6. Risco nº 6 — complexidade do Opportunity Score mal comunicada

**O problema:** score normalizado por cobertura pode confundir ("por que 88 se só tem recência?").

**Mitigação:** `data_coverage` sempre visível; componentes exibidos como obtido/teto **disponível**;
lista explícita do que não foi avaliado; selo de baixa confiança abaixo de 0,5; e o bloqueio de
notificação quando a cobertura é baixa, por mais alto que seja o número.

**Limitação aceita:** o score não é comparável entre vagas com coberturas muito diferentes. A
interface ordena por score, mas exibe a cobertura ao lado — e isso é mais honesto que um número
único fabricado.

## 7. Risco nº 7 — manutenção dos adaptadores

Fonte muda HTML/JSON sem avisar; adaptador quebra em silêncio.

**Mitigação:** `SourceError('parse')` com amostra truncada em `collector_runs`; fixtures por
adaptador no CI (mudança de fixture quebra o teste); 5 falhas consecutivas ⇒ `degraded` +
notificação; painel de execuções visível ao usuário.

**Custo recorrente real:** manutenção de ~1 adaptador por mês. É o preço de não depender de
parceria — e é menor que o de qualquer alternativa proibida.

## 8. Risco nº 8 — vazamento da busca para o empregador atual

É o risco de maior **impacto humano** do produto.

**Mitigação:** modo discreto transversal (RN-092); nenhuma ação em plataforma externa (RN-090);
empresa atual sugerida para a blocklist (RN-093); e-mail com assunto neutro; nenhum analytics de
terceiros; trava por PIN; ocultação rápida de tela.

**Limitação:** se o usuário acessar o CareerOS em máquina corporativa, o histórico de navegação e
o monitoramento da empresa estão fora do alcance do produto. A documentação de onboarding deve
dizer isso com clareza, em vez de dar falsa sensação de segurança.

## 9. Riscos de desenvolvimento

| Risco | Mitigação |
|---|---|
| Expansão de escopo (achar que precisa de Redis, microserviço, fila externa) | ADR-010 proíbe nas Fases 1–4; a fila é tabela Postgres |
| Implementar o frontend antes do domínio | roadmap força domínio e banco primeiro; funções puras com teste antes de tela |
| Pular RLS "para ir mais rápido" | migration 0010 falha se alguma tabela ficar sem RLS; teste no CI |
| Deriva entre documentação e código | o SQL é a fonte canônica do schema; `supabase db diff` no CI detecta migration pendente |
| IA implementadora decidir por conta própria | os ADRs do doc 00 são fechados; o doc 20 define os contratos de prompt |

## 10. Limitações técnicas assumidas (não são bugs)

1. **Sem candidatura automática.** Jamais. O envio é humano (doc 00 §3).
2. **Sem leitura autenticada do LinkedIn.** Quatro canais de entrada, nenhum deles automação de
   conta.
3. **Sem busca global de vagas.** A cobertura é a soma das fontes configuradas.
4. **Dedupe não é perfeita.** Limiar 0,82 produz falso negativo ocasional; nada é apagado, então o
   erro é visível e reversível.
5. **Normalização de salário é heurística.** Marcada como estimada e excluída de estatística
   (RN-005).
6. **Comparação PJ × CLT é aproximada** e não é aconselhamento fiscal (RN-082).
7. **Estatísticas de mercado valem para o universo coletado**, não para o mercado brasileiro. A
   amostra é sempre declarada (RN-004).
8. **Score não prevê contratação.** Mede recência, atividade, aderência e qualidade da
   oportunidade — não probabilidade de sucesso.
9. **Projeção de score otimizado é estimativa** calculada pelas verificações determinísticas, não
   promessa de resultado no LinkedIn.
10. **Single-tenant na prática.** O schema é multi-tenant, mas performance, billing e suporte não
    foram validados para múltiplos usuários — isso é Fase 6.

## 11. Sinais de que algo deu errado (monitorar após cada fase)

| Sinal | Significa | Ação |
|---|---|---|
| `collector_runs` com `items_filtered` > 90% | perfil de busca mal configurado | revisar palavras-chave com o usuário |
| Muitas vagas com `published_at_confidence='unknown'` | fonte ruim | reavaliar a fonte, não relaxar a regra |
| `data_coverage` médio < 0,5 | falta dado para pontuar | priorizar fontes que entregam salário e data |
| `ai_runs` com `validation_failed` recorrente | prompt ou schema inadequado | corrigir o prompt, **nunca** relaxar o validador |
| Recrutadores todos em `no_activity_found` | só há evidência fraca | é resultado honesto; ampliar canais de evidência |
| `consecutive_failures` ≥ 5 em várias fontes | bloqueio por IP ou mudança de API | reavaliar; não trocar user-agent para disfarçar |
| Banco perto de 500 MB | retenção insuficiente | revisar retenção antes de aumentar o plano |
