# 13 — Fluxos de funcionamento

> Cada fluxo abaixo tem: gatilho, passos, regras aplicadas, falhas previstas e resultado
> observável. São a base dos testes e2e (RNF-TST-04).

## 1. Cadastro e primeiro acesso

```
usuário → /cadastro (e-mail, senha)
  → Supabase Auth cria auth.users e envia e-mail de confirmação (template em pt-BR)
  → trigger on_auth_user_created cria profiles + user_settings + user_limits
                                        + offer_criteria_weights padrão          [RF-AUT-04]
  → usuário confirma e-mail → /login → sessão → /painel
  → /painel detecta has_collected_jobs = false e exibe onboarding em 3 passos
```

**Falhas previstas:** e-mail já cadastrado (mensagem específica, sem revelar se a conta existe
além do necessário); link expirado (oferecer reenvio); confirmação pendente (login informa).

**Resultado observável:** quatro linhas criadas no banco; `/painel` acessível; nenhuma rota de
aplicação acessível sem sessão.

## 2. Criação de perfil de busca

```
/radar/perfis → "novo perfil"
  → formulário (react-hook-form + Zod): nome, perfil profissional (opcional),
    palavras-chave, exclusões, localizações, modalidade, contrato, senioridade,
    salário mínimo, janela de recência, fontes, score mínimo
  → validação no cliente e no servidor (RNF-SEC-04)
  → Server Action create():
       valida recency_hours ∈ {24,72,168,360}                      [RN-017]
       verifica limite de perfis ativos                            [RN-015]
       grava search_profiles + search_profile_sources
       se career_profile_id ausente → aviso: "o componente de compatibilidade
         do score ficará indisponível"                              [RN-010]
  → revalidateTag('search-profiles') → lista atualizada
```

**Falhas previstas:** 11º perfil ativo (erro explicativo com o limite); nome duplicado;
nenhuma fonte habilitada (bloqueia com explicação, porque perfil sem fonte nunca coleta).

## 3. Coleta agendada (o fluxo central)

```
Vercel Cron 09:00 UTC → POST /api/cron/collect-jobs
  Authorization: Bearer CRON_SECRET  (comparação em tempo constante)   [RNF-SEC-06]
  │
  ├─ planner: para cada usuário ativo
  │            para cada search_profile ativo                           [RN-014]
  │             para cada fonte habilitada com legal_status utilizável   [RN-020]
  │              INSERT collector_queue ON CONFLICT (dedupe_key) DO NOTHING
  │
  └─ runner: enquanto houver orçamento de tempo (45 s)                  [RNF-PERF-05]
       claim_next_collector_lot()            -- FOR UPDATE SKIP LOCKED
       processLot:
         1 guard            assertCollectable                           [RN-020]
         2 fetch            adapter.fetch(query, ctx)                   [RNF-RES-02]
         3 normalize        normalizeJob                                [RN-008]
         4 resolve date     resolvePublishedAt                          [RN-002]
         5 filter           applyProfileFilters (+ contadores por motivo)[RN-003,016,026]
         6 persist          upsertCompany → upsertJob → raw payload     [RN-021]
         7 dedupe           fingerprint → fuzzy                         [RN-021,022]
         8 recruiter        linkRecruiterFromJob                        [RN-043]
         9 score + notify   calculateOpportunityScore → job_matches
                            → fila do resumo diário se score ≥ mínimo   [RN-030, RF-NOT-03]
       completeLot | failLot (backoff; 5 tentativas ⇒ dead)
  │
  └─ fecha collector_runs com todos os contadores                       [RN-029]
```

**Falhas previstas e comportamento:**

| Falha | Comportamento |
|---|---|
| Fonte fora do ar | `SourceError('network')` → retry → lote reagendado; outras fontes seguem (RNF-RES-01) |
| 429 da fonte | respeita `Retry-After`, reagenda, não insiste (RN-027) |
| Mudança de layout/JSON | `SourceError('parse')` com amostra truncada; fonte segue ativa; erro visível no diagnóstico |
| Orçamento de tempo esgotado | lotes restantes ficam `pending`; próxima execução continua (RNF-RES-06) |
| 5 falhas consecutivas | fonte vira `degraded` + notificação (RNF-RES-05) |
| Fonte `disallowed` com flag ligada | guard lança; nada é requisitado (teste automatizado) |

