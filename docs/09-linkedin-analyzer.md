# 09 — LinkedIn Analyzer

> Módulo declarado como prioridade do produto. Premissa técnica que define todo o desenho:
> **o CareerOS não tem acesso garantido ao LinkedIn.** Não há login, não há API privada, não há
> automação de conta (RN-090, RN-091). O módulo é especificado para funcionar 100% com o material
> que o próprio usuário fornece; a leitura de URL pública é um atalho oportunista, nunca um
> requisito.

## 1. Pipeline completo

```
┌─ ENTRADA (4 formas) ────────────────────────────────────────────────────────┐
│  URL pública (best-effort)   texto colado   PDF exportado   formulário      │
└───────────────┬─────────────────────────────────────────────────────────────┘
                ▼
       1. ingest        normaliza para ProfileSnapshot (determinístico, sem IA)
                ▼
       2. coverage      o que foi detectado, o que não foi, por que (sem IA)
                ▼
       3. REVISÃO HUMANA OBRIGATÓRIA  ← o usuário confere/corrige o snapshot
                ▼
       4. heuristics    verificações objetivas (presença, tamanho, contagens, URLs)
                ▼
       5. ai-evaluate   IA avalia qualidade textual por seção → notas e achados
                ▼
       6. validate      validador anti-invenção (documento 20 §5) + Zod
                ▼
       7. score         somatório ponderado determinístico (código, não IA)
                ▼
       8. persist       audit + sections + findings (imutável)
                ▼
       9. compare       diff com auditoria anterior, gráfico de evolução
└──────────────────────────────────────────────────────────────────────────────┘
```

Divisão de responsabilidade, que é a decisão central deste módulo:

| Quem decide | O quê |
|---|---|
| **Código determinístico** | o que existe e o que falta, contagens, tamanhos, presença de URL, score, peso, prioridade, comparação entre auditorias |
| **IA** | qualidade do texto: a headline comunica? o "Sobre" tem proposta de valor? o bullet descreve resultado ou só tarefa? reescrita exemplar |

A IA nunca calcula o score, nunca decide prioridade e nunca inventa fato (RN-007, RN-065).

## 2. Entrada 1 — URL pública (best-effort, RN-061)

```ts
// lib/linkedin/ingest/from-url.ts
type UrlAttemptResult =
  | { ok: true; html: string; fetchedAt: Date }
  | { ok: false; reason: 'login_wall' | 'blocked' | 'not_found' | 'partial' | 'network' | 'not_allowed' };
```

Regras obrigatórias:

1. Requisição **única**, sem sessão, sem cookie, sem cabeçalho falsificado, com `User-Agent`
   identificável e `timeout` de 10 s. Uma tentativa; sem retry agressivo.
2. `robots.txt` consultado e respeitado. Trajeto desautorizado ⇒ `not_allowed` sem requisição.
3. Qualquer resultado diferente de `ok` **não é erro do produto**: a interface informa o que
   aconteceu, em pt-BR, e apresenta as outras três entradas com um clique.
4. Nenhuma tentativa de contornar bloqueio: sem proxy, sem *headless browser*, sem serviço de
   scraping terceirizado (lista de proibidos, documento 04 §2.9).
5. Mesmo com `ok: true`, o conteúdo obtido costuma ser parcial. O relatório de cobertura (§5) dirá
   exatamente o que veio.

Mensagem padrão quando falha (texto final, pt-BR):

> Não foi possível ler o perfil pela URL. Isso é comum: o LinkedIn limita a leitura automatizada de
> perfis. Nada no seu perfil foi alterado e nenhuma tentativa de login foi feita.
> Use uma das opções abaixo — o resultado da análise é o mesmo.
> **1) Exportar PDF do perfil** (Mais → Salvar como PDF) · **2) Colar o texto** · **3) Preencher o formulário**

## 3. Entrada 2 — texto colado

Parser determinístico em `lib/linkedin/ingest/from-text.ts`, por reconhecimento de cabeçalhos de
seção em pt-BR e en-US:

| Seção | Cabeçalhos reconhecidos |
|---|---|
| Sobre | "Sobre", "About" |
| Experiência | "Experiência", "Experiences", "Experience" |
| Formação | "Formação acadêmica", "Education" |
| Licenças e certificados | "Licenças e certificados", "Licenses & certifications", "Certificações" |
| Competências | "Principais competências", "Competências", "Skills", "Top skills" |
| Projetos | "Projetos", "Projects" |
| Recomendações | "Recomendações", "Recommendations" |

Heurísticas de experiência (testadas com fixtures reais):
- linha de cargo seguida de linha de empresa e de período (`mar de 2023 - o momento`,
  `Mar 2023 - Present`, `2021 - 2023`);
