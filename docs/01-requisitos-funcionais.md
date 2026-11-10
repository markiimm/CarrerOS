# 01 — Requisitos Funcionais

**Convenção de IDs:** `RF-<MÓDULO>-<nº>`. Os critérios de aceite do documento 17 referenciam
estes IDs. Prioridade: **P0** = sem isso a fase não fecha; **P1** = importante; **P2** = desejável.

Módulos: `AUT` autenticação · `PRF` perfil · `BSC` perfis de busca · `DSH` dashboard ·
`RAD` job radar · `REC` recrutadores · `SCR` score · `KAN` kanban · `LKD` linkedin analyzer ·
`AIA` assistente de IA · `CRM` recruiter CRM · `INT` career intelligence · `OFR` offer comparator ·
`GRW` career growth · `BIB` biblioteca · `DIS` modo discreto · `CFG` configurações ·
`NOT` notificações.

---

## 1. Autenticação e conta (AUT)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-AUT-01 | O sistema deve permitir cadastro com e-mail e senha via Supabase Auth, com confirmação de e-mail obrigatória. | P0 | 1 |
| RF-AUT-02 | O sistema deve permitir login com e-mail/senha e com Magic Link. | P0 | 1 |
| RF-AUT-03 | O sistema deve permitir recuperação de senha por e-mail. | P0 | 1 |
| RF-AUT-04 | O sistema deve criar automaticamente o registro em `profiles` no primeiro login (trigger no banco). | P0 | 1 |
| RF-AUT-05 | O sistema deve encerrar a sessão em todos os dispositivos quando solicitado. | P1 | 5 |
| RF-AUT-06 | O sistema deve permitir exclusão da conta com remoção em cascata de todos os dados pessoais e arquivos no Storage, exigindo confirmação textual. | P0 | 5 |
| RF-AUT-07 | O sistema deve permitir exportar todos os dados do usuário em JSON (portabilidade LGPD). | P1 | 5 |
| RF-AUT-08 | O sistema não deve permitir acesso a nenhuma rota de aplicação sem sessão válida, redirecionando para `/login`. | P0 | 1 |
| RF-AUT-09 | O sistema deve suportar login com provedor OAuth (Google) como opção. | P2 | 5 |

## 2. Perfil profissional (PRF)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-PRF-01 | O usuário deve poder cadastrar dados pessoais profissionais: nome, headline, cidade, estado, país, disponibilidade de mudança, disponibilidade para viagem, pretensão salarial, modalidades aceitas. | P0 | 1 |
| RF-PRF-02 | O usuário deve poder criar **múltiplos perfis profissionais** (ex.: "Suporte Técnico", "Front-End", "Análise de Dados"), cada um com título, senioridade, resumo, anos de experiência e conjunto próprio de competências. | P0 | 1 |
| RF-PRF-03 | O usuário deve poder marcar um perfil profissional como primário. | P1 | 1 |
| RF-PRF-04 | O usuário deve poder registrar experiências profissionais (empresa, cargo, período, descrição, realizações, tecnologias). | P0 | 1 |
| RF-PRF-05 | O usuário deve poder registrar formações acadêmicas e certificações, com data de emissão e validade. | P0 | 1 |
| RF-PRF-06 | O sistema deve calcular e exibir o percentual de completude de cada perfil profissional, listando o que falta. | P1 | 1 |
| RF-PRF-07 | O usuário deve poder registrar o emprego atual com remuneração e benefícios, usado como linha de base pelo Offer Comparator. Este dado é marcado como sensível. | P0 | 1 |
| RF-PRF-08 | O usuário deve poder anexar links públicos (GitHub, portfólio, LinkedIn, artigos). | P1 | 1 |
| RF-PRF-09 | O sistema deve permitir importar dados de perfil a partir de um PDF de currículo ou do PDF exportado do LinkedIn, com revisão humana obrigatória antes de gravar. | P2 | 3 |

