# 07 — Monitoramento de atividade de recrutadores

> Regra que organiza todo este documento: **perfil online não é atividade de recrutamento.**
> O sistema só afirma que um recrutador está ativo quando existe uma linha de evidência datada,
> com URL e trecho, em `recruiter_activities`. Sem evidência, a resposta honesta é
> "sem atividade identificada" — e essa é uma resposta aceitável do produto.

## 1. O que este módulo pode e o que não pode fazer

| Pode | Não pode |
|---|---|
| Derivar atividade de vagas que o próprio CareerOS coletou (campo "publicado por" de ATS e feeds). | Fazer login, raspar perfil autenticado ou usar API privada de rede social. |
| Ler páginas públicas de recrutamento da empresa, quando a fonte é `allowed` (documento 14). | Presumir atividade a partir de "aberto para oportunidades", nº de conexões, foto nova ou headline atualizada (RN-042). |
| Registrar atividade observada **manualmente** pelo usuário (ele viu um post, recebeu uma mensagem). | Monitorar pessoas continuamente em plataformas que proíbem coleta automatizada. |
| Vincular recrutador ↔ vaga ↔ empresa ↔ candidatura. | Armazenar dado pessoal sensível ou contato privado obtido fora de interação com o usuário (RN-045). |

**Consequência de produto, declarada ao usuário na própria tela:** na prática, a maior parte das
evidências virá de (a) vagas coletadas e (b) registro manual. O módulo é especificado para ser
útil mesmo que **nenhuma** fonte automatizada de atividade esteja disponível.

## 2. Modelo de dados do módulo (ver documento 10 §8)

```
recruiters ─┬─1:N─> recruiter_activities      (evidência datada, com URL e trecho)
            ├─1:N─> recruiter_contacts        (interações registradas pelo usuário)
            └─1:N─> jobs.recruiter_id         (vaga cujo responsável é este recrutador)
```

Não existe tabela separada para o vínculo vaga↔recrutador: o vínculo é
`jobs.recruiter_id` (quem é o responsável) e a **evidência** desse vínculo é a linha de
`recruiter_activities` com `activity_type='job_post'` e `job_id` preenchido, protegida pelo índice
único `(recruiter_id, job_id)`. Uma tabela a mais só duplicaria essa informação, e duplicata de
dado é divergência futura.

Toda evidência tem esta forma:

```ts
interface RecruiterActivity {
  recruiterId: string;
  activityType:
    | 'job_post'          // publicou/é responsável por vaga   → relacionado a recrutamento
    | 'recruiting_post'   // post público sobre contratação     → relacionado a recrutamento
    | 'hiring_comment'    // comentário público sobre vaga      → relacionado a recrutamento
    | 'direct_contact'    // ele contatou o usuário             → relacionado, evidência forte
    | 'event'             // participação em evento de carreira → relacionado
    | 'generic_post'      // post público não relacionado       → NÃO relacionado
    | 'profile_update'    // mudança de headline/cargo          → NÃO relacionado (RN-042)
    | 'user_observation'; // o usuário viu algo e registrou     → ele marca se é relacionado
  isRecruitingRelated: boolean;   // derivado do tipo, gravado para permitir consulta
  occurredAt: Date | null;        // quando o fato aconteceu
  occurredAtConfidence: 'exact' | 'approximate' | 'unknown';
  observedAt: Date;               // quando o CareerOS tomou conhecimento
  url: string | null;             // onde isso pode ser verificado
  excerpt: string | null;         // trecho curto (<= 280 caracteres), para o usuário conferir
  sourceId: string | null;        // fonte que trouxe a evidência
  jobId: string | null;           // vaga, quando activityType = 'job_post'
  createdBy: 'system' | 'user';
}
```

Invariantes verificados por teste **e** por constraint no banco:

1. `isRecruitingRelated` é verdadeiro apenas para `job_post`, `recruiting_post`, `hiring_comment`,
   `direct_contact`, `event` e para `user_observation` quando o usuário marcar.
2. `profile_update` e `generic_post` **nunca** têm `isRecruitingRelated = true`
   (`recruiter_activities_not_related_chk`).
