# 12 — Mapa de navegação

> Rotas em português (são visíveis ao usuário); arquivos e código em inglês (RNF-MNT-08).
> Nenhuma rota de aplicação responde sem sessão válida (RF-DIS-06).

## 1. Árvore de navegação com rótulos de menu

```
/                                   → redireciona (sessão ? /painel : /login)

PÚBLICO
/login                              Entrar
/cadastro                           Criar conta
/recuperar-senha                    Recuperar senha
/nova-senha                         Definir nova senha (link do e-mail)

MENU LATERAL (ordem fixa)
┌ Visão geral
│  /painel                          Painel                              [Fase 1]
├ Oportunidades
│  /radar                           Job Radar                           [Fase 2]
│  /radar/perfis                    Perfis de busca                     [Fase 2]
│  /radar/execucoes                 Execuções da coleta                 [Fase 2]
│  /candidaturas                    Candidaturas (Kanban)               [Fase 2]
│  /candidaturas/metricas           Métricas do funil                   [Fase 2]
├ Posicionamento
│  /linkedin                        LinkedIn Analyzer                   [Fase 3]
│  /assistente                      Assistente de carreira              [Fase 4]
│  /perfil                          Perfil profissional                 [Fase 1]
├ Relacionamento
│  /recrutadores                    Recrutadores                        [Fase 2/4]
│  /recrutadores/empresas           Empresas                            [Fase 4]
├ Decisão
│  /mercado                         Inteligência de mercado             [Fase 4]
│  /propostas                       Propostas                           [Fase 4]
│  /evolucao                        Evolução profissional               [Fase 4]
├ Material
│  /biblioteca                      Biblioteca                          [Fase 5]
└ Sistema
   /notificacoes                    Notificações                        [Fase 5]
   /configuracoes                   Configurações                       [Fase 1+]
```

Itens de fase futura **não aparecem** no menu antes da fase correspondente. Nada de item que
abre tela vazia dizendo "em breve".

## 2. Rotas, dados e ações principais

| Rota | Lê | Ação principal | Fase |
|---|---|---|---|
| `/painel` | `dashboard_counters()`, top 5 `job_matches`, agenda, séries | enviar vaga ao Kanban, concluir ação, coletar agora | 1 |
| `/radar` | `job_matches` + `jobs` + `companies` (cursor, 25/página) | salvar · descartar com motivo · enviar ao Kanban | 2 |
| `/radar/[jobId]` | vaga, decomposição do score, duplicatas, recrutador | candidatar-se (abre fonte) · analisar com IA | 2 |
| `/radar/perfis` | `search_profiles` + contadores | criar · duplicar · ativar/desativar | 2 |
| `/radar/perfis/[id]` | filtros, fontes do perfil, pesos | salvar filtros · coletar agora | 2 |
| `/radar/execucoes` | `collector_runs` + saúde das fontes | reexecutar · abrir erro | 2 |
| `/radar/nova-vaga` | — | cadastrar vaga manual | 2 |
| `/candidaturas` | `applications` por estágio | mover cartão · definir próxima ação · arquivar | 2 |
| `/candidaturas/[id]` | candidatura, `application_events`, entrevistas, anexos | registrar nota/contato/entrevista · vincular currículo e recrutador | 2 |
| `/candidaturas/metricas` | conversão e tempo por estágio | alternar período | 2 |
| `/linkedin` | auditorias, evolução do score | nova análise · comparar | 3 |
| `/linkedin/nova` | — | escolher entrada · revisar snapshot · analisar | 3 |
| `/linkedin/[id]` | seções, achados por prioridade | copiar texto · marcar aplicada/ignorada | 3 |
| `/linkedin/[id]/comparar` | original versus otimizado; auditoria A versus B | copiar · exportar | 3 |
| `/assistente` | `assistant_threads` | nova análise/currículo/carta/simulação | 4 |
| `/recrutadores` | `recruiters` + classificação + evidência | registrar atividade · agendar follow-up | 2 |
| `/recrutadores/[id]` | linha do tempo unificada | registrar interação · mesclar duplicata · excluir | 4 |
| `/recrutadores/empresas/[id]` | vagas, candidaturas, recrutadores, notas | marcar alvo/vetada | 4 |
| `/mercado` | `market_insights` com `n` e período | recortar por local/senioridade · virar plano de estudo | 4 |
| `/propostas/comparar` | `job_offers` + `current_employment` | ajustar pesos · simular contraproposta · registrar decisão | 4 |
| `/evolucao` | competências, lacunas, planos, metas | criar plano · lançar horas · registrar marco | 4 |
| `/biblioteca` | `documents` + cota | enviar · etiquetar · baixar (URL assinada) · excluir | 5 |
| `/configuracoes/fontes` | `job_sources` + `user_job_sources` | ativar/desativar; fonte não permitida fica desabilitada com motivo | 2 |
| `/configuracoes/privacidade` | `user_settings`, `company_blocklist` | modo discreto · PIN · vetadas · logs · retenção | 5 |