## 3. Perfis de busca (BSC)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-BSC-01 | O usuário deve poder criar múltiplos perfis de busca, nomeados, **ativos simultaneamente**. | P0 | 2 |
| RF-BSC-02 | Cada perfil de busca deve ter filtros **independentes**: palavras-chave, palavras-chave excluídas, áreas, cargos, localizações, modalidade (presencial/híbrido/remoto), tipo de contratação (CLT/PJ/estágio/temporário/freelance), faixa salarial, senioridade e janela de recência. | P0 | 2 |
| RF-BSC-02a | Cada perfil de busca deve poder ser vinculado a um perfil profissional, que fornece a base de compatibilidade do score. | P0 | 2 |
| RF-BSC-03 | A janela de recência deve ter 24 horas como padrão, com opções de 3, 7 e 15 dias. | P0 | 2 |
| RF-BSC-04 | O usuário deve poder selecionar quais fontes de vagas cada perfil de busca consulta. | P0 | 2 |
| RF-BSC-05 | O usuário deve poder ativar/desativar, duplicar e excluir um perfil de busca; exclusão preserva o histórico de vagas já encontradas. | P1 | 2 |
| RF-BSC-06 | O usuário deve poder definir um score mínimo por perfil de busca, abaixo do qual a vaga não gera notificação. | P1 | 2 |
| RF-BSC-07 | O usuário deve poder definir a frequência de coleta por perfil de busca entre as opções suportadas pelo plano de hospedagem. | P1 | 2 |
| RF-BSC-08 | O sistema deve limitar o número de perfis de busca ativos por usuário conforme configuração (padrão: 10), para controle de custo. | P1 | 2 |

## 4. Dashboard (DSH)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-DSH-01 | O dashboard deve exibir indicadores do dia: vagas novas nas últimas 24h, vagas com score ≥ 70, candidaturas ativas, entrevistas agendadas nos próximos 7 dias, ações pendentes atrasadas. | P0 | 1 |
| RF-DSH-02 | O dashboard deve exibir as 5 melhores oportunidades do momento, ordenadas por Opportunity Score, com acesso direto à vaga. | P0 | 2 |
| RF-DSH-03 | O dashboard deve exibir gráfico de vagas encontradas por dia nos últimos 30 dias. | P1 | 2 |
| RF-DSH-04 | O dashboard deve exibir o funil de candidaturas por estágio do Kanban. | P1 | 2 |
| RF-DSH-05 | O dashboard deve exibir o score atual do LinkedIn e sua variação desde a auditoria anterior. | P1 | 3 |
| RF-DSH-06 | O dashboard deve exibir a saúde das fontes de vagas (última execução, status, erros). | P1 | 2 |
| RF-DSH-07 | O dashboard deve exibir as próximas ações da agenda (follow-ups, entrevistas, prazos de candidatura). | P0 | 2 |
| RF-DSH-08 | Cada card do dashboard deve indicar quando não há dado suficiente, em vez de exibir zero como se fosse medição. | P0 | 1 |
| RF-DSH-09 | O dashboard deve exibir consumo de IA do mês contra o teto configurado. | P1 | 4 |