3. Evidência sem `occurredAt` tem `occurredAtConfidence = 'unknown'`
   (`recruiter_activities_confidence_chk`) e usa `observedAt` apenas para ordenação — mesmo
   tratamento dado à data de vaga (RN-002).
4. `url` ou `excerpt` é obrigatório (`recruiter_activities_evidence_chk`, RN-040).
5. `excerpt` é truncado no servidor em 280 caracteres; nunca se armazena o conteúdo integral da
   publicação de um terceiro.

## 3. Algoritmo de classificação (RN-041)

Função pura, sem acesso a banco nem rede, em `lib/recruiters/classify.ts`:

```ts
export const RECRUITER_ACTIVE_DAYS = 14;
export const RECRUITER_POSSIBLE_DAYS = 60;

export interface ClassificationResult {
  status: 'active_recent' | 'possibly_active' | 'no_activity_found';
  basedOn: { activityId: string; activityType: string; occurredAt: Date; confidence: Confidence } | null;
  reason: string;              // chave de i18n, nunca frase solta
  nextReviewAt: Date | null;   // quando a classificação muda sozinha por decurso de prazo
}

export function classifyRecruiter(activities: RecruiterActivity[], now = new Date()): ClassificationResult {
  const recruiting = activities
    .filter((a) => a.isRecruitingRelated && effectiveDate(a) !== null)
    .sort(byEffectiveDateDesc);

  const top = recruiting[0];
  if (top) {
    const days = daysBetween(effectiveDate(top)!, now);
    const trustworthy = top.occurredAtConfidence !== 'unknown';

    if (days <= RECRUITER_ACTIVE_DAYS && trustworthy)
      return ok('active_recent', top, addDays(effectiveDate(top)!, RECRUITER_ACTIVE_DAYS + 1));

    if (days <= RECRUITER_POSSIBLE_DAYS)
      return ok('possibly_active', top, addDays(effectiveDate(top)!, RECRUITER_POSSIBLE_DAYS + 1));
  }

  // Atividade genérica recente alcança, no máximo, "possivelmente ativo".
  const generic = activities
    .filter((a) => !a.isRecruitingRelated && a.activityType !== 'profile_update' && effectiveDate(a) !== null)
    .sort(byEffectiveDateDesc)[0];

  if (generic && daysBetween(effectiveDate(generic)!, now) <= RECRUITER_ACTIVE_DAYS)
    return ok('possibly_active', generic, addDays(effectiveDate(generic)!, RECRUITER_ACTIVE_DAYS + 1));

  return { status: 'no_activity_found', basedOn: null, reason: 'recruiter.no_evidence', nextReviewAt: null };
}

/** occurredAt quando existe; caso contrário observedAt, cuja confiança é sempre 'unknown'. */
function effectiveDate(a: RecruiterActivity): Date | null {
  return a.occurredAt ?? a.observedAt ?? null;
}
```

### Tabela de decisão (é esta tabela que o teste de unidade percorre)

| Evidência mais recente relacionada a recrutamento | Confiança da data | Classificação |
|---|---|---|
| ≤ 14 dias | `exact` ou `approximate` | **Ativo recentemente** |
| ≤ 14 dias | `unknown` | Possivelmente ativo |
| 15 a 60 dias | qualquer | Possivelmente ativo |
| > 60 dias | qualquer | Sem atividade identificada |
| nenhuma, mas post genérico ≤ 14 dias | qualquer | Possivelmente ativo |
| nenhuma, apenas `profile_update` | qualquer | **Sem atividade identificada** (RN-042) |
| nenhuma | — | Sem atividade identificada |

### Rótulos e microcópia obrigatórios (pt-BR)

| Status | Rótulo | Cor do selo | Texto de apoio |
|---|---|---|---|
| `active_recent` | "Ativo recentemente" | verde | "Publicou vaga em 08/11 — ver evidência" |
| `possibly_active` | "Possivelmente ativo" | âmbar | "Última atividade identificada há 32 dias — data aproximada" |
| `no_activity_found` | "Sem atividade identificada" | cinza | "Não encontramos evidência pública datada. Isso não significa que o recrutador esteja inativo." |