**Resultado observável:** `collector_runs` fechado; vagas novas em `jobs`; `job_matches` com score
e `score_breakdown`; duplicatas em `job_duplicates`; nenhuma vaga de empresa vetada (RN-013).

## 4. Coleta manual

```
/radar ou /radar/perfis/[id] → "coletar agora"
  → POST /api/radar/collect { searchProfileId }
      check_rate_limit(user, 'manual_collect', MANUAL_RUNS_PER_HOUR, 3600)   [RN-028]
      excedido → 429 { retryAfterSeconds }
      ok       → enfileira lotes, responde 202 { runId }
  → UI faz polling de GET /api/radar/runs/[runId] a cada 2 s (máx. 90)
  → ao concluir: toast com "X novas, Y atualizadas, Z duplicadas, W filtradas"
```

Coleta manual **não** ignora o rate limit da fonte (RN-027). A UI diz isso quando a espera ocorre.

## 5. Triagem de vaga até candidatura

```
/radar (lista ordenada por score)
  → abrir vaga → /radar/[jobId]
       exibe: decomposição do score, rótulo de data conforme confiança   [RN-002, 034]
              outras fontes da mesma vaga, recrutador e evidência        [doc 07]
  → "enviar ao Kanban"
       Server Action: cria applications copiando title/company/url/salário [RN-050]
                      status do match = 'sent_to_kanban'
                      índice único impede duplicar candidatura ativa      [RN-053]
                      evento 'stage_change' → 'interested'                [RN-051]
  → /candidaturas: cartão na coluna "Interesse"
  → usuário se candidata na fonte (fora do sistema) e move para "Candidatado"
       trigger preenche applied_at                                        [RN-051]
```

**Nunca** há candidatura automática (fora de escopo, documento 00 §3).

## 6. Kanban: mover cartão

```
arrastar (dnd-kit) → useOptimistic move o cartão na hora                [RNF-PERF-03]
  → Server Action updateStage(applicationId, toStage)
       RLS garante que a candidatura é do usuário
       trigger log_application_stage_change insere application_events    [RN-054]
       estado terminal zera next_action                                  [RN-052]
       is_stale = false
  → erro → reverte visualmente + toast com motivo                        [RNF-RES-07]
  → revalidateTag('applications')
```

Alternativa por teclado obrigatória: `Tab` até o cartão, `Espaço` para pegar, setas para mover,
`Espaço` para soltar, `Esc` para cancelar (RNF-UX-04).

## 7. Auditoria de LinkedIn

```
/linkedin/nova → escolher entrada
  ├─ URL:   POST /api/linkedin/ingest { url }
  │           robots.txt → 1 requisição → sucesso parcial ou falha        [RN-061]
  │           falha: informa o motivo e oferece as outras 3 entradas
  ├─ texto: parser por cabeçalhos de seção
  ├─ PDF:   upload → bucket privado → extração de texto → parser          [RN-067]
  └─ form:  preenchimento direto
  → ProfileSnapshot + relatório de cobertura                              [RN-060]
  → REVISÃO HUMANA obrigatória → grava linkedin_profile_versions.reviewed_at
  → exibe custo estimado da análise                                       [RNF-COST-04]
  → POST /api/linkedin/audits { profileVersionId } → 202 { auditId }
       verifica teto de IA                                                [RN-070]
       cache por hash do snapshot                                        [RN-071]
       heurísticas determinísticas → chamada de IA → validação Zod
       → validador anti-invenção                                         [RN-007, 065]
         falhou → 1 retentativa com instrução de correção                [RN-073]
         falhou de novo → status 'failed' com motivo (nada é exibido)
       → score ponderado em código                                       [RN-062]
       → prioridade calculada                                            [RN-064]
       → grava audit + sections + findings (imutáveis)                   [RN-066]
  → polling a cada 2 s → relatório
  → usuário copia textos, aplica no LinkedIn, marca "aplicada"           [RF-LKD-09]
```

**Resultado observável:** auditoria `completed` com score, cobertura, seções não avaliadas
listadas, achados com as cinco partes e `ai_runs` com custo registrado.

## 8. Geração de artefato com IA (currículo adaptado, carta, análise de vaga)