## 5. Job Radar (RAD)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-RAD-01 | O sistema deve coletar vagas automaticamente, em horário agendado no servidor, para todos os perfis de busca ativos. | P0 | 2 |
| RF-RAD-02 | O sistema deve suportar múltiplas fontes de vagas por meio de adaptadores independentes, sem alteração do núcleo para adicionar uma fonte. | P0 | 2 |
| RF-RAD-03 | O sistema deve aplicar filtro padrão de últimas 24 horas e permitir 3, 7 e 15 dias. | P0 | 2 |
| RF-RAD-04 | O sistema deve identificar e marcar vagas duplicadas entre fontes, exibindo uma única vez com as demais fontes listadas. | P0 | 2 |
| RF-RAD-05 | O sistema deve registrar a origem da data de publicação (`api_field`, `page_metadata`, `http_header`, `inferido`) e o grau de confiança (`exact`, `approximate`, `unknown`). | P0 | 2 |
| RF-RAD-06 | O sistema **não deve** exibir uma vaga como "publicada nas últimas 24h" quando a data de publicação não for confiável; nesse caso exibe "primeira detecção em <data>". | P0 | 2 |
| RF-RAD-07 | O sistema deve manter histórico de todas as vagas encontradas, com `first_seen_at` e `last_seen_at`, mesmo após a vaga sair do ar. | P0 | 2 |
| RF-RAD-08 | O sistema deve marcar vaga como encerrada quando ela deixar de aparecer na fonte por N execuções consecutivas (padrão: 3) ou quando a fonte informar encerramento. | P1 | 2 |
| RF-RAD-09 | O usuário deve poder disparar coleta manual de um perfil de busca, respeitando rate limit. | P0 | 2 |
| RF-RAD-10 | O usuário deve poder filtrar e ordenar a lista do radar por score, recência, salário, empresa, fonte e modalidade. | P0 | 2 |
| RF-RAD-11 | O usuário deve poder descartar uma vaga com motivo, e vagas descartadas não devem reaparecer no radar. | P0 | 2 |
| RF-RAD-12 | O usuário deve poder salvar uma vaga ou enviá-la ao Kanban em um clique. | P0 | 2 |
| RF-RAD-13 | O sistema deve registrar cada execução de coleta com fonte, duração, itens encontrados, novos, duplicados e erros. | P0 | 2 |
| RF-RAD-14 | O sistema deve continuar funcionando com as demais fontes quando uma fonte falhar, isolando o erro. | P0 | 2 |
| RF-RAD-15 | O usuário deve poder cadastrar manualmente uma vaga encontrada por conta própria, com URL e dados mínimos. | P1 | 2 |
| RF-RAD-16 | O sistema deve normalizar títulos, localidades, modalidade e faixa salarial para permitir filtro e comparação entre fontes. | P0 | 2 |
| RF-RAD-17 | O sistema deve respeitar `robots.txt`, limites de requisição e termos de uso declarados de cada fonte, e bloquear execução de fonte marcada como não permitida. | P0 | 2 |

## 6. Monitoramento de recrutadores (REC)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-REC-01 | O sistema deve registrar recrutadores com nome, empresa, cargo/headline e URL de perfil público. | P0 | 2 |
| RF-REC-02 | O sistema deve registrar atividades públicas identificadas de um recrutador, cada uma com tipo, data, URL e trecho de evidência. | P0 | 2 |
| RF-REC-03 | O sistema deve classificar o recrutador em **Ativo recentemente**, **Possivelmente ativo** ou **Sem atividade identificada**, conforme regras do documento 07. | P0 | 2 |
| RF-REC-04 | O sistema **não deve** classificar um recrutador como ativo apenas por existir perfil público ou por o perfil ter sido atualizado; exige evidência de atividade de recrutamento datada. | P0 | 2 |
| RF-REC-05 | O sistema deve exibir, junto à classificação, a evidência que a sustenta e a data dessa evidência. | P0 | 2 |
| RF-REC-06 | O sistema deve vincular recrutador a vaga quando a fonte expuser esse vínculo. | P1 | 2 |
| RF-REC-07 | O sistema deve manter histórico de atividades por recrutador, ordenado no tempo. | P1 | 2 |
| RF-REC-08 | O usuário deve poder adicionar manualmente recrutadores e atividades observadas por ele. | P0 | 2 |
| RF-REC-09 | O sistema deve recalcular a classificação de atividade a cada coleta e quando a evidência mais recente expirar a janela de recência. | P0 | 2 |
| RF-REC-10 | O sistema deve permitir desativar completamente o monitoramento de recrutadores. | P1 | 2 |

## 7. Opportunity Score (SCR)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-SCR-01 | O sistema deve calcular um score de 0 a 100 para cada par (perfil de busca, vaga), com quatro componentes de 25 pontos: recência, atividade do recrutador, compatibilidade profissional e qualidade da oportunidade. | P0 | 2 |
| RF-SCR-02 | O sistema deve armazenar a decomposição do score com o valor de cada componente, os sinais usados e os dados ausentes. | P0 | 2 |
| RF-SCR-03 | O sistema deve exibir ao usuário a explicação do score em linguagem natural, derivada da decomposição e não gerada livremente. | P0 | 2 |
| RF-SCR-04 | O sistema deve tratar dado ausente conforme a regra de neutralidade do documento 08, nunca atribuindo pontuação por suposição. | P0 | 2 |
| RF-SCR-05 | O sistema deve exibir a **cobertura de dados** do score (percentual de sinais disponíveis) e sinalizar score de baixa confiança. | P0 | 2 |
| RF-SCR-06 | O sistema deve versionar o algoritmo de score e permitir recálculo em lote do histórico. | P1 | 2 |
| RF-SCR-07 | O usuário deve poder ajustar os pesos relativos dos quatro componentes por perfil de busca, mantendo o total em 100. | P2 | 4 |