A última frase é obrigatória: impede que o usuário leia ausência de dado como fato negativo.

## 4. Persistência e campos derivados

`recruiters` guarda o resultado da classificação, para permitir filtro e ordenação sem recalcular:

| Campo | Origem |
|---|---|
| `activity_status` | resultado de `classifyRecruiter` |
| `activity_status_reason` | `reason` (chave de i18n) |
| `activity_status_updated_at` | momento do cálculo |
| `last_activity_id` | `basedOn.activityId` (FK para `recruiter_activities`) |
| `last_activity_at` | `basedOn.occurredAt` |
| `last_activity_confidence` | `basedOn.confidence` |
| `next_review_at` | `nextReviewAt` — a rotina diária recalcula só o que venceu |

**Regra de integridade:** `activity_status` nunca é escrito por mutação direta do usuário. Apenas
`lib/recruiters/update-status.ts` escreve esses campos, e ele é chamado em todo caminho que insere
atividade (coleta, formulário manual, importação). Teste cobre os três caminhos.

## 5. Rotinas automáticas

### 5.1 Durante a coleta de vagas (RN-043)

`linkRecruiterFromJob(job)` em `lib/radar/core/recruiter-link.ts`:

```
se job.recruiter.fullName ausente → retorna (o componente de score fica ausente)
normaliza o nome (minúsculas, sem acento, sem pontuação, espaços colapsados)
procura recruiter por normalized_profile_url OU por (normalized_name, company_id)
  encontrado → usa
  não        → cria com source='job_source' e user_id do dono do perfil de busca
grava jobs.recruiter_id
insere recruiter_activities:
  activity_type          = 'job_post'
  occurred_at            = jobs.published_at
  occurred_at_confidence = jobs.published_at_confidence     ← herda, nunca melhora
  url                    = jobs.canonical_url ?? jobs.apply_url
  excerpt                = jobs.title (truncado em 280)
  job_id = jobs.id · source_id = jobs.source_id · created_by = 'system'
  ON CONFLICT (recruiter_id, job_id) DO NOTHING             ← idempotente
recalcula a classificação do recrutador
```

A herança de confiança é a parte essencial: vaga com data `unknown` produz atividade `unknown`,
que por RN-041 não alcança "Ativo recentemente". É assim que se impede falso positivo gerado por
fonte sem data.

### 5.2 Rotina diária — `POST /api/cron/refresh-recruiters`

```
1. seleciona recrutadores com next_review_at <= now()
      OU activity_status_updated_at < now() - interval '1 day'
2. recarrega atividades, reclassifica, grava apenas se houve mudança
3. registra a execução em collector_runs (source_id = NULL, scope = 'recruiters')
4. quem caiu de 'active_recent' gera notificação SOMENTE se estiver vinculado a candidatura
   ativa — evita ruído sem valor
```

Esta rotina existe por um motivo único e suficiente: **uma evidência de 14 dias vira de 15 sem que
nada aconteça** (RN-044). Classificação defasada é bug, não detalhe.

### 5.3 Fontes de evidência automatizada, por disponibilidade real

| Origem | Status | Observação |
|---|---|---|
| Campo "responsável/recrutador" em ATS público (Greenhouse, Lever, Ashby) | disponível quando a empresa preenche | principal fonte automática; cobertura real baixa |
| Página pública de carreiras com JSON-LD (`hiringOrganization`, `author`) | parcial | em regra identifica a empresa, raramente a pessoa |
| Feeds RSS/Atom de vagas | raro | normalmente sem autor |
| Rede social profissional | **não disponível** | coleta automatizada vedada por ToS; o caminho é a entrada manual (RN-090) |
| Registro manual pelo usuário | sempre disponível | cidadão de primeira classe neste módulo |

## 6. Entrada manual (caminho principal, não secundário)

A tela "registrar atividade observada" pede exatamente o que a regra exige, e nada além:

