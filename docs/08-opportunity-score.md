# 08 — Opportunity Score (0 a 100)

> O score responde a uma pergunta prática: **vale a pena gastar 40 minutos preparando uma
> candidatura para esta vaga agora?** Ele não mede a qualidade da empresa nem prevê aprovação.
> Mede o que o sistema pode comprovar: a vaga é nova, há alguém contratando, o perfil combina e a
> oportunidade está bem descrita.

## 1. Contrato da função (RN-032: função pura)

`lib/scoring/opportunity-score.ts`

```ts
export const SCORE_VERSION = '1.0.0';            // lib/scoring/version.ts (RN-033)

export interface ScoreInput {
  now: Date;
  job: {
    publishedAt: Date | null;
    publishedAtConfidence: Confidence;           // 'exact' | 'approximate' | 'unknown'
    firstSeenAt: Date;
    isActive: boolean;
    title: string;
    normalizedTitle: string;
    descriptionText: string | null;
    workModel: WorkModel | null;
    contractType: ContractType | null;
    seniority: Seniority | null;
    city: string | null;
    state: string | null;
    country: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
    salaryPeriod: SalaryPeriod | null;
    salaryIsEstimated: boolean;
    skills: Array<{ slug: string; occurrences: number }>;
    sourceKind: SourceKind;
    duplicateSourceCount: number;                // em quantas fontes a mesma vaga apareceu
  };
  recruiter: {
    linked: boolean;
    activityStatus: RecruiterActivityStatus | null;
    lastActivityAt: Date | null;
    lastActivityConfidence: Confidence | null;
  };
  careerProfile: {
    present: boolean;                            // há perfil profissional vinculado?
    targetTitles: string[];                      // normalizados
    seniority: Seniority | null;
    yearsExperience: number | null;
    skills: Array<{ slug: string; level: 1 | 2 | 3 | 4 | 5 }>;
    acceptedWorkModels: WorkModel[];
    acceptedContractTypes: ContractType[];
    salaryExpectationMin: number | null;
    baseCity: string | null;
    baseState: string | null;
    willingToRelocate: boolean;
  };
  searchProfile: {
    recencyHours: 24 | 72 | 168 | 360;
    weights: { recency: number; recruiter: number; fit: number; quality: number }; // soma 100
  };
}

export interface ComponentResult {
  key: 'recency' | 'recruiter' | 'fit' | 'quality';
  available: boolean;
  max: number;                 // teto deste componente (25 por padrão)
  points: number;              // 0..max; 0 quando available = false
  signals: Array<{ key: string; value: string | number | null; points: number; weight?: number }>;
  missing: string[];           // sinais que faltaram, por chave de i18n
  reasonKey: string;           // chave de i18n da explicação resumida
}

export interface ScoreResult {
  score: number;               // 0..100, inteiro
  version: string;             // SCORE_VERSION
  dataCoverage: number;        // 0..1, duas casas
  lowConfidence: boolean;      // dataCoverage < 0.5
  components: ComponentResult[];
  computedAt: string;          // ISO
}

export function calculateOpportunityScore(input: ScoreInput): ScoreResult;
```

Restrições, verificadas em revisão de código e por teste:

- nenhum `import` de banco, rede, `Date.now()` ou variável de ambiente dentro do módulo;
- determinística: mesma entrada ⇒ mesma saída, bit a bit;
- nunca lança exceção: dado ruim produz componente indisponível, não erro.

## 2. Normalização e cobertura de dados (RN-030)

```
pontos_obtidos  = Σ components[i].points              (apenas available = true)
maximo_disponivel = Σ components[i].max               (apenas available = true)

score         = round( pontos_obtidos / maximo_disponivel * 100 )
data_coverage = maximo_disponivel / 100
```

Casos de borda, normativos:

| Situação | Resultado |
|---|---|
| `maximo_disponivel = 0` (nenhum componente disponível) | `score = null` no banco; a interface exibe "sem dados para pontuar", e a vaga aparece ordenada por recência de detecção. **Nunca `score = 0`.** |
| `data_coverage < 0,5` | `low_confidence = true`; selo "baixa confiança" na interface; **não gera notificação**, por mais alto que seja o score (RN-030) |
| Pesos customizados (RF-SCR-07) | reescalam `max` de cada componente mantendo soma 100; `score_breakdown` grava os pesos usados |

Por que normalizar em vez de atribuir zero: um zero diria "esta oportunidade é ruim" quando o fato
é "o CareerOS não conseguiu medir". Essas duas frases levam a decisões opostas.