## 8. Kanban de candidaturas (KAN)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-KAN-01 | O sistema deve exibir candidaturas em colunas: Radar, Interesse, Candidatado, Triagem, Entrevista, Teste técnico, Proposta, Aceito, Recusado, Desistência. | P0 | 2 |
| RF-KAN-02 | O usuário deve poder mover cartões entre colunas por arrastar e soltar, com persistência imediata e reversão visual em caso de erro. | P0 | 2 |
| RF-KAN-03 | Toda mudança de estágio deve gerar um evento no histórico, com estágio de origem, destino e data. | P0 | 2 |
| RF-KAN-04 | O cartão deve exibir empresa, cargo, score, dias no estágio atual, próxima ação e sua data. | P0 | 2 |
| RF-KAN-05 | O usuário deve poder registrar notas, contatos, anexos e definir próxima ação com data em cada candidatura. | P0 | 2 |
| RF-KAN-06 | O sistema deve destacar visualmente cartões sem movimento há mais de N dias (padrão: 7) e ações atrasadas. | P1 | 2 |
| RF-KAN-07 | O usuário deve poder arquivar candidaturas encerradas, retirando-as do quadro sem apagá-las. | P1 | 2 |
| RF-KAN-08 | O sistema deve permitir vincular currículo e carta de apresentação usados em cada candidatura. | P1 | 4 |
| RF-KAN-09 | O sistema deve permitir vincular um recrutador do CRM à candidatura. | P1 | 4 |
| RF-KAN-10 | O sistema deve criar a candidatura automaticamente quando o usuário envia uma vaga do radar ao Kanban, copiando os dados da vaga. | P0 | 2 |
| RF-KAN-11 | O sistema deve preservar os dados da candidatura mesmo se a vaga original for removida da fonte. | P0 | 2 |

## 9. LinkedIn Analyzer (LKD)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-LKD-01 | O sistema deve aceitar quatro formas de entrada do perfil: URL pública (quando acessível), texto colado manualmente, PDF exportado pelo próprio usuário e formulário manual. | P0 | 3 |
| RF-LKD-02 | O sistema deve informar claramente, antes da análise, quais seções foram detectadas e quais não, por forma de entrada. | P0 | 3 |
| RF-LKD-03 | O sistema deve avaliar as seções: foto, capa, headline, sobre, experiências, formação, certificações, competências, projetos, GitHub, portfólio, palavras-chave e clareza profissional. | P0 | 3 |
| RF-LKD-04 | O sistema deve produzir um score geral de 0 a 100 e um score por seção, com peso declarado. | P0 | 3 |
| RF-LKD-05 | Para cada problema identificado, o sistema deve apresentar: (1) o que está errado ou incompleto, (2) por que prejudica, (3) como corrigir, (4) exemplo de texto melhorado, (5) prioridade. | P0 | 3 |
| RF-LKD-06 | O sistema deve apresentar comparação lado a lado entre o perfil original e a versão otimizada, seção por seção. | P0 | 3 |
| RF-LKD-07 | O sistema deve armazenar todas as auditorias e permitir comparar duas auditorias para medir evolução. | P0 | 3 |
| RF-LKD-08 | A IA **não deve** inventar experiências, empresas, datas, certificações, números, resultados ou competências ausentes na entrada; quando uma melhoria exigir informação que o usuário não forneceu, o texto de exemplo deve conter marcador explícito de preenchimento. | P0 | 3 |
| RF-LKD-09 | O usuário deve poder marcar cada recomendação como aplicada, ignorada ou pendente, com data. | P0 | 3 |
| RF-LKD-10 | O sistema deve exibir o gráfico de evolução do score de LinkedIn ao longo das auditorias. | P1 | 3 |
| RF-LKD-11 | O sistema deve permitir copiar qualquer texto sugerido com um clique. | P0 | 3 |
| RF-LKD-12 | O sistema deve analisar o alinhamento entre o perfil e um perfil de busca escolhido (palavras-chave da área-alvo versus palavras-chave presentes). | P1 | 3 |
| RF-LKD-13 | O sistema deve informar explicitamente quando a análise de foto e capa não é possível (ex.: entrada por texto), sem atribuir nota. | P0 | 3 |
| RF-LKD-14 | O sistema deve permitir excluir uma auditoria e o PDF associado. | P1 | 3 |

