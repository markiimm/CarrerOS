# 17 — Roadmap e critérios de aceite

> Critério de aceite é **binário**: passa ou não passa. Nada de "está razoável".
> Fase não fechada não libera a seguinte — exceto onde indicado como paralelizável.
> Estimativas em dias de trabalho focado de **uma** pessoa (ou de uma IA implementadora
> trabalhando por sessões); servem para ordenar, não para prometer data.

## Resumo

| Fase | Entrega | Estimativa | Depende de |
|---|---|---|---|
| 1 | Fundação: estrutura, auth, banco, dashboard, perfis | 6–9 d | — |
| 2 | Radar: coleta, filtros, recrutadores, score, Kanban | 10–14 d | 1 |
| 3 | LinkedIn: auditoria, pontuação, recomendações, otimizador | 7–10 d | 1 (2 é desejável) |
| 4 | Inteligência: IA, currículos, CRM, comparador, evolução | 10–14 d | 2 e 3 |
| 5 | Finalização: biblioteca, notificações, testes, segurança | 6–9 d | 4 |

Total: **39–56 dias**. Fase 3 pode correr em paralelo com a 2 por não compartilhar código de
domínio (apenas o banco e o layout).

---

## FASE 1 — Fundação

### Escopo

1. Projeto Next.js 15 + TypeScript `strict` + Tailwind v4 + shadcn/ui; ESLint com regra de
   camadas (`import/no-restricted-paths`).
2. Projeto Supabase; migrations 0001–0012 aplicadas; `database.types.ts` gerado e versionado.
3. Auth: cadastro, login, magic link, confirmação, recuperação, logout; `middleware.ts`.
4. Layout do app: sidebar, topbar, tema escuro padrão, i18n pt-BR, os 5 estados base.
5. Perfil profissional (CRUD completo com experiências, formação, certificações, projetos).
6. Perfis de busca (CRUD, limite de ativos, validação da janela de recência).
7. Dashboard com contadores reais via `v_dashboard_counters` (zerados é resultado válido).
8. Configurações: tema, fuso, modo discreto, limites.
9. CI: lint, typecheck, teste unitário, `supabase db diff` verificando migration pendente.

### Critérios de aceite (todos obrigatórios)

- [ ] `npm run build` sem erro e sem `any` em fronteira de dados.
- [ ] `supabase db push` em projeto **limpo** cria todo o schema sem erro, e rodar duas vezes não
      quebra (idempotência).
- [ ] Nenhuma tabela de `public` sem RLS (query de verificação retorna zero linhas).
- [ ] Teste de isolamento: usuário B não lê nem altera nada de A, em todas as tabelas com
      `user_id`.
- [ ] Cadastro cria `profiles` + `user_settings` + `user_limits` por trigger (teste).
- [ ] Rota de `(app)` sem sessão redireciona para `/login?next=...`.
- [ ] Criar perfil profissional com 2 experiências, 1 formação e 1 certificação, recarregar e os
      dados persistem.
- [ ] Ativar o 11º perfil de busca retorna erro explicativo (RN-015).
- [ ] `recency_hours = 48` é rejeitado na validação e no banco (RN-017).
- [ ] Dark mode é o tema da primeira pintura, sem *flash* de claro.
- [ ] Nenhuma string de interface fora de `lib/i18n/pt-BR.ts`.
- [ ] Nenhum segredo em `NEXT_PUBLIC_*`.

---

## FASE 2 — Radar

### Escopo

1. Núcleo do coletor: guard, fetch, normalize, resolveDate, filter, persist, dedupe,
   linkRecruiter, score, closeRun.
2. Adaptadores: `manual`, `rss-generic`, `greenhouse`, `lever` (mais `jsonld-careers` se o tempo
   permitir), com fixtures.
3. Fila (`collector_queue`) + planner + runner *chunked* + `vercel.json` com os crons.
4. Opportunity Score completo com `score_breakdown` e explicação por template.
5. Recrutadores: evidência derivada de vaga, classificador, recálculo diário, tela com evidências.
6. Job Radar: lista, filtros, ordenação, detalhe com decomposição do score, descarte, painel de
   execuções.
7. Kanban: colunas, arrastar e soltar, eventos automáticos, estagnação, próxima ação.
8. Cadastro manual de vaga.

### Critérios de aceite

- [ ] Fonte com `legal_status` diferente de `allowed` **não** executa, mesmo com todas as flags
      ligadas — teste prova que nenhuma requisição de rede é feita (RN-020).
