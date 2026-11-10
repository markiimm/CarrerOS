# 18 — Riscos, limitações técnicas e o que o produto não resolve

> Este documento existe para que ninguém — nem o usuário, nem a IA implementadora — construa
> expectativa que a realidade técnica não sustenta. Cada risco traz probabilidade, impacto,
> mitigação já embutida na especificação e **sinal de alerta** (como perceber que aconteceu).

## 1. Riscos de disponibilidade de dados (os mais prováveis)

### R-01 — Cobertura de vagas abaixo do esperado
**Probabilidade: alta · Impacto: alto**

As plataformas com mais vagas (LinkedIn, Indeed, Catho) não permitem coleta automatizada ou exigem
contrato comercial (documento 14 §2.3). O que resta de acesso livre são ATS por empresa, feeds e
páginas com JSON-LD — cobertura real menor e dependente de o usuário cadastrar as empresas.

- **Mitigação na especificação:** adaptador `manual` de primeira classe; importação de alerta de
  e-mail (Fase 5); onboarding que orienta a montar a lista de empresas; o produto entrega valor
  pelo *processamento* (dedupe, data confiável, score, Kanban, LinkedIn), não pelo volume.
- **Sinal de alerta:** menos de 10 vagas novas por semana somando todos os perfis de busca.
- **O que NÃO fazer:** nenhuma reação que envolva scraping de plataforma proibida. Essa porta está
  fechada por decisão, não por limitação técnica.

### R-02 — Data de publicação indisponível ou imprecisa
**Probabilidade: alta · Impacto: médio**

O requisito central é "últimas 24 horas", mas muitas fontes não informam data, ou informam texto
relativo.

- **Mitigação:** proveniência e confiança gravadas (RN-002); janela aceita `first_seen_at` com
  selo "data não confirmada" (RN-003); componente de recência fica indisponível em vez de
  inventado; nunca se exibe "publicada há X" sem base.
- **Sinal de alerta:** mais de 40% das vagas com `published_at_confidence = 'unknown'`.
- **Consequência honesta:** para essas vagas, o CareerOS garante "detectada nas últimas 24 h",
  não "publicada nas últimas 24 h". A diferença está dita na interface.

### R-03 — Recrutador identificado em pouquíssimas vagas
**Probabilidade: alta · Impacto: médio**

ATS raramente expõem o responsável; redes sociais estão fora.

- **Mitigação:** componente de score fica `available: false` sem penalizar a vaga (RN-035);
  entrada manual é o caminho principal (documento 07 §6); o módulo pode ser desligado.
- **Sinal de alerta:** menos de 5% dos `job_matches` com recrutador vinculado — nesse caso, o
  score roda com cobertura de 75% na maioria das vagas, o que é aceitável e visível.

### R-04 — Fonte muda formato e o adaptador quebra
**Probabilidade: média · Impacto: baixo (isolado)**

- **Mitigação:** `SourceError('parse')` com amostra truncada; isolamento por lote; fonte vira
  `degraded` após 5 falhas com notificação; fixture do adaptador falha no CI quando atualizada.
- **Sinal de alerta:** `collector_runs` com `items_failed > 0` repetido na mesma fonte.

## 2. Riscos de plataforma e custo

### R-05 — Limites do plano gratuito da Vercel
**Probabilidade: alta (é certeza no plano Hobby) · Impacto: médio**

Cron 1x/dia, função de 60 s.

- **Mitigação:** coleta em lotes com orçamento de tempo (ADR-003); fila persistente retoma o
  pendente; `collect-jobs` compõe as demais etapas quando só há um cron; coleta manual disponível;
  no plano Pro a frequência sobe sem mudança de código.
- **Consequência honesta:** com um cron diário, "últimas 24 horas" significa "o que apareceu desde
  a última execução". Isso satisfaz o requisito; não é tempo real, e a interface mostra a hora da
  última coleta.