## 10. AI Career Assistant (AIA)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-AIA-01 | O sistema deve analisar uma vaga e produzir: requisitos obrigatórios versus desejáveis, lacunas em relação ao perfil do usuário, pontos fortes a destacar e riscos/sinais de alerta. | P0 | 4 |
| RF-AIA-02 | O sistema deve gerar versão do currículo adaptada a uma vaga específica, a partir **somente** do conteúdo do currículo mestre e do perfil. | P0 | 4 |
| RF-AIA-03 | O sistema deve gerar carta de apresentação e mensagem curta de abordagem a recrutador, em pt-BR, com tom configurável. | P0 | 4 |
| RF-AIA-04 | O sistema deve simular entrevista: gerar perguntas prováveis a partir da vaga, receber respostas do usuário (texto) e devolver avaliação com pontos a melhorar. | P0 | 4 |
| RF-AIA-05 | O sistema deve estimar aderência do currículo a filtros automáticos (ATS): palavras-chave presentes/ausentes, estrutura e legibilidade, declarando que é estimativa heurística. | P1 | 4 |
| RF-AIA-06 | Toda saída de IA deve identificar o modelo, a versão do prompt e a data de geração. | P0 | 4 |
| RF-AIA-07 | O sistema deve manter histórico das conversas e artefatos gerados, vinculados à vaga ou candidatura. | P1 | 4 |
| RF-AIA-08 | O sistema deve bloquear chamadas de IA quando o teto de custo mensal do usuário for atingido, informando o motivo. | P0 | 4 |
| RF-AIA-09 | Toda resposta de IA deve declarar quais dados do usuário foram usados como contexto. | P1 | 4 |

## 11. Recruiter CRM (CRM)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-CRM-01 | O usuário deve poder cadastrar e editar recrutadores, com empresa, cargo, canais de contato e especialidades. | P0 | 4 |
| RF-CRM-02 | O usuário deve poder cadastrar empresas, com site, página de carreiras, setor, porte e localização. | P0 | 4 |
| RF-CRM-03 | O usuário deve poder registrar interações (data, canal, direção, assunto, notas, resultado). | P0 | 4 |
| RF-CRM-04 | O sistema deve permitir agendar follow-up com data e gerar notificação no vencimento. | P0 | 4 |
| RF-CRM-05 | O sistema deve exibir, por recrutador, o histórico unificado de atividades públicas detectadas e de interações registradas pelo usuário. | P0 | 4 |
| RF-CRM-06 | O sistema deve exibir, por empresa, vagas coletadas, candidaturas, recrutadores e notas. | P0 | 4 |
| RF-CRM-07 | O usuário deve poder marcar empresas como alvo ou como vetadas; empresas vetadas são excluídas do radar. | P1 | 4 |
| RF-CRM-08 | O sistema deve alertar quando uma empresa alvo publicar vaga nova. | P1 | 4 |
| RF-CRM-09 | O sistema deve evitar duplicidade de recrutadores e empresas por normalização de nome e domínio, sugerindo mesclagem. | P1 | 4 |