## 3. Componente 1 — Recência da vaga (25 pontos)

**Origem do dado:** `jobs.published_at`, `published_at_source`, `published_at_confidence`,
`first_seen_at` (documento 06 §5).

**Disponibilidade:** `available = false` quando `published_at_confidence = 'unknown'` (RN-003).
Nesse caso a interface mostra "detectada em <data>" e este componente sai da conta.

```ts
function scoreRecency(job, searchProfile, now): ComponentResult {
  if (job.publishedAtConfidence === 'unknown')
    return unavailable('recency', ['score.missing.published_at']);

  const hours = hoursBetween(job.publishedAt!, now);
  const base =
    hours <= 6    ? 25 :
    hours <= 24   ? 23 :
    hours <= 48   ? 19 :
    hours <= 72   ? 16 :
    hours <= 168  ? 11 :
    hours <= 360  ? 6  : 2;

  // Penalidade de confiança: data aproximada vale 10% menos (documento 06 §5).
  const points = job.publishedAtConfidence === 'approximate'
    ? roundHalf(base * 0.9)
    : base;

  return { key: 'recency', available: true, max: 25, points, ... };
}
```

| Idade da publicação | Pontos (`exact`) | Pontos (`approximate`) |
|---|---|---|
| ≤ 6 h | 25 | 22,5 |
| ≤ 24 h | 23 | 20,5 |
| ≤ 48 h | 19 | 17 |
| ≤ 72 h | 16 | 14,5 |
| ≤ 7 dias | 11 | 10 |
| ≤ 15 dias | 6 | 5,5 |
| > 15 dias | 2 | 2 |

Vaga com `is_active = false` (encerrada) recebe `points = 0` com `available = true` e sinal
`job_closed`: aqui o zero é medição, não ausência.

**Recálculo obrigatório:** o componente muda sozinho com a passagem do tempo. `recalc-scores`
(diário) recalcula todo `job_match` cujo `job.published_at` tenha cruzado uma das faixas acima.

## 4. Componente 2 — Atividade do recrutador (25 pontos)

**Origem:** `recruiters.activity_status`, `last_activity_at`, `last_activity_confidence`
(documento 07).

**Disponibilidade:** `available = false` quando a vaga não tem recrutador vinculado (RN-035) ou
quando o usuário desativou o módulo (RF-REC-10).

```ts
function scoreRecruiter(r): ComponentResult {
  if (!r.linked) return unavailable('recruiter', ['score.missing.recruiter']);

  switch (r.activityStatus) {
    case 'active_recent': {
      const d = daysSince(r.lastActivityAt!);
      const base = d <= 3 ? 25 : d <= 7 ? 23 : 20;
      return ok(r.lastActivityConfidence === 'approximate' ? base - 2 : base);
    }
    case 'possibly_active':   return ok(12);
    case 'no_activity_found': return ok(4);   // vinculado é melhor que não vinculado: há a quem falar
    default:                  return unavailable('recruiter', ['score.missing.activity_status']);
  }
}
```

| Classificação | Dias desde a evidência | Pontos |
|---|---|---|
| Ativo recentemente | ≤ 3 | 25 (23 se data aproximada) |
| Ativo recentemente | 4 a 7 | 23 (21) |
| Ativo recentemente | 8 a 14 | 20 (18) |
| Possivelmente ativo | — | 12 |
| Sem atividade identificada | — | 4 |
| Sem recrutador vinculado | — | **indisponível** |

Os 4 pontos do último caso não são prêmio de consolação: ter um nome e um perfil público para
abordar é objetivamente melhor que não ter, mesmo sem evidência de atividade.

## 5. Componente 3 — Compatibilidade profissional (25 pontos)

**Origem:** `career_profiles`, `career_profile_skills`, `user_skills`, `experiences` versus
`jobs` + `job_skills`.

**Disponibilidade:** `available = false` quando o perfil de busca não tem perfil profissional
vinculado (RN-010) ou quando o perfil profissional tem completude < 40%.

Cinco sinais, pontuação máxima 25:

| Sinal | Máx. | Cálculo | Dado ausente |
|---|---|---|---|
| Afinidade de título | 8 | melhor similaridade entre `normalized_title` da vaga e `targetTitles` do perfil (`pg_trgm`, calculado antes e passado no input): ≥ 0,85 ⇒ 8; ≥ 0,65 ⇒ 6; ≥ 0,45 ⇒ 4; ≥ 0,30 ⇒ 2; abaixo ⇒ 0 | sem `targetTitles` ⇒ sinal fora do somatório e `max` do componente cai para 17 |
| Cobertura de competências | 9 | `cobertura = Σ peso(skill da vaga ∩ perfil) / Σ peso(skills da vaga)`, peso = `occurrences` limitado a 3; `pontos = round(cobertura × 9)` | vaga sem skills extraídas ⇒ sinal fora, `max` cai 9 |
| Senioridade | 4 | igual ⇒ 4; um nível de distância ⇒ 2; dois ou mais ⇒ 0; vaga sem senioridade ⇒ sinal fora | — |
| Modalidade e contrato | 2 | modalidade aceita ⇒ 1; contrato aceito ⇒ 1; valor nulo na vaga ⇒ sinal fora | — |
| Localização | 2 | mesma cidade, ou remoto, ou `willingToRelocate` ⇒ 2; mesmo estado ⇒ 1; outro estado sem disposição de mudar ⇒ 0 | vaga sem local e sem modalidade ⇒ sinal fora |

Quando um sinal sai do somatório, o `max` do componente diminui na mesma medida, e isso **sobe
para a normalização global**: a cobertura de dados cai, e é isso que informa o usuário de que o
score está medindo pouco. Nenhum sinal ausente vira zero.

```ts
// Esqueleto, para evitar ambiguidade de implementação:
function scoreFit(job, cp): ComponentResult {
  if (!cp.present) return unavailable('fit', ['score.missing.career_profile']);
  const signals = [titleAffinity(job, cp), skillCoverage(job, cp), seniorityMatch(job, cp),
                   modalityMatch(job, cp), locationMatch(job, cp)]
                  .filter((s) => s !== null);
  const max = signals.reduce((a, s) => a + s.max, 0);
  if (max === 0) return unavailable('fit', ['score.missing.comparable_signals']);
  const points = signals.reduce((a, s) => a + s.points, 0);
  return { key: 'fit', available: true, max, points, signals, missing: [...], reasonKey: '...' };
}
```

**Proibição explícita:** não se usa IA neste componente (RNF-COST-03). Similaridade de título vem
de `pg_trgm`, competências vêm do dicionário determinístico. Resultado reproduzível e de custo
zero.

## 6. Componente 4 — Qualidade da oportunidade (25 pontos)

Mede **quanto a vaga se deixa avaliar**: descrição completa, salário informado, localização clara.
Vaga mal descrita é risco real (processo desorganizado, salário incompatível, vaga fantasma).

| Sinal | Máx. | Cálculo | Dado ausente |
|---|---|---|---|
| Salário informado | 8 | `salary_min` presente e `salary_is_estimated = false` ⇒ 8; presente e estimado ⇒ 4; ausente ⇒ **0 com `available = true`** | — |
| Riqueza da descrição | 7 | ≥ 1500 caracteres ⇒ 7; ≥ 800 ⇒ 5; ≥ 300 ⇒ 3; < 300 ⇒ 1; nula ⇒ sinal fora | — |
| Clareza de requisitos | 4 | descrição contém seção de requisitos reconhecível (dicionário de cabeçalhos: "requisitos", "qualificações", "o que buscamos", "requirements") ⇒ 4; só lista de competências ⇒ 2; nada ⇒ 0 | descrição nula ⇒ sinal fora |
| Local e modalidade definidos | 3 | ambos preenchidos ⇒ 3; um ⇒ 2; nenhum ⇒ 0 | — |
| Compatibilidade com a pretensão | 3 | `salary_max >= salaryExpectationMin` ⇒ 3; faixa cruza a pretensão ⇒ 2; abaixo ⇒ 0 | sem salário na vaga ou sem pretensão ⇒ sinal fora |

Ajuste único, aplicado depois da soma dos sinais:

```
se duplicateSourceCount >= 2 → +1 ponto (teto 25), sinal 'multi_source'
```

Motivo: a mesma vaga publicada em duas ou mais fontes independentes é um sinal pequeno, mas real,
de que a vaga existe de fato. Um ponto, nunca mais que isso.

**Salário ausente é zero, não indisponível** — e esta é a única exceção deliberada à regra do
RN-030. Justificativa: a ausência de salário **é** uma característica medível da vaga, não uma
limitação do coletor. A interface explica: "salário não informado pela empresa (−8 pontos)".

## 7. Explicação exibida (RN-034: derivada, nunca gerada por IA)