- cálculo de duração a partir do período, com `is_current` quando o fim é "o momento"/"Present";
- bullets detectados por marcador (`•`, `-`, `*`) ou quebra de linha com verbo no infinitivo.

Texto que não se encaixa em nenhuma seção vai para `unparsed`, é mostrado ao usuário na revisão e
**não** é descartado em silêncio.

## 4. Entrada 3 — PDF exportado pelo usuário

```
upload → validação (MIME application/pdf, ≤ 10 MB)        [RF-BIB-07]
       → documents (kind='linkedin_pdf', is_sensitive=true, bucket privado)  [RN-067]
       → extração de texto no servidor (unpdf/pdf-parse)
       → mesmo parser da entrada 2, com ajustes de layout do PDF do LinkedIn
       → ProfileSnapshot
```

Limitações do PDF, que a cobertura declara automaticamente:
- **não contém** foto de perfil nem imagem de capa (`not_evaluable` para as duas seções);
- competências vêm truncadas ("Principais competências" traz apenas as 3 fixadas);
- recomendações aparecem sem o autor em alguns layouts;
- ordem das seções varia conforme o idioma da conta.

O PDF é dado sensível: excluir a auditoria exclui o documento no Storage (RN-067, RF-LKD-14).

## 5. `ProfileSnapshot` e relatório de cobertura (RF-LKD-02)

```ts
export interface ProfileSnapshot {
  inputMethod: 'public_url' | 'pasted_text' | 'pdf_export' | 'manual_form';
  capturedAt: string;
  headline: string | null;
  about: string | null;
  location: string | null;
  photo: { present: boolean | null; declaredByUser: boolean };   // null = não avaliável
  cover: { present: boolean | null; declaredByUser: boolean };
  experiences: Array<{
    title: string; company: string; startDate: string | null; endDate: string | null;
    isCurrent: boolean; description: string | null; bullets: string[];
  }>;
  educations: Array<{ institution: string; degree: string | null; field: string | null;
                      startYear: number | null; endYear: number | null }>;
  certifications: Array<{ name: string; issuer: string | null; issuedAt: string | null }>;
  skills: string[];
  projects: Array<{ name: string; description: string | null; url: string | null }>;
  recommendationsCount: number | null;
  links: Array<{ kind: 'github' | 'portfolio' | 'article' | 'other'; url: string }>;
  unparsed: string[];
}

export interface SectionCoverage {
  section: SectionKey;
  status: 'detected' | 'partial' | 'not_detected' | 'not_evaluable';
  why: string;          // chave de i18n
  howToProvide: string; // chave de i18n — ação concreta para o usuário
}
```

Matriz de avaliabilidade por entrada — é a tabela do RN-060, aqui em forma executável
(`lib/linkedin/evaluability.ts`):

| Seção (`section_key`) | URL pública | Texto colado | PDF | Formulário |
|---|---|---|---|---|
| `photo` | detectável | não avaliável | não avaliável | declaração do usuário |
| `cover` | detectável | não avaliável | não avaliável | declaração do usuário |
| `headline` | sim | sim | sim | sim |
| `about` | sim | sim | sim | sim |
| `experiences` | sim | sim | sim | sim |
| `education` | sim | sim | sim | sim |
| `certifications` | sim | sim | sim | sim |
| `skills` | sim | parcial | parcial | sim |
| `projects` | parcial | parcial | parcial | sim |
| `github_portfolio` | sim | sim | sim | sim |
| `keywords` | sim | sim | sim | sim |
| `clarity` | sim | sim | sim | sim |

**`not_evaluable` nunca recebe nota** e é excluída da normalização (mesma mecânica do RN-030).
A tela de cobertura é exibida **antes** da análise, com o custo estimado da chamada de IA
(RNF-COST-04) e o botão "analisar assim" ou "fornecer mais dados".

## 6. Revisão humana obrigatória (etapa 3)

Antes de qualquer chamada de IA, o usuário vê o snapshot extraído em formulário editável e
confirma. Razões: (a) o parser erra; (b) analisar dado errado produz recomendação errada;
(c) é a oportunidade de o usuário fornecer o que o PDF não traz (foto, capa, competências
completas).

A auditoria referencia `linkedin_profile_versions.id`, que guarda o snapshot **após** a revisão.
Auditoria sem versão revisada não é criada.

## 7. Avaliação por seção

### 7.1 Camada determinística (sem IA, sempre executada)