| Campo | Obrigatório | Validação |
|---|---|---|
| Recrutador | sim | existente, ou criado no mesmo formulário |
| Tipo de atividade | sim | lista fechada; o usuário marca se é relacionada a recrutamento |
| Quando aconteceu | sim | data; o usuário escolhe "data exata" ou "aproximada" → define `occurred_at_confidence` |
| URL | não | ausente ⇒ `excerpt` passa a obrigatório (é preciso alguma verificabilidade) |
| Trecho | condicional | ≤ 280 caracteres |

Formulário com URL **e** trecho vazios é rejeitado — pela aplicação e pela constraint (RN-040).

## 7. Ficha do recrutador (o que a tela mostra)

1. Identificação: nome, headline, empresa, link do perfil público.
2. Classificação com selo, **evidência clicável** e data (RF-REC-05).
3. Linha do tempo unificada: atividades públicas detectadas + interações registradas pelo usuário,
   em ordem cronológica, com ícone distinguindo origem `system` de `user`.
4. Vagas em que este recrutador é o responsável (`jobs.recruiter_id`), com score de cada uma.
5. Candidaturas vinculadas.
6. Follow-ups em aberto, com data.
7. Ações: registrar atividade, registrar interação, agendar follow-up, mesclar duplicata, excluir.

## 8. Deduplicação de recrutadores (RF-CRM-09)

```
chave forte:  normalized_profile_url (sem query string, sem barra final)   → UNIQUE
chave fraca:  (normalized_name, company_id)
sugestão de mesclagem: similarity(normalized_name) >= 0,90 E mesma company_id
```

Mesclagem é explícita (o usuário confirma) e reversível por 30 dias: a linha absorvida recebe
`merged_into_id` e `merged_at`, atividades e contatos são reapontados por `UPDATE`, nada é apagado.

## 9. Privacidade (RN-045, RNF-PRIV-02)

- **Armazena-se:** nome, headline, empresa, URL pública, especialidades, atividades com URL e
  trecho, interações registradas pelo usuário.
- **Não se armazena:** telefone ou e-mail pessoal obtido sem interação, endereço, foto, dado de
  família, qualquer categoria sensível da LGPD.
- Contato só é gravado quando o próprio recrutador o forneceu ao usuário. O campo tem rótulo
  explícito: "informado por ele mesmo em <data>".
- Exclusão de recrutador remove atividades, contatos e vínculos em cascata, disponível na própria
  tela do recrutador, sem exigir justificativa.
- `GET /api/recruiters/:id/export` devolve tudo o que o sistema guarda sobre aquela pessoa, para
  atender a pedido de titular de dados.

## 10. Interação com o Opportunity Score

| Situação | Componente "atividade do recrutador" |
|---|---|
| Vaga sem recrutador vinculado | `available: false` — score normalizado sem este componente (RN-035) |
| Recrutador vinculado, `no_activity_found` | disponível, 4 pontos (documento 08 §4) |
| `possibly_active` | 12 pontos |
| `active_recent` | 20 a 25 pontos, conforme recência e confiança |

Decisão explícita: ausência de recrutador **não** penaliza a vaga. Penalizar transformaria uma
limitação da fonte em juízo sobre a oportunidade.

## 11. Critérios de conclusão (Fase 2)

- [ ] `classifyRecruiter` tem teste de tabela cobrindo as 7 linhas da tabela de decisão do §3.
- [ ] Teste específico de RN-042: 10 atividades `profile_update` recentes ⇒ `no_activity_found`.
- [ ] Teste de decurso de prazo: a mesma evidência classifica `active_recent` em D+14 e
      `possibly_active` em D+15, sem nenhum dado novo.
- [ ] Herança de confiança: vaga com `published_at_confidence='unknown'` nunca produz
      `active_recent`.
- [ ] Toda classificação exibida traz evidência clicável, data e confiança.
- [ ] Vinculação automática recrutador↔vaga é idempotente (coletar duas vezes não duplica
      atividade — garantido pelo índice único).
- [ ] Entrada manual rejeita evidência sem URL e sem trecho (teste de aplicação **e** de constraint).
- [ ] Exclusão de recrutador remove tudo em cascata (teste).
- [ ] O módulo pode ser desligado por completo (RF-REC-10, `user_settings.recruiter_monitoring_enabled`)
      sem afetar o radar: o componente de score passa a `available: false`.
