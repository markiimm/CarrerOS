# 15 — Interface, experiência e design system

> Objetivo visual: parecer uma ferramenta profissional de trabalho, não um painel de demonstração.
> Densidade de informação alta, hierarquia clara, nenhum enfeite que não comunique estado.
> **Dark mode é o tema real** (ADR-009); light é override. Toda a interface em pt-BR (RNF-UX-01).

## 1. Princípios

1. **Decisão antes de relatório.** Cada tela responde a uma pergunta de ação. Gráfico que não
   muda uma decisão não entra.
2. **Dado ausente tem forma própria.** "Não identificado" nunca se parece com zero (RNF-UX-07).
3. **Confiança é visível.** Score, data e atividade de recrutador sempre trazem o selo da sua
   confiança.
4. **Nada pisca.** Tema resolvido antes da hidratação; skeleton por tela; otimismo com reversão.
5. **Desktop primeiro, móvel funcional.** 1280 px é o alvo; 360 px funciona sem quebrar
   (RNF-UX-08).
6. **Discrição é recurso de interface,** não só de notificação: título neutro e máscara de valores
   fazem parte do design.

## 2. Tokens de cor

Definidos como variáveis CSS em `app/globals.css`, no formato HSL sem `hsl()` (padrão shadcn).
O tema escuro vive em `:root`; o claro é override.

```css
:root {                        /* ESCURO — padrão real */
  --background:        222 18% 9%;    /* grafite #14161b  */
  --foreground:        210 20% 96%;
  --card:              222 16% 12%;   /* #181b22 */
  --card-foreground:   210 20% 96%;
  --popover:           222 16% 13%;
  --muted:             222 12% 18%;
  --muted-foreground:  215 14% 65%;
  --border:            222 12% 22%;
  --input:             222 12% 22%;
  --ring:              214 92% 60%;

  --primary:           214 92% 56%;   /* azul #2a7fff */
  --primary-foreground:210 40% 98%;
  --secondary:         222 14% 20%;
  --accent:            214 60% 24%;

  --success:           152 56% 42%;
  --warning:            38 92% 56%;
  --destructive:         0 72% 56%;
  --info:              199 89% 54%;
  --unknown:           220  9% 46%;   /* dado não identificado */

  --chart-1: 214 92% 60%;   --chart-2: 186 72% 50%;
  --chart-3: 152 56% 48%;   --chart-4:  38 92% 60%;
  --chart-5: 280 60% 62%;   --chart-6:   0 72% 60%;

  --radius: 0.625rem;
}

:root[data-theme='light'] {
  --background:        210 20% 98%;
  --foreground:        222 20% 12%;
  --card:                0  0% 100%;
  --muted:             210 16% 94%;
  --muted-foreground:  215 16% 42%;
  --border:            214 16% 86%;
  --primary:           214 90% 46%;   /* escurecido para manter contraste AA */
  --unknown:           220  9% 52%;
}
```

Regras de uso:
- nenhuma cor literal (`#`, `rgb()`) em componente — somente tokens;
- azul é a cor de ação e de dado primário; verde/âmbar/vermelho são **semânticos**, nunca
  decorativos;
- `--unknown` é exclusiva de dado ausente;
- contraste verificado em ambos os temas: 4,5:1 para texto, 3:1 para elementos (RNF-UX-03).

`next-themes` com `attribute="data-theme"`, `defaultTheme="dark"`, `disableTransitionOnChange`.

## 3. Tipografia e espaçamento

| Item | Decisão |
|---|---|
| Fonte de texto | Inter (`next/font/google`), `display: swap`, pesos 400/500/600 |
| Fonte monoespaçada | JetBrains Mono — usada em valores de score, IDs e trechos de código |
| Escala | 12 / 13 / 14 / 16 / 20 / 24 / 32 px; corpo 14 px (densidade de ferramenta) |
| Números | `font-variant-numeric: tabular-nums` em toda tabela e métrica |
| Espaçamento | múltiplos de 4 px; respiro de card 16 px (confortável) ou 12 px (compacto) |
| Largura de leitura | máx. 72ch em texto corrido (achados do LinkedIn, explicações) |