| Seção | Verificações objetivas | Nota automática |
|---|---|---|
| `headline` | existe; comprimento (alvo 70–220 caracteres); contém cargo-alvo; contém "\|" ou separador; não é só o cargo atual | 0–10 |
| `about` | existe; ≥ 600 caracteres; ≥ 3 parágrafos; contém número/resultado; contém chamada para contato | 0–10 |
| `experiences` | nº de experiências; % com descrição; média de bullets; % de bullets com número; presença de tecnologias; lacunas temporais > 6 meses | 0–10 |
| `education` | ao menos uma formação com instituição e período | 0–10 |
| `certifications` | quantidade; alguma nos últimos 24 meses; vencidas sinalizadas | 0–10 |
| `skills` | quantidade (alvo ≥ 15); interseção com competências do perfil profissional do CareerOS | 0–10 |
| `projects` | quantidade; descrição presente; URL presente e com esquema `https` | 0–10 |
| `github_portfolio` | presença de URL de GitHub e/ou portfólio; URL válida e pública | 0–10 |
| `keywords` | cobertura das palavras-chave do perfil de busca escolhido (RF-LKD-12), por dicionário determinístico | 0–10 |
| `photo` / `cover` | presença (quando avaliável) | 0–10 |
| `clarity` | não determinístico — ver 7.2 | — |

### 7.2 Camada de IA (avalia qualidade textual)

Uma única chamada por auditoria, com saída estruturada (documento 20 §4):

```ts
const SectionEvaluation = z.object({
  sectionKey: z.enum(SECTION_KEYS),
  score0to10: z.number().int().min(0).max(10),
  rationale: z.string().max(400),              // por que esta nota
  findings: z.array(z.object({
    issue:      z.string().max(300),           // 1. o que está errado/incompleto
    impact:     z.string().max(300),           // 2. por que prejudica
    howToFix:   z.string().max(400),           // 3. como corrigir
    exampleText: z.string().max(1200),         // 4. exemplo de texto melhorado
    severity:   z.enum(['critical', 'high', 'medium', 'low']),
    usedFacts:  z.array(z.string()),           // trechos da ENTRADA que sustentam o exemplo
    placeholders: z.array(z.string()),         // marcadores [PREENCHER: ...] presentes
  })).max(4),
  optimizedText: z.string().max(2500).nullable(), // reescrita da seção, quando aplicável
});
```

Nota final da seção: `round( 0,5 × nota_determinística + 0,5 × nota_da_IA )`, exceto
`photo`, `cover`, `education` e `github_portfolio`, que são 100% determinísticas, e `clarity`,
que é 100% da IA. A fórmula fica em `lib/linkedin/section-score.ts` e é exibida ao usuário em
"como calculamos".

## 8. Score geral (RN-062)

Pesos padrão em `lib/linkedin/weights.ts`, soma 100 — exibidos na interface:

| Seção | Peso |
|---|---|
| `experiences` | 20 |
| `about` | 15 |
| `headline` | 12 |
| `clarity` | 12 |
| `skills` | 10 |
| `keywords` | 10 |
| `education` | 6 |
| `certifications` | 6 |
| `projects` | 6 |
| `github_portfolio` | 6 |
| `photo` | 5 |
| `cover` | 2 |

```
pontos_seção     = (nota_0a10 / 10) × peso
peso_avaliado    = Σ pesos das seções com status = 'evaluated'
score_geral      = round( Σ pontos_seção / peso_avaliado × 100 )
cobertura_perfil = peso_avaliado / 100
```

Exemplo real de entrada por PDF (foto e capa não avaliáveis ⇒ `peso_avaliado = 93`):

```
Score 64/100 · cobertura da análise 93% (foto e capa não avaliadas nesta entrada)
```

`cobertura_perfil < 0,6` ⇒ selo "análise parcial" e aviso de que comparar com auditoria de base
diferente exige cuidado (RN-066).

## 9. Prioridade das recomendações (RN-064)

```
prioridade = round( peso_da_seção × severidade × (1 - nota_da_seção / 10) )
severidade: critical = 3 · high = 2 · medium = 1,5 · low = 1
```

Exemplo: "Sobre" (peso 15) com nota 3 e severidade `high` ⇒ `15 × 2 × 0,7 = 21`.
Lista ordenada por prioridade decrescente, agrupada em faixas exibidas como
**Crítico (≥ 20) · Alto (10–19) · Médio (4–9) · Baixo (< 4)**.

Reprodutível por construção: a mesma auditoria sempre gera a mesma ordem, e o usuário pode
conferir a conta.

## 10. Comparação original versus otimizado (RF-LKD-06)

Duas colunas por seção, com:
- texto original exatamente como está no snapshot;
- `optimizedText`, com os marcadores `[PREENCHER: ...]` destacados em cor própria;
- botão "copiar" (RF-LKD-11) e contador de caracteres com os limites reais do LinkedIn
  (headline 220, Sobre 2.600, descrição de experiência 2.000);