```
/radar/[jobId] ou /candidaturas/[id] → "analisar com IA"
  → exibe custo estimado + quais dados serão usados como contexto        [RF-AIA-09]
  → usuário confirma  (nunca executa sem clique — RNF-COST-03)
  → POST /api/ai/[feature]
       current_ai_cycle_cost >= cap → 403 com consumo e data de reinício [RN-070]
       monta contexto por lista de permissão explícita                   [RN-072]
       cache por hash                                                    [RN-071]
       modelo por tarefa                                                 [RN-074]
       saída estruturada validada + anti-invenção                        [RN-073, 007]
       grava ai_runs + assistant_messages
  → UI exibe artefato com modelo, versão de prompt e data                [RF-AIA-06]
  → usuário aceita (salva como nova versão de currículo) ou descarta     [RN-075]
```

## 9. Comparação de proposta

```
candidatura entra em "Proposta" → sugestão: "cadastrar proposta"
/propostas/nova → formulário (base, bônus, equity, benefícios, deslocamento, contrato)
  → PJ exige alíquota efetiva informada pelo usuário                     [RN-080]
  → cálculo puro em lib/offers/calculate.ts:
       remuneração total anual                                           [RN-081]
       líquido estimado com premissas declaradas                         [RN-080, 082]
       desconto do deslocamento                                          [RN-083]
       diferencial % contra current_employment                           [RN-084]
  → grava job_offers com assumptions + tax_table_version (obrigatórios)
/propostas/comparar → até 4 propostas + atual, eixos financeiros e ponderados pelo usuário [RN-085]
  → registrar decisão e motivo
```

Ressalva de "não é aconselhamento fiscal" visível em toda tela de cálculo (RF-OFR-07).

## 10. Rotinas diárias e semanais

| Rotina | Horário (UTC) | O que faz |
|---|---|---|
| `collect-jobs` | 09:00 | fluxo 3 |
| `close-stale-jobs` | 09:30 | `missed_count >= 3` ⇒ `is_active=false` (RN-023); fonte que falhou não conta |
| `recalc-scores` | 10:00 | recalcula matches cujo componente de recência mudou de faixa |
| `refresh-recruiters` | 10:15 | reclassifica quem venceu `next_review_at` (RN-044) |
| `daily-digest` | 11:00 | consolida notificações do dia e envia conforme canais e modo discreto (RF-NOT-03, RN-092) |
| `compute-insights` | seg 04:00 | recalcula `market_insights` com `n >= 8` (RN-004) |
| `retention` | dom 04:30 | `run_retention()` (documento 10 §19) + expurgo de arquivos órfãos |

No plano Hobby (1 cron/dia), `collect-jobs` chama as demais etapas em sequência dentro do mesmo
orçamento de tempo (documento 06 §8). Cada etapa é uma função; as rotas são invólucros finos.

## 11. Notificação (com modo discreto)

```
evento (vaga nova acima do mínimo, follow-up vencido, entrevista em 24 h, certificação
        vencendo, fonte degradada, teto de IA)
  → lib/notifications/create()
      score de baixa confiança ⇒ NÃO notifica, por alto que seja         [RN-030]
      empresa vetada           ⇒ NÃO notifica                            [RN-013]
      modo discreto ativo      ⇒ grava com suppressed_by_stealth = true
                                  e adia para o resumo diário            [RN-092]
      horário silencioso       ⇒ adia para o fim da janela
      canal e-mail             ⇒ assunto neutro configurável             [RF-DIS-02]
  → in-app aparece no sino; e-mail sai no horário do resumo
```

## 12. Exclusão de conta (LGPD)

```
/configuracoes → "excluir conta" → digitar "EXCLUIR" para confirmar      [RNF-UX-09]
  → POST /api/account/delete
      lista objetos em storage sob {user_id}/ e remove
      DELETE FROM auth.users → cascata remove todas as tabelas pessoais  [RN-094]
      mantém market_insights (agregado anônimo), e isso é informado na tela
  → sessão encerrada → /login com confirmação
```

**Resultado observável:** teste em base de desenvolvimento confirma zero linhas em todas as
tabelas pessoais e zero objetos no bucket para aquele `user_id`.

## 13. Exportação de dados (portabilidade)

```
/configuracoes → "exportar meus dados" → GET /api/export
  → JSON com todas as tabelas pessoais + lista de documentos com metadados
  → campos sensíveis (pin_hash, secret_ciphertext) NÃO são exportados    [RNF-SEC-11]
  → current_employment é exportado (é dado do usuário), com marcação de sensível
  → download direto, sem passar por serviço externo
```