## 12. Career Intelligence (INT)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-INT-01 | O sistema deve calcular estatísticas salariais a partir **das vagas efetivamente coletadas**, informando tamanho da amostra e período. | P0 | 4 |
| RF-INT-02 | O sistema deve exibir as tecnologias e competências mais exigidas por cargo/área, com frequência e tendência entre períodos. | P0 | 4 |
| RF-INT-03 | O sistema deve comparar as competências do usuário com as mais exigidas no mercado, apontando lacunas priorizadas. | P0 | 4 |
| RF-INT-04 | O sistema deve exibir distribuição de modalidade e tipo de contratação por área. | P1 | 4 |
| RF-INT-05 | O sistema **não deve** exibir estatística com amostra inferior ao mínimo configurado (padrão: 8 vagas), exibindo "amostra insuficiente". | P0 | 4 |
| RF-INT-06 | Toda estatística deve declarar origem, período e número de vagas consideradas. | P0 | 4 |
| RF-INT-07 | O sistema deve permitir recorte por localidade e por senioridade. | P1 | 4 |
| RF-INT-08 | O sistema deve distinguir salário informado pela fonte de salário estimado, e nunca misturar os dois na mesma estatística sem indicar. | P0 | 4 |

## 13. Offer Comparator (OFR)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-OFR-01 | O usuário deve poder cadastrar propostas com salário base, periodicidade, bônus, equity, benefícios, VR/VA, plano de saúde, auxílios, férias, modalidade, deslocamento e tipo de contrato. | P0 | 4 |
| RF-OFR-02 | O sistema deve calcular a remuneração total anual e o valor líquido estimado, considerando CLT versus PJ, e declarar as premissas e alíquotas usadas. | P0 | 4 |
| RF-OFR-03 | O sistema deve comparar até 4 propostas e o emprego atual, lado a lado, em eixos financeiros e não financeiros. | P0 | 4 |
| RF-OFR-04 | O sistema deve calcular custo e tempo de deslocamento mensal e descontá-los na comparação. | P1 | 4 |
| RF-OFR-05 | O sistema deve permitir que o usuário atribua pesos aos critérios não financeiros (aprendizado, estabilidade, flexibilidade, gestão, carreira) e gerar nota ponderada. | P1 | 4 |
| RF-OFR-06 | O sistema deve indicar o diferencial percentual de cada proposta em relação ao emprego atual. | P0 | 4 |
| RF-OFR-07 | O sistema deve deixar explícito que os cálculos tributários são estimativas simplificadas, não aconselhamento fiscal. | P0 | 4 |
| RF-OFR-08 | O usuário deve poder registrar a decisão tomada e o motivo. | P1 | 4 |

## 14. Career Growth (GRW)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-GRW-01 | O usuário deve poder registrar competências com nível atual (1–5), anos de prática e evidências. | P0 | 4 |
| RF-GRW-02 | O usuário deve poder definir um cargo-alvo e o sistema deve montar o quadro de lacunas entre competências atuais e exigidas (com base nos dados de Career Intelligence). | P0 | 4 |
| RF-GRW-03 | O usuário deve poder criar plano de desenvolvimento com itens (curso, livro, certificação, projeto, prática), custo, horas estimadas, prazo e status. | P0 | 4 |
| RF-GRW-04 | O sistema deve calcular progresso do plano por horas concluídas e por itens concluídos. | P0 | 4 |
| RF-GRW-05 | O usuário deve poder definir metas de carreira mensuráveis com prazo e acompanhar a evolução. | P1 | 4 |
| RF-GRW-06 | O sistema deve registrar marcos profissionais (promoção, certificação obtida, projeto entregue) em uma linha do tempo. | P1 | 4 |
| RF-GRW-07 | O sistema deve sugerir itens de estudo para as lacunas priorizadas, sem inventar cursos ou URLs: sugestões sem fonte verificável são apresentadas como tema de estudo, não como curso específico. | P0 | 4 |