- aviso fixo: "revise antes de publicar — este texto é sugestão baseada apenas no que você
  informou".

Nenhuma aplicação automática: o usuário copia e cola no LinkedIn (RN-075, RN-090).

## 11. Histórico e evolução (RF-LKD-07, RF-LKD-10, RN-066)

- Auditoria concluída é **imutável**: RLS sem `UPDATE`/`DELETE` nas seções e achados; só o campo
  `status` dos achados (pendente/aplicada/ignorada) é mutável, por tabela de rastreamento própria
  (`linkedin_audit_findings.status`, `status_changed_at`).
- Nova análise cria nova auditoria com `previous_audit_id`.
- A comparação entre duas auditorias usa **somente seções avaliadas em ambas** e declara quando a
  base mudou: "a auditoria de 12/09 não avaliou foto; a comparação desconsidera essa seção".
- Gráfico de evolução: score geral por auditoria, com marcadores de quantas recomendações foram
  aplicadas entre elas. É o número que mostra se o trabalho surtiu efeito.

## 12. Anti-invenção (RN-007, RN-065 — detalhe no documento 20 §5)

Validador `lib/ai/validators/no-fabrication.ts`, executado antes de persistir:

```
para cada finding e optimizedText:
  extrai entidades do texto gerado: empresas, cargos, datas, números, percentuais,
    tecnologias, nomes de certificação, nomes de instituição
  para cada entidade:
    se NÃO aparece no ProfileSnapshot (comparação normalizada: minúsculas, sem acento)
       e NÃO está dentro de um marcador [PREENCHER: ...]
       e NÃO está na lista de termos genéricos permitidos (lib/ai/allowlist-generic.ts)
    → rejeita a auditoria com erro 'fabricated_entity' e registra a entidade em ai_runs.error_code
uma única nova tentativa com instrução de correção (RN-073); falhando, a auditoria termina como
'failed' com mensagem explicativa — nunca se exibe saída não validada
```

Teste obrigatório com caso preparado: snapshot sem nenhum número, resposta de IA injetada contendo
"aumentei a disponibilidade em 35%" ⇒ validador rejeita.

## 13. Estados da auditoria e execução assíncrona

```
queued → running → completed
                 ↘ failed (com error_code e mensagem em pt-BR)
```

`POST /api/linkedin/audits` responde `202 { auditId }`; a interface faz polling de
`GET /api/linkedin/audits/:id` a cada 2 s (documento 04 §5). O usuário pode sair da tela
(RNF-UX-10). Tempo alvo ≤ 60 s (RNF-PERF-06).

Cache por hash (RN-071): `sha256('linkedin_audit' | prompt_version | model | snapshot_canônico)`.
Snapshot idêntico ao de uma auditoria dos últimos 30 dias reaproveita o resultado, marcado como
"reaproveitado" na interface, sem nova cobrança.

## 14. Dados

Tabelas (detalhe no documento 10): `linkedin_profile_versions`, `linkedin_audits`,
`linkedin_audit_sections`, `linkedin_audit_findings`, `documents` (PDF), `ai_runs`.

## 15. Critérios de conclusão (Fase 3)

- [ ] As quatro entradas produzem `ProfileSnapshot` válido; a de URL falha graciosamente com as
      alternativas visíveis (teste com respostas 200 parcial, 302 para login, 403 e timeout).
- [ ] Parser de texto e de PDF testados com, no mínimo, 5 fixtures reais cada (pt-BR e en-US).
- [ ] Nenhuma seção `not_evaluable` recebe nota; todas saem da normalização e aparecem listadas.
- [ ] Revisão humana do snapshot é obrigatória antes de qualquer chamada de IA (teste de rota).
- [ ] Todo achado tem as cinco partes do RN-063; achado incompleto é rejeitado antes de gravar.
- [ ] Validador anti-invenção rejeita empresa, cargo, data, número e tecnologia ausentes na
      entrada (um teste por categoria).
- [ ] `[PREENCHER: ...]` aparece sempre que a sugestão depender de dado inexistente.
- [ ] Prioridade calculada confere com a fórmula do RN-064 em três casos manuais documentados.
- [ ] Duas auditorias geram comparação correta, ignorando seções não avaliadas em uma delas.
- [ ] Marcar recomendação como aplicada persiste com data e aparece no dashboard (RF-DSH-05).
- [ ] Excluir auditoria remove o PDF do Storage (teste que confere ausência do objeto).
- [ ] Auditoria concluída não pode ser alterada: `UPDATE` em seções e achados é negado pela RLS
      (teste).
- [ ] Nenhuma chamada de IA ocorre sem registro em `ai_runs` com custo e versão de prompt.