### R-06 — Custo de IA fora de controle
**Probabilidade: média · Impacto: médio**

- **Mitigação:** nenhuma IA na coleta (RNF-COST-03); teto mensal que **bloqueia** (RN-070); cache
  por hash (RN-071); modelo por tarefa (RN-074); custo estimado exibido antes de operação cara;
  `AI_GLOBAL_MONTHLY_CAP_USD` como rede de segurança.
- **Sinal de alerta:** consumo passar de 60% do teto antes do dia 15 do ciclo.

### R-07 — Crescimento de `job_matches` degradando consultas
**Probabilidade: baixa (1 usuário) · Impacto: médio (se virar SaaS)**

- **Mitigação:** índices com `user_id` à frente (RNF-SCAL-01); paginação por cursor, nunca
  `OFFSET` grande; `jsonb` apenas onde não se filtra; `EXPLAIN ANALYZE` revisado na Fase 5.
- **Sinal de alerta:** listagem do radar passando de 500 ms no servidor.

### R-08 — Acoplamento a Supabase e Vercel
**Probabilidade: certa · Impacto: baixo (aceito em ADR-002 e ADR-003)**

- **Mitigação:** SQL padrão (nada além de RLS e `auth.uid()`); acesso encapsulado em `lib/db`;
  crons são rotas HTTP comuns; pontos de troca mapeados (documento 04 §8).

## 3. Riscos de qualidade de informação

### R-09 — Deduplicação errada (falso positivo ou negativo)
**Probabilidade: média · Impacto: médio**

Duas vagas distintas da mesma empresa, mesma cidade e títulos parecidos ("Analista de Suporte I" e
"Analista de Suporte II") podem casar no fuzzy.

- **Mitigação:** `canon()` remove sufixos de senioridade **antes** do fingerprint, justamente para
  que esse caso não vire fingerprint igual; o fuzzy exige 0,82 de similaridade **e** mesma empresa
  **e** mesma cidade; nada é apagado — as duas linhas ficam e a UI lista as fontes; o usuário pode
  desfazer a marcação de duplicata.
- **Sinal de alerta:** mais de 20% das vagas marcadas como duplicatas em `strategy='fuzzy'`.

### R-10 — Score mal calibrado
**Probabilidade: média · Impacto: médio**

As faixas de pontuação são uma hipótese inicial, não uma verdade medida.

- **Mitigação:** score versionado (RN-033) e recalculável em lote; `score_breakdown` permite
  auditar cada decisão; pesos ajustáveis por perfil (RF-SCR-07); `data_coverage` exposta.
- **Como calibrar depois:** comparar score médio das vagas que geraram resposta do recrutador com
  o das que não geraram, e ajustar faixas com `SCORE_VERSION` novo — sem reescrever histórico.

### R-11 — A IA inventar fato sobre a vida do usuário
**Probabilidade: média (é o comportamento natural de um modelo que quer "melhorar" o texto) ·
Impacto: alto (um currículo com fato inventado destrói a credibilidade do candidato)**

- **Mitigação:** proibição explícita nos prompts (documento 20 §3); saída estruturada com
  `usedFacts` e `placeholders`; validador que compara entidades geradas com a entrada e **rejeita**
  (documento 20 §5); uma retentativa e então falha visível; `[PREENCHER: ...]` obrigatório;
  nenhuma aplicação automática (RN-075).
- **Sinal de alerta:** `ai_runs.status = 'validation_failed'` recorrente numa mesma feature —
  indica prompt mal escrito, não "modelo ruim".

### R-12 — Estatísticas de mercado sem representatividade
**Probabilidade: alta · Impacto: médio**

A base é o conjunto de vagas que *este* sistema coletou: amostra de conveniência.

- **Mitigação:** `n` mínimo de 8 gravado como constraint no banco (não é só regra de aplicação);
  `n`, período e origem exibidos sempre; texto na interface declarando que a base não é o mercado
  inteiro; salário informado nunca se mistura a estimado.