- [ ] Coleta real de pelo menos uma fonte traz vagas com `published_at_confidence='exact'`.
- [ ] Mesma vaga coletada 2x não duplica; `last_seen_at` atualiza e `published_at`/`first_seen_at`
      **não** mudam (teste de trigger).
- [ ] Vaga igual em 2 fontes gera `job_duplicates`; a interface exibe uma canônica com as duas URLs.
- [ ] Título levemente diferente (similaridade ≥ 0,82) é detectado como duplicata `fuzzy`.
- [ ] Vaga sem data entra com `confidence='unknown'`, exibe "detectada em" e tem o componente de
      recência **indisponível** (RN-003).
- [ ] Palavra-chave excluída vence a incluída (RN-016).
- [ ] Empresa vetada não aparece em nenhum módulo (RN-013).
- [ ] `calculateOpportunityScore` passa os 10 testes do doc 08 §11, incluindo o de pureza.
- [ ] Vaga sem recrutador e sem salário tem score **≥** vaga idêntica com recrutador inativo e
      salário baixo (ausência ≠ zero).
- [ ] `data_coverage < 0,5` ⇒ selo de baixa confiança e **nenhuma** notificação, mesmo com score 95.
- [ ] Recrutador com perfil completo e zero evidência ⇒ `no_activity_found` (RN-042).
- [ ] Classificador passa a tabela-verdade de 9 casos (doc 07 §4).
- [ ] Cron recusa requisição sem `CRON_SECRET` e registra a recusa.
- [ ] Toda execução gera `collector_runs`, inclusive a que falhou, com contadores por motivo de
      filtro (RN-029).
- [ ] Runner respeita o orçamento de tempo: fila grande deixa itens `pending` sem estourar o
      limite da função.
- [ ] Mover cartão no Kanban grava `application_events` por trigger; `UPDATE` no evento é negado
      pela RLS (RN-054).
- [ ] Cartão sem evento há 8 dias aparece como estagnado (RN-055).
- [ ] 6ª coleta manual na mesma hora retorna 429 com tempo de espera (RN-028).

---

## FASE 3 — LinkedIn

### Escopo

1. Os 4 canais de entrada e a normalização para `ProfileInput`.
2. As 14 seções de verificações determinísticas.
3. Camada de IA com saída estruturada + validador anti-invenção.
4. Score ponderado normalizado por cobertura; prioridades calculadas.
5. Auditorias imutáveis, histórico, comparação entre auditorias, gráfico de evolução.
6. Comparação original × otimizado com projeção recalculada.
7. Marcação de recomendação aplicada; exportação da auditoria (PDF/Markdown).

### Critérios de aceite

- [ ] Os 4 canais produzem auditoria; o canal de URL, ao falhar, oferece os outros três **sem**
      mensagem de erro técnica (RN-061).
- [ ] Nenhuma dependência de navegador headless no módulo (teste falha se `playwright`/`puppeteer`
      for importado).
- [ ] Seção não avaliável fica fora do score e **aparece listada** na interface (RN-060).
- [ ] Toda recomendação gravada tem as 5 partes; incompleta é rejeitada pelo validador (RN-063).
- [ ] Suíte adversarial de 20 casos: nenhum `example_text` com empresa, cargo, data, número ou
      tecnologia ausente na entrada passa pelo validador (RN-007, RN-065).
- [ ] Faltando informação, o texto sugerido contém `[PREENCHER: ...]` e a interface o realça.
- [ ] `priority` reproduz `peso × severidade × lacuna` (teste numérico).
- [ ] Auditoria `completed` é imutável: `UPDATE` negado pela RLS **e** pela trigger (RN-066).
- [ ] Reanálise cria auditoria com `previous_audit_id` e o gráfico de evolução mostra as duas.
- [ ] Comparação entre auditorias com bases diferentes **declara** a mudança de base.
- [ ] PDF em bucket privado, excluído junto com a auditoria; nunca enviado como arquivo à IA
      (RN-067).
- [ ] Teto de custo atingido ⇒ erro explicativo com consumo e data de reinício (RN-070).
- [ ] Repetir a mesma auditoria em 30 dias reaproveita o cache e marca "cached" (RN-071).

---

## FASE 4 — Inteligência

### Escopo

1. AI Career Assistant: análise de vaga × perfil, currículo direcionado, carta de apresentação,
   simulação de entrevista com perguntas e avaliação.