## 4. Estrutura de tela

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│  SIDEBAR     │  TOPBAR  título · busca (/) · modo discreto · sino · avatar │
│  260 px      ├──────────────────────────────────────────────────────────────┤
│  grupos:     │  PAGE HEADER  título + descrição curta + ações primárias     │
│  Visão geral │                                                              │
│  Oportunid.  │  CONTEÚDO  grade de 12 colunas, gap 16 px                    │
│  Posicion.   │                                                              │
│  Relacion.   │                                                              │
│  Decisão     │                                                              │
│  Material    │                                                              │
│  Sistema     │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

- item ativo: fundo `--secondary` + barra esquerda de 2 px em `--primary`;
- badge numérico só com valor > 0;
- selo de modo discreto fixo na topbar quando ativo, em `--warning` discreto;
- em < 1024 px a sidebar vira gaveta; em 1024–1279 px, só ícones com tooltip.

## 5. Componentes de domínio (nome, forma e regra)

| Componente | Forma | Regra que materializa |
|---|---|---|
| `ScoreBadge` | círculo 44 px com número; anel segmentado em 4 arcos (um por componente) | cinza quando `score = null`; selo "baixa confiança" quando `low_confidence` (RN-030) |
| `ScoreBreakdown` | 4 linhas: componente, pontos/máx, barra, frase derivada | texto vem de template sobre `score_breakdown` (RN-034) |
| `ConfidenceBadge` | ícone + rótulo: "data exata" / "~aproximada" / "não confirmada" | RN-002; `unknown` muda o verbo para "detectada em" |
| `UnknownValue` | traço em `--unknown` + tooltip "não identificado — como obter" | RNF-UX-07, RN-001 |
| `RecruiterStatusBadge` | verde/âmbar/cinza + data da evidência + link | documento 07 §3; cinza sempre acompanhado da frase de ressalva |
| `JobCard` | título, empresa, local+modalidade, salário ou `UnknownValue`, `ScoreBadge`, selos (nova, duplicada em N fontes, encerrada) | RN-013 (vetada nunca aparece), RN-005 (estimado marcado) |
| `KanbanCard` | empresa, cargo, score, dias no estágio, próxima ação, selos (estagnado, atrasado, vaga encerrada) | RN-055, RN-056 |
| `SampleSizeNote` | "n = 23 · últimos 30 dias · base: vagas coletadas" | RN-004, RF-INT-06 |
| `FindingCard` | 5 blocos rotulados + prioridade + botão copiar; `[PREENCHER: ...]` destacado | RN-063, RN-065 |
| `AiOutputFooter` | "modelo · versão do prompt · data · reaproveitado do cache" | RF-AIA-06, RN-006 |
| `MaskedValue` | valor oculto com clique para revelar | RF-DIS-05, RN-092 |
| `CostEstimate` | "esta análise deve custar ~US$ 0,04 — consumo do mês: 1,20 de 10,00" | RNF-COST-04, RN-070 |

## 6. Gráficos (recharts)

| Onde | Tipo | Cuidados |
|---|---|---|
| Vagas por dia (30 d) | linha | sem área preenchida; marcar dias sem coleta como lacuna, **não** como zero |
| Funil de candidaturas | barras horizontais | contagem absoluta no rótulo; sem porcentagem sem base |
| Evolução do score de LinkedIn | linha + pontos | marcador quando a base de seções mudou (RN-066) |
| Competências mais exigidas | barras | `SampleSizeNote` obrigatória |
| Faixa salarial | boxplot simplificado (p25–mediana–p75) | só com `salary_is_estimated = false` (RN-005) |

Regras: paleta `--chart-*` na ordem; eixo Y sempre começa em 0 em contagem; tooltip com valor
absoluto e data completa; nenhum gráfico sem título e sem origem do dado.