O texto vem de templates em `lib/i18n/pt-BR.ts`, preenchidos com valores do `score_breakdown`:

```
Score 78/100 · cobertura de dados 100%

Recência        23/25  publicada há 14 horas (data exata, informada pela fonte)
Recrutador      20/25  Ativo recentemente — publicou vaga há 9 dias
Compatibilidade 19/25  8 de 11 competências da vaga estão no seu perfil; senioridade compatível
Qualidade       16/25  salário informado (R$ 5.000–7.000); descrição com 1.240 caracteres

O que não foi possível avaliar: nada.
```

Exemplo com dado faltando — o formato é o mesmo, e a honestidade é visível:

```
Score 71/100 · cobertura de dados 75%  ⚠ baixa cobertura

Recência        19/25  publicada há ~2 dias (data aproximada, texto da fonte)
Recrutador        —    indisponível: esta fonte não informa o recrutador
Compatibilidade 17/25  6 de 9 competências; sua senioridade é um nível acima
Qualidade       18/25  salário informado; local e modalidade definidos

Como melhorar esta medição: cadastre o recrutador desta vaga, se você o conhecer.
```

A última linha é obrigatória sempre que houver componente indisponível e existir ação do usuário
capaz de resolvê-la. Transformar limitação em tarefa acionável é parte do produto.

## 8. Persistência

`job_matches`:

| Campo | Conteúdo |
|---|---|
| `score` | `smallint` 0..100, ou `NULL` quando nenhum componente estava disponível |
| `data_coverage` | `numeric(3,2)` |
| `low_confidence` | `boolean` (gerado: `data_coverage < 0.5`) |
| `score_version` | `SCORE_VERSION` do cálculo |
| `score_breakdown` | `jsonb` com o `ScoreResult` completo (componentes, sinais, faltantes, pesos) |
| `scored_at` | momento do cálculo |

`score_breakdown` é a única fonte da explicação exibida. Regra: **nada aparece na tela do score que
não esteja no `score_breakdown`.** Isso faz com que qualquer número exibido seja auditável.

Índices relevantes: `(user_id, search_profile_id, score DESC, id DESC)` para a listagem ordenada,
e `(user_id, status, scored_at DESC)`.

## 9. Recálculo (RF-SCR-06)

| Gatilho | Escopo |
|---|---|
| Nova coleta encontra ou atualiza a vaga | aquele `job_match` |
| Rotina diária `recalc-scores` | matches cujo componente de recência cruzou faixa, e matches de recrutador que mudou de classificação |
| Usuário altera perfil profissional, competências ou pesos | matches dos perfis de busca vinculados (em lote, assíncrono) |
| `SCORE_VERSION` muda | comando administrativo `npm run score:recalc -- --version=1.1.0`, em lotes de 500, registrando progresso em `collector_runs` com `scope='recalc'` |

`matched_at` só é atualizado quando o score **muda** (RN-024) — assim "novidade" continua
significando novidade.

## 10. O que o score não faz (declarado na interface)

- Não prevê chance de aprovação. Não há dado para isso.
- Não avalia reputação, cultura ou saúde financeira da empresa. Não há fonte confiável e gratuita.
- Não compara salário com o mercado (isso é o módulo Career Intelligence, com `n` e período).
- Não é comparável entre perfis de busca com pesos diferentes — e a interface avisa quando o
  usuário ordena uma lista que mistura perfis com pesos distintos.

## 11. Critérios de conclusão (Fase 2)

- [ ] `calculateOpportunityScore` com cobertura de teste ≥ 90% e nenhum acesso a banco/rede.
- [ ] Teste de normalização: entrada sem recrutador e sem perfil profissional produz
      `score` calculado sobre `max = 50`, `data_coverage = 0.5`, `low_confidence = true`.
- [ ] Teste de ausência total: todos os componentes indisponíveis ⇒ `score = null` (nunca 0).
- [ ] Teste de determinismo: 1.000 execuções com a mesma entrada produzem o mesmo resultado.
- [ ] Teste de decurso de prazo: vaga de 23 h e a mesma de 25 h caem de faixa, e `recalc-scores`
      atualiza.
- [ ] `score_breakdown` contém todos os sinais exibidos na interface (teste de contrato entre a
      função e o componente de UI).
- [ ] Vaga com `low_confidence = true` não gera notificação, mesmo com score 95 (teste).
- [ ] Pesos customizados mantêm a soma dos tetos em 100 (teste de propriedade).