2. Recruiter CRM: cadastro manual, contatos, follow-ups, histórico, exportação.
3. Career Intelligence: agregados de salário, competências e modalidade, com amostra declarada.
4. Offer Comparator: cálculo com premissas versionadas, comparação com o emprego atual, critérios
   ponderados pelo usuário.
5. Career Growth: lacuna de competências, metas, plano de estudo, progresso.
6. Currículos versionados com renderização em PDF.

### Critérios de aceite

- [ ] Toda saída de IA é validada por Zod; falha ⇒ 1 retry ⇒ erro registrado, **nada** parcial na
      tela (RN-073).
- [ ] Nenhuma chamada de IA parte do cliente (verificado por revisão + teste de rede).
- [ ] `ai_runs` registra modelo, versão de prompt, tokens, custo e latência em 100% das chamadas
      (RN-006).
- [ ] Contexto de IA montado por lista de permissão; teste prova que remuneração atual **nunca**
      é enviada (RN-072).
- [ ] Currículo gerado não contém fato ausente no perfil (suíte adversarial).
- [ ] Estatística com `n < 8` exibe "amostra insuficiente (n=X)", nunca o número (RN-004).
- [ ] Estatística salarial ignora `salary_is_estimated = true` e informa quantas vagas excluiu
      (RN-005).
- [ ] Comparação de propostas exibe as premissas usadas e a ressalva de PJ × CLT (RN-080, RN-082).
- [ ] Remuneração total anual confere com cálculo manual em 3 cenários (13º, férias, benefícios,
      deslocamento).
- [ ] Sem emprego atual cadastrado, o comparador funciona e **declara** a ausência da linha de
      base (RN-084).
- [ ] Pesos de critérios não financeiros são do usuário; o sistema não aplica peso sem confirmação
      (RN-085).
- [ ] Plano de estudo sugerido pela IA entra como sugestão editável, nunca aplicado
      automaticamente (RN-075).

---

## FASE 5 — Finalização

### Escopo

1. Biblioteca profissional: upload, tags, vencimento de certificado, busca, vínculo com
   candidatura/certificação.
2. Notificações: resumo diário, ações atrasadas, fonte degradada, teto de IA, prazo de proposta;
   caixa de entrada no app; e-mail com assunto neutro.
3. Modo busca discreta completo (título, favicon, mascaramento, ocultação rápida, quiet mode).
4. Rotinas de retenção, exportação de dados, exclusão de conta.
5. Testes: unitários do domínio, integração de RLS, E2E dos fluxos críticos.
6. Revisão de segurança (checklist do doc 16 §13) e otimização de desempenho.
7. Adaptador `email_alert` (se a avaliação de privacidade aprovar).

### Critérios de aceite

- [ ] Upload de 10 MB passa; 11 MB é rejeitado na borda; tipo verificado por *magic bytes*.
- [ ] Documento só acessível por URL assinada de 60 s; URL de outro usuário retorna 403.
- [ ] Certificado vencendo em 30 dias gera notificação.
- [ ] Resumo diário sai uma vez, no fuso do usuário, com `dedupe_key` impedindo repetição.
- [ ] Em modo discreto: título é "Painel", o assunto do e-mail é neutro, notificação imediata é
      suprimida e valores aparecem mascarados (RN-092).
- [ ] Exclusão de conta remove linhas **e** arquivos dos 4 buckets (teste de integração).
- [ ] Exportação gera JSON + CSV completos e reimportáveis em planilha.
- [ ] Rotina de retenção apaga `job_raw_payloads` > 90 dias e preserva `jobs`.
- [ ] Cobertura de teste: ≥ 80% em `lib/scoring`, `lib/radar/core`, `lib/recruiters`,
      `lib/linkedin/checks`, `lib/offers` (RNF-TST-01).
- [ ] E2E passando: onboarding → coleta manual → candidatura → mover no Kanban → auditoria de
      LinkedIn → comparar proposta.
- [ ] Checklist de segurança do doc 16 §13 com todos os itens marcados.
- [ ] Dashboard carrega em < 1,5 s com 10.000 `job_matches` (dados sintéticos).
- [ ] Nenhuma consulta N+1 nas telas de lista (verificado no log de consultas).
- [ ] Restauração de backup validada em projeto limpo.

---

## Fora do roadmap (Fase 6+, pós-SaaS)

Billing e planos, organizações e times, política de privacidade e DPA formais, MFA obrigatório,
app mobile, API pública, integrações OAuth de calendário. O schema já suporta multi-tenant
(ADR-002); o que falta é produto e conformidade, não banco.