## 3. Fluxos de entrada (como o usuário chega onde importa)

```
PRIMEIRO USO
/cadastro → confirmação de e-mail → /login → /painel (estado vazio guiado)
  → "Criar perfil profissional"  → /perfil
  → "Criar primeiro perfil de busca" → /radar/perfis (exige perfil profissional? não,
     mas avisa que o componente de compatibilidade do score ficará indisponível)
  → "Coletar agora" → /radar

ROTINA DIÁRIA (o caminho que o produto otimiza)
/painel
  → top 5 oportunidades → /radar/[jobId]
      → enviar ao Kanban → /candidaturas (cartão em "Interesse")
      → descartar com motivo → volta ao /painel
  → ações atrasadas → /candidaturas/[id]

CICLO DE MELHORIA DE PERFIL
/linkedin → nova análise → revisar snapshot → relatório
  → aplicar recomendação no LinkedIn (fora do sistema, por cópia)
  → marcar como aplicada → nova análise em 30 dias → comparar evolução

DECISÃO DE TROCA
/candidaturas/[id] (estágio "Proposta") → "cadastrar proposta" → /propostas/nova
  → /propostas/comparar (contra emprego atual) → registrar decisão
```

## 4. Estados de cada rota (obrigatórios)

Toda rota de listagem implementa quatro estados, e nenhum deles é tela branca:

| Estado | Comportamento |
|---|---|
| Carregando | skeleton específico da tela (RNF-UX-06) |
| Vazio por falta de dado | explica o que fazer, com ação primária (RNF-UX-05). Ex.: "Nenhuma vaga coletada ainda. Crie um perfil de busca e dispare a primeira coleta." |
| Vazio por filtro | "Nenhuma vaga com estes filtros" + resumo dos filtros aplicados + "limpar filtros" |
| Erro | `error.tsx` do segmento, mensagem em pt-BR, código de correlação e botão de nova tentativa (documento 04 §7) |

## 5. Navegação lateral: comportamento

- Largura 260 px em ≥ 1280 px; recolhida a ícones entre 1024 e 1279 px; gaveta em < 1024 px.
- Item ativo destacado por barra lateral azul + fundo elevado (documento 15 §4).
- Badges numéricos: vagas novas (`job_matches.status='new'`), ações atrasadas, notificações não
  lidas. Badge só aparece com valor > 0 — nunca "0".
- Indicador de **modo discreto** permanente no topo quando ativo, com rótulo neutro.
- Atalhos de teclado: `g p` painel · `g r` radar · `g c` candidaturas · `g l` linkedin ·
  `/` busca · `?` lista de atalhos. (RNF-UX-04)

## 6. Breadcrumbs e títulos

- Título do documento: `<Página> · CareerOS`, **exceto** com modo discreto ativo, quando passa a
  ser `user_settings.neutral_title` (padrão "Painel") em todas as rotas (RN-092).
- Breadcrumb só em rotas de terceiro nível (`/radar/perfis/[id]`, `/linkedin/[id]/comparar`).

## 7. Proteção de rotas (resumo executável)

```ts
// middleware.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)'],
};

// Lógica:
// 1. getUser() a partir dos cookies (renova o token)
// 2. rota pública + sessão  → redirect /painel
// 3. rota protegida sem sessão → redirect /login?next=<rota>
// 4. rota de api/cron        → não passa por aqui (autenticação por CRON_SECRET)
// 5. PIN ativo e expirado    → redirect /bloqueio (tela de PIN), preservando a rota de destino
```