## 15. Biblioteca profissional (BIB)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-BIB-01 | O usuário deve poder enviar documentos (currículos, certificados, diplomas, cartas, PDFs de perfil, propostas) para armazenamento privado. | P0 | 5 |
| RF-BIB-02 | O sistema deve armazenar os arquivos em bucket privado, com acesso exclusivo por URL assinada de curta duração. | P0 | 5 |
| RF-BIB-03 | O usuário deve poder categorizar, etiquetar e buscar documentos por nome, tipo e etiqueta. | P0 | 5 |
| RF-BIB-04 | O sistema deve controlar versões de currículo, mantendo histórico e permitindo marcar a versão mestre. | P0 | 4 |
| RF-BIB-05 | O sistema deve registrar validade de certificações e notificar antes do vencimento. | P1 | 5 |
| RF-BIB-06 | O usuário deve poder cadastrar links profissionais com categoria e notas. | P1 | 5 |
| RF-BIB-07 | O sistema deve validar tipo MIME e tamanho dos uploads (padrão: ≤ 10 MB; PDF, DOCX, PNG, JPG). | P0 | 5 |
| RF-BIB-08 | O sistema deve permitir excluir documento com remoção efetiva do arquivo no Storage. | P0 | 5 |

## 16. Modo busca discreta (DIS)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-DIS-01 | O sistema deve oferecer um modo discreto que, quando ativo, suprime notificações sonoras e visuais intrusivas e usa títulos de página neutros. | P0 | 5 |
| RF-DIS-02 | Quando o modo discreto estiver ativo, o sistema não deve enviar e-mails com assunto que revele busca de emprego, usando assunto neutro configurável. | P0 | 5 |
| RF-DIS-03 | O sistema deve oferecer uma lista de empresas vetadas (incluindo a atual) cujas vagas não aparecem no radar. | P0 | 5 |
| RF-DIS-04 | O sistema deve oferecer bloqueio de tela da aplicação por PIN após inatividade configurável. | P1 | 5 |
| RF-DIS-05 | O sistema deve oferecer modo de privacidade visual que oculta valores salariais e nomes de empresa na tela até o usuário revelar. | P1 | 5 |
| RF-DIS-06 | O sistema não deve expor nenhuma página pública que revele dados do usuário; todas as rotas de aplicação exigem autenticação. | P0 | 1 |
| RF-DIS-07 | O sistema deve permitir desativar todo o histórico de logs de atividade do usuário. | P2 | 5 |
| RF-DIS-08 | O sistema deve informar ao usuário que nenhuma ação sua é executada em plataformas externas em nome dele. | P0 | 5 |

## 17. Notificações (NOT)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-NOT-01 | O sistema deve gerar notificações in-app para: vagas novas acima do score mínimo, follow-up vencendo, entrevista próxima, certificação vencendo, falha de fonte de vagas e teto de IA atingido. | P0 | 5 |
| RF-NOT-02 | O usuário deve poder configurar canal (in-app, e-mail), tipos e horário silencioso. | P0 | 5 |
| RF-NOT-03 | O sistema deve consolidar notificações de vagas em um resumo diário, em vez de uma por vaga. | P0 | 5 |
| RF-NOT-04 | O sistema deve marcar notificações como lidas e permitir limpar todas. | P1 | 5 |
| RF-NOT-05 | O sistema deve respeitar o modo discreto em todos os canais. | P0 | 5 |

## 18. Configurações (CFG)

| ID | Requisito | Prior. | Fase |
|---|---|---|---|
| RF-CFG-01 | O usuário deve poder alternar tema entre escuro (padrão) e claro, com persistência. | P0 | 1 |
| RF-CFG-02 | O usuário deve poder gerenciar fontes de vagas: ativar, desativar e ver status, limites e termos de uso de cada uma. | P0 | 2 |
| RF-CFG-03 | O usuário deve poder definir teto mensal de custo de IA e ver o consumo acumulado. | P0 | 4 |
| RF-CFG-04 | O usuário deve poder configurar parâmetros do score (pesos, score mínimo) e do radar (janela padrão, N execuções para encerrar vaga). | P1 | 4 |
| RF-CFG-05 | O usuário deve poder gerenciar chaves de API de terceiros que ele mesmo possua, armazenadas cifradas, **nunca senhas de plataformas**. | P0 | 5 |
| RF-CFG-06 | O usuário deve poder exportar e importar suas configurações. | P2 | 5 |
| RF-CFG-07 | A tela de configurações deve declarar, por integração, se ela está disponível, indisponível ou não permitida, e por quê. | P0 | 2 |