## 7. Estados, carregamento e erro

| Estado | Padrão |
|---|---|
| Carregando | skeleton com a forma do conteúdo real (cards, linhas de tabela) |
| Vazio inicial | ilustração mínima + frase do que fazer + botão primário (RNF-UX-05) |
| Vazio por filtro | resumo dos filtros + "limpar filtros" |
| Erro | `error.tsx` por segmento, mensagem em pt-BR, código de correlação, "tentar de novo" |
| Operação longa | barra de progresso indeterminada + "você pode sair desta tela" (RNF-UX-10) |
| Otimista | aplica na hora, reverte com toast em erro (RNF-RES-07) |

## 8. Formulários

- `react-hook-form` + resolver Zod, com o **mesmo schema** usado no servidor;
- rótulo sempre visível (nunca só placeholder); erro abaixo do campo, em texto, não só cor;
- campos monetários com máscara BRL e `inputMode="decimal"`;
- formulários longos (perfil de busca, proposta) divididos em seções com salvamento parcial;
- ação destrutiva exige confirmação; exclusão de conta exige digitar a palavra (RNF-UX-09).

## 9. Acessibilidade

| Requisito | Implementação |
|---|---|
| Teclado | ordem de foco natural; anel de foco visível em `--ring`; atalhos do documento 12 §5 |
| Kanban | alternativa por teclado obrigatória (pegar/mover/soltar) |
| Leitor de tela | `aria-live` em toasts e em conclusão de coleta/auditoria; tabelas com `<caption>` |
| Cor | nunca o único portador de informação: selo sempre tem ícone e texto |
| Movimento | `prefers-reduced-motion` desliga transições (RNF-UX-12) |
| Alvos | mínimo 32×32 px em desktop, 44×44 px em toque |

## 10. Internacionalização e formatação

- todas as strings em `lib/i18n/pt-BR.ts`, objeto tipado; texto solto em JSX é erro de lint;
- datas com `date-fns` + `date-fns-tz` no fuso do usuário; relativo ("há 3 horas") com data
  absoluta em `title` (RNF-UX-11);
- moeda e número via `Intl`, locale do usuário, moeda do registro (RNF-I18N-02);
- nomes técnicos permanecem em inglês quando é o uso corrente ("Kanban", "score", "front-end"),
  mas a explicação é em português.

## 11. Microcópia — padrões obrigatórios

| Situação | Texto |
|---|---|
| Vaga sem data confiável | "detectada em 10/11 às 06:12 · data de publicação não confirmada" |
| Score sem componente | "não foi possível avaliar: esta fonte não informa o recrutador" |
| Estatística com amostra baixa | "amostra insuficiente (n = 4). Precisamos de pelo menos 8 vagas." |
| Fonte não permitida | "Indisponível: os termos de uso desta plataforma não permitem coleta automatizada." |
| Recrutador sem evidência | "Sem atividade identificada. Isso não significa que o recrutador esteja inativo." |
| Teto de IA atingido | "Limite mensal de US$ 10,00 atingido. O ciclo reinicia em 01/12. Você pode aumentar o limite em Configurações." |
| Sugestão de IA | "Revise antes de publicar — este texto usa apenas o que você informou." |

Nenhuma mensagem culpa o usuário; nenhuma mensagem esconde limitação do sistema.

## 12. Critérios de conclusão (verificados na Fase 5)

- [ ] Nenhuma cor literal fora de `globals.css` (regra de lint ou revisão documentada).
- [ ] Todas as telas funcionam em escuro e claro, a 1280 px e a 360 px.
- [ ] Contraste AA verificado nas duas paletas (ferramenta automatizada + revisão).
- [ ] Toda listagem tem os quatro estados do §7.
- [ ] `UnknownValue` aparece em 100% dos campos que podem faltar — nenhum zero no lugar.
- [ ] Kanban operável só com teclado.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Nenhuma string de interface fora de `lib/i18n/pt-BR.ts`.