## 4. Riscos jurídicos e de reputação

### R-13 — Coleta em fonte não permitida
**Probabilidade: baixa (por desenho) · Impacto: alto**

- **Mitigação:** guard que recusa antes de qualquer requisição (RN-020); `legal_status` com
  `terms_url` obrigatória para `allowed` (constraint no banco); teste que tenta coletar fonte
  `disallowed` com todas as flags ligadas e espera exceção; `robots.txt` respeitado com cache;
  `User-Agent` identificável.

### R-14 — Exposição da busca ao empregador atual
**Probabilidade: baixa · Impacto: muito alto para o usuário**

- **Mitigação:** modo discreto em todos os canais (RN-092); empresa atual sugerida para vetadas
  (RN-093); nenhuma página pública (RF-DIS-06); e-mail com assunto neutro; PIN por inatividade;
  máscara de valores; nenhuma ação em plataforma externa (RN-090).

### R-15 — Dados de terceiros (recrutadores) sob a LGPD
**Probabilidade: média · Impacto: médio**

- **Mitigação:** apenas informação profissional pública, mínima e com evidência; sem contato
  privado obtido fora de interação; exclusão sob demanda em um clique; exportação do que se guarda
  sobre a pessoa; retenção declarada.

## 5. Limitações técnicas assumidas (não são riscos — são fatos)

| Limitação | Consequência prática |
|---|---|
| Sem acesso ao LinkedIn | o Analyzer depende de PDF, texto colado ou formulário; foto e capa não são avaliáveis por PDF |
| Sem candidatura automática | o sistema prepara; o envio é humano, sempre |
| Sem tempo real | coleta agendada; a interface mostra a hora da última execução |
| Sem app nativo | web responsivo; desktop é o alvo |
| PIN não protege contra atacante remoto | é proteção contra olhar casual, e isso é dito ao usuário |
| Cálculo tributário simplificado | estimativa declarada, com premissas versionadas; não é aconselhamento fiscal |
| Extração de competências por dicionário | não entende sinônimo fora do dicionário; em troca, é determinística, gratuita e testável |
| Score não prevê aprovação | mede o que é verificável, e a interface diz o que ele não mede |
| Texto relativo de data vira `approximate` | penalidade de 10% no componente de recência, declarada |
| PDF do LinkedIn varia por idioma e layout | parser com fixtures; a revisão humana do snapshot existe por causa disso |

## 6. Dívidas técnicas aceitas de propósito

| Dívida | Por que foi aceita | Quando pagar |
|---|---|---|
| `user_id` denormalizado em tabelas filhas | política de RLS simples e índice direto; a alternativa é `EXISTS` em cada política | não pagar — o custo é menor que o benefício |
| Fila em Postgres | economia e simplicidade (ADR-010) | ao passar de ~50 mil lotes/dia |
| Sem `materialized view` no dashboard | não otimizar antes de medir | se o dashboard passar de 2,5 s de LCP |
| `shadcn/ui` atualizado à mão | controle total do código dos componentes | nunca, por escolha |
| Sem ORM | tipagem gerada resolve; ORM atrita com RLS e com SQL de dedupe | nunca, nas Fases 1–5 |
| Dicionários como arquivos TS | simples de versionar e testar | se o usuário precisar editá-los pela interface |
| i18n sem biblioteca | só pt-BR agora (ADR-008) | ao entrar o segundo idioma — extrair para `next-intl` |

## 7. O que o produto explicitamente não resolve

- não encontra todas as vagas do mercado;
- não garante entrevista, resposta ou aprovação;
- não avalia cultura, gestão ou saúde financeira de empresa (não há fonte confiável e gratuita);
- não substitui a rede de contatos — ajuda a organizá-la;
- não escreve a carreira do usuário: organiza a informação e o esforço dele.

Dizer isso na interface, nos lugares onde a expectativa se forma (dashboard, score, mercado), é
requisito de produto — não modéstia.
