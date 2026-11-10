# 07 — Monitoramento de recrutadores

> **Premissa honesta, antes de qualquer linha de código:** não existe API pública que entregue
> "recrutadores ativos nas últimas 24 horas". O LinkedIn não permite coleta automatizada de
> perfis, e nenhuma alternativa confiável substitui isso. Portanto este módulo **não** é um
> raspador de perfis: é um **sistema de registro de evidências**, alimentado por três canais
> legítimos, que classifica atividade a partir do que foi efetivamente observado e datado.
>
> Qualquer implementação que tente burlar isso (login automatizado, headless browser no
> LinkedIn, compra de base de perfis) está **fora da especificação** e viola RN-090, RN-091 e
> ADR-007.

## 1. O que este módulo resolve

O usuário perde tempo com dois tipos de vaga: a antiga e a **órfã** — publicada por um
recrutador que não mexe no processo há semanas. O sinal "quem está realmente contratando agora"
vale mais que o volume de vagas. Como esse sinal não é comprável, o CareerOS o **constrói**, de
forma incremental, a partir de evidência datada.

## 2. Os três canais de evidência (e só estes)

| # | Canal | Origem | Confiança típica | Fase | Automatizado |
|---|---|---|---|---|---|
| 1 | **Derivado de vaga coletada** | o próprio Job Radar: vaga cujo responsável está identificado no payload (Greenhouse/Lever/Ashby frequentemente expõem `recruiter`/`hiring_manager`) | `exact` se a data da vaga é `exact` | 2 | sim |
| 2 | **Registro manual pelo usuário** | o usuário viu um post, recebeu uma mensagem, falou numa entrevista — e registra com URL e data | declarada pelo usuário | 2 | não |
| 3 | **Feeds e páginas públicas autorizadas** | feed RSS/JSON de blog de carreiras, página pública de equipe, feed público de evento de recrutamento, API oficial que exponha autor da vaga | conforme a fonte | 4 | sim, por adaptador |

O canal 1 é o que carrega o produto: **toda vaga coletada com responsável identificado produz
automaticamente uma evidência de atividade** (RN-043). Sem escrever um raspador, o sistema
acumula, a cada ciclo de coleta, um mapa de quem está publicando vaga — que é exatamente a
definição útil de "recrutador ativo".

### O que explicitamente **não** é evidência (RN-042)

- existir perfil público;
- ter foto, capa, headline bonita ou muitas conexões;
- ter atualizado a headline;
- ter o selo "aberto para oportunidades" ou "#hiring" **sem** post datado associado;
- aparecer como "funcionário" de uma empresa que tem vagas abertas.

Isto é verificado por teste unitário obrigatório (RNF-TST-02): um recrutador com perfil completo
e nenhuma `recruiter_activity` deve classificar como `no_activity_found`.

## 3. Modelo de dados do módulo

```
recruiters ──1:N──> recruiter_activities        (evidências datadas, imutáveis)
    │ │
    │ └───1:N──> recruiter_contacts             (interações do usuário; pessoal)
    └─────1:N──> recruiter_jobs                 (vaga ↔ recrutador, com papel)
companies ──1:N──> recruiters                   (empresa atual declarada)
```

Campos decisivos (detalhe completo no documento 10):

| Tabela.campo | Papel |
|---|---|
| `recruiters.activity_status` | `active_recent` \| `possibly_active` \| `no_activity_found` — **sempre derivado**, nunca editado à mão |
| `recruiters.last_activity_at` | `occurred_at` da evidência de recrutamento mais recente |
| `recruiters.last_activity_confidence` | `exact` \| `approximate` \| `unknown` |
| `recruiters.status_computed_at` | quando a classificação foi recalculada (detecta classificação defasada) |
| `recruiter_activities.activity_type` | `job_post` \| `recruiting_post` \| `hiring_comment` \| `message_to_user` \| `profile_update` \| `generic_post` \| `event` |
| `recruiter_activities.occurred_at` | data do fato. **Nulo é permitido**; então `observed_at` manda e a confiança cai |
| `recruiter_activities.evidence_url` | obrigatório para tipos automáticos; opcional para registro manual |
| `recruiter_activities.excerpt` | até 500 caracteres do texto observado — prova mínima, sem copiar conteúdo inteiro |
| `recruiter_activities.source` | `job_radar` \| `user_manual` \| `public_feed` |

`recruiter_activities` é **somente inserção** (RLS sem `UPDATE`/`DELETE`, como
`application_events`): o histórico de evidências é a base da classificação e não pode ser
reescrito.

## 4. O classificador (função pura, testável)

`lib/recruiters/classify.ts`:

```ts
export const RECRUITER_ACTIVE_DAYS = 14;
export const RECRUITER_POSSIBLE_DAYS = 60;

/** Tipos que contam como atividade DE RECRUTAMENTO. */
const RECRUITING_TYPES = new Set(['job_post', 'recruiting_post', 'hiring_comment', 'message_to_user']);
/** Tipos que indicam apenas presença online — nunca elevam a active_recent. */
const GENERIC_TYPES = new Set(['profile_update', 'generic_post', 'event']);

export interface ActivityInput {
  activityType: string;
  occurredAt: Date | null;
  observedAt: Date;
  confidence: Confidence;          // 'exact' | 'approximate' | 'unknown'
}

export interface ClassificationResult {
  status: 'active_recent' | 'possibly_active' | 'no_activity_found';
  lastActivityAt: Date | null;
  lastActivityConfidence: Confidence | null;
  basedOn: { activityType: string; ageDays: number } | null;
  reason: string;                  // chave de i18n, não frase pronta
}

export function classifyRecruiter(activities: ActivityInput[], now = new Date()): ClassificationResult {
  if (activities.length === 0)
    return { status: 'no_activity_found', lastActivityAt: null, lastActivityConfidence: null,
             basedOn: null, reason: 'recruiter.reason.no_evidence' };

  const dated = activities.map(a => ({
    ...a,
    // data efetiva: occurred_at quando existe; senão observed_at com confiança rebaixada
    effectiveAt: a.occurredAt ?? a.observedAt,
    effectiveConfidence: a.occurredAt ? a.confidence : 'unknown' as Confidence,
  }));

  const recruiting = dated.filter(a => RECRUITING_TYPES.has(a.activityType))
                          .sort((a, b) => +b.effectiveAt - +a.effectiveAt);
  const generic    = dated.filter(a => GENERIC_TYPES.has(a.activityType))
                          .sort((a, b) => +b.effectiveAt - +a.effectiveAt);

  const top = recruiting[0];
  if (top) {
    const ageDays = diffDays(now, top.effectiveAt);
    const basedOn = { activityType: top.activityType, ageDays };

    if (ageDays <= RECRUITER_ACTIVE_DAYS && top.effectiveConfidence !== 'unknown')
      return { status: 'active_recent', lastActivityAt: top.effectiveAt,
               lastActivityConfidence: top.effectiveConfidence, basedOn,
               reason: 'recruiter.reason.recent_recruiting_evidence' };

    if (ageDays <= RECRUITER_POSSIBLE_DAYS)        // cobre 15–60 dias E ≤14 com confiança unknown
      return { status: 'possibly_active', lastActivityAt: top.effectiveAt,
               lastActivityConfidence: top.effectiveConfidence, basedOn,
               reason: ageDays <= RECRUITER_ACTIVE_DAYS
                 ? 'recruiter.reason.recent_but_unconfirmed_date'
                 : 'recruiter.reason.evidence_within_60_days' };
  }

  // Sem evidência de recrutamento recente: atividade genérica recente ⇒ no máximo "possivelmente".
  const g = generic[0];
  if (g && diffDays(now, g.effectiveAt) <= RECRUITER_ACTIVE_DAYS)
    return { status: 'possibly_active', lastActivityAt: g.effectiveAt,
             lastActivityConfidence: g.effectiveConfidence,
             basedOn: { activityType: g.activityType, ageDays: diffDays(now, g.effectiveAt) },
             reason: 'recruiter.reason.generic_activity_only' };

  const newest = dated.sort((a, b) => +b.effectiveAt - +a.effectiveAt)[0];
  return { status: 'no_activity_found', lastActivityAt: newest.effectiveAt,
           lastActivityConfidence: newest.effectiveConfidence,
           basedOn: { activityType: newest.activityType, ageDays: diffDays(now, newest.effectiveAt) },
           reason: 'recruiter.reason.evidence_too_old' };
}
```

### Tabela-verdade de referência (testes obrigatórios)

| Evidência mais recente | Tipo | `occurred_at` | Confiança | Resultado |
|---|---|---|---|---|
| nenhuma | — | — | — | `no_activity_found` |
| 2 dias | `job_post` | sim | `exact` | `active_recent` |
| 2 dias | `job_post` | sim | `approximate` | `active_recent` |
| 2 dias | `job_post` | **não** (só `observed_at`) | → `unknown` | `possibly_active` |
| 20 dias | `recruiting_post` | sim | `exact` | `possibly_active` |
| 75 dias | `job_post` | sim | `exact` | `no_activity_found` |
| 3 dias | `profile_update` | sim | `exact` | `possibly_active` |
| 3 dias | `generic_post` + 90 dias `job_post` | — | — | `possibly_active` |
| 30 dias | `profile_update` apenas | sim | `exact` | `no_activity_found` |

## 5. Recálculo (RN-044)

Uma classificação **expira sozinha**: evidência de 14 dias vira 15 sem nenhum evento novo.
Portanto:

1. **Na coleta** — ao criar `job_post`, reclassifica o recrutador afetado.
2. **Diariamente** — `POST /api/cron/refresh-recruiters` reclassifica **todos** os recrutadores
   cuja `status_computed_at < now() - interval '20 hours'`, em lotes, dentro do orçamento de
   tempo do cron (mesmo padrão *chunked* do coletor).
3. **Na leitura** — a UI nunca recalcula, mas **exibe** `status_computed_at`; se for maior que
   48 h, mostra o selo "classificação a confirmar". Isso torna a defasagem visível em vez de
   mentir ao usuário.

Query do lote diário:

```sql
SELECT id FROM recruiters
 WHERE status_computed_at IS NULL OR status_computed_at < now() - interval '20 hours'
 ORDER BY status_computed_at NULLS FIRST
 LIMIT 200;
```

## 6. Vinculação vaga ↔ recrutador

`linkRecruiterFromJob` (etapa 8 do pipeline, documento 06 §4.3):

```
se RawJob.recruiter tem profileUrl
   → casa por normalize(profileUrl)                        [chave forte]
senão se tem fullName e companyDomain
   → casa por (normalize(fullName), company_id)            [chave média]
senão
   → não cria recrutador. Não inventa nome a partir do texto da vaga.  [RN-001]

ao casar ou criar:
   INSERT recruiter_jobs (recruiter_id, job_id, role)       role: 'recruiter' | 'hiring_manager' | 'unknown'
   INSERT recruiter_activities (type='job_post',
                                occurred_at = jobs.published_at,
                                confidence  = jobs.published_at_confidence,   -- herda (RN-043)
                                evidence_url = jobs.canonical_url,
                                source='job_radar')
   ON CONFLICT (recruiter_id, job_id, activity_type) DO NOTHING   -- idempotente
   → classifyRecruiter(...)
```

**Nunca** se extrai nome de recrutador com IA ou regex do corpo da descrição ("envie seu CV para
a Maria"): isso produz identidades falsas. Só payload estruturado conta.

## 7. Interface do módulo (o que a tela precisa mostrar)

Cada recrutador exibe, obrigatoriamente:

1. **Classificação** com cor e rótulo pt-BR: Ativo recentemente / Possivelmente ativo / Sem
   atividade identificada;
2. **A frase da evidência**: "com base em vaga publicada há 3 dias" — derivada de `basedOn`, por
   template (nunca por IA, RN-034 por analogia);
3. **Data da última atividade** com marcador de confiança (`~` para aproximada, "não confirmada"
   para `unknown`);
4. **`status_computed_at`** ("classificação recalculada hoje às 10:15");
5. **Lista de evidências** com link e trecho — o usuário pode auditar a classificação;
6. **Vagas divulgadas** por este recrutador (via `recruiter_jobs`);
7. **Histórico de interação** do usuário (`recruiter_contacts`) e próxima ação.

Estados vazios são parte da especificação: "Nenhuma atividade identificada — isso não significa
que o recrutador esteja inativo, apenas que o CareerOS não encontrou evidência pública datada."
Essa frase, ou equivalente, é obrigatória (RNF-UX-06 / RN-001).

## 8. Privacidade (RN-045) — não negociável

| Regra | Implementação |
|---|---|
| Somente dado profissional público | colunas limitadas a nome, headline, empresa, URL pública, evidências. Sem telefone/e-mail pessoal obtido de terceiros. |
| Contato só se houve interação | `recruiter_contacts.channel` exige interação real registrada pelo usuário. |
| Direito de exclusão | `DELETE /api/recruiters/:id` remove recrutador, evidências, contatos e vínculos, em cascata, sem soft delete. |
| Minimização | `excerpt` limitado a 500 caracteres; payload bruto do perfil **não** é armazenado. |
| Sem perfilamento sensível | proibido inferir ou armazenar gênero, idade, etnia, religião, orientação, saúde ou opinião política — nem como campo, nem como tag, nem em nota livre analisada por IA. |
| Exportação | o usuário exporta seus dados de CRM em CSV/JSON (RF-CRM-09). |

## 9. Critérios de conclusão do módulo

- [ ] Toda vaga coletada com recrutador estruturado gera `recruiter_activities` idempotente.
- [ ] `classifyRecruiter` passa a tabela-verdade de §4 (9 casos) em teste unitário.
- [ ] Teste prova que perfil completo sem evidência ⇒ `no_activity_found` (RN-042).
- [ ] Cron diário reclassifica em lote e registra execução; nenhum recrutador fica com
      `status_computed_at` > 48 h sem selo na UI.
- [ ] A UI de cada recrutador mostra classificação, evidência, data com confiança e lista
      auditável.
- [ ] Exclusão de recrutador remove tudo em cascata (teste de integração).
- [ ] Nenhuma chamada de rede a plataforma com `legal_status != 'allowed'` (teste do guard).
