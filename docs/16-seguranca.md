# 16 — Segurança e privacidade

> Duas afirmações governam este documento, e nenhuma configuração as flexibiliza:
> **(1) o sistema nunca armazena senha de plataforma externa** (RN-091);
> **(2) o sistema nunca age em nome do usuário em plataforma externa** (RN-090).

## 1. Modelo de ameaça (o que estamos de fato protegendo)

| Ativo | Ameaça | Mitigação principal |
|---|---|---|
| Dados de busca de emprego do usuário | vazamento para o empregador atual | modo discreto, empresas vetadas, nenhuma página pública, e-mail com assunto neutro |
| Documentos (currículo, diplomas, PDF de perfil) | acesso por outro usuário ou por URL vazada | bucket privado, política por pasta do usuário, URL assinada de 5 min |
| Remuneração atual e pretensão | exposição indevida, inclusive para a IA | marcação de sensível, exclusão de contexto de IA e de exportação não solicitada |
| Dados de terceiros (recrutadores) | uso excessivo de dado pessoal | mínimo necessário, só informação profissional pública, exclusão sob demanda |
| Chave `service_role` | privilégio total no banco | somente servidor, import restrito, regra de lint e verificação no CI |
| Chaves de API do usuário | vazamento | cifragem em repouso, nunca retornadas, só últimos 4 dígitos |
| Conta do usuário em plataformas externas | banimento por automação | o sistema simplesmente não automatiza (RN-090) |

## 2. Autenticação

| Item | Decisão |
|---|---|
| Provedor | Supabase Auth (e-mail/senha, magic link; Google OAuth opcional na Fase 5) |
| Confirmação de e-mail | obrigatória (RF-AUT-01) |
| Senha | política do Supabase + mínimo de 10 caracteres na validação da aplicação; verificação contra lista de senhas comuns |
| Sessão | JWT em cookie `httpOnly`, `secure`, `sameSite=lax`; refresh no middleware por `@supabase/ssr` |
| Expiração | access token 1 h, refresh 30 dias; "encerrar sessões em todos os dispositivos" (RF-AUT-05) |
| Rate limit de login | 10 tentativas por 15 min por e-mail e por IP (bucket `auth_attempt`) |
| Recuperação de senha | link de uso único, validade 1 h; resposta idêntica para e-mail existente ou não |
| PIN de tela | **não é** autenticação; é proteção contra olhar casual. Hash Argon2id; nunca substitui a sessão; declarado ao usuário (módulo 11) |

## 3. Autorização — Row Level Security é o mecanismo primário

```
Requisição → middleware (sessão) → Server Component/Action → cliente Supabase com JWT do usuário
                                                            → Postgres aplica RLS
```

Regras absolutas:

1. **Nenhuma consulta confia em filtro de aplicação** para isolar usuário. `where user_id = ...`
   no código é redundância, não proteção.
2. Três factories de cliente, e só três (documento 04 §3). `lib/db/service.ts` começa com
   `import 'server-only'` e é importável apenas por `app/api/cron/**` e `lib/radar/**`.
3. Toda tabela nova nasce com RLS. O teste de cobertura (`app_private.rls_coverage`) falha o CI
   caso contrário (RNF-SEC-01).
4. Tabelas de catálogo (`jobs`, `companies`, `job_sources`, `skills`, `market_insights`…) são
   legíveis por autenticado e **escritas somente** por `service_role`.
5. `collector_queue`, `rate_limits` e `job_raw_payloads` não têm política alguma: ninguém além do
   `service_role` as acessa.

Testes obrigatórios (RNF-TST-03): para cada tabela pessoal, usuário A tentando ler/alterar/apagar
linha de B obtém zero linhas ou erro. Para `application_events` e `linkedin_audit_sections`, o
próprio dono recebe erro ao tentar `UPDATE`/`DELETE`.

## 4. Proteção de rotas

| Camada | Proteção |
|---|---|
| `middleware.ts` | toda rota fora de `(auth)` exige sessão; redireciona com `?next=` |
| Server Actions | revalidam o usuário no servidor; nunca confiam em `userId` vindo do cliente |
| Route Handlers de cron | `Authorization: Bearer CRON_SECRET`, comparado com `crypto.timingSafeEqual` (RNF-SEC-06); respondem 404 (não 401) a segredo errado, para não confirmar a existência da rota |
| Rotas de API do usuário | derivam o `user_id` da sessão; parâmetro de usuário na requisição é ignorado por princípio |
| `/bloqueio` (PIN) | intercepta rotas protegidas quando o PIN está ativo e expirado |

## 5. Armazenamento de arquivos

| Item | Decisão |
|---|---|
| Buckets | `documents` e `avatars`, ambos **privados** |
| Caminho | `{user_id}/{kind}/{uuid}.{ext}` — a política compara `(storage.foldername(name))[1]` com `auth.uid()` |
| Upload | URL assinada de upload gerada no servidor após validar MIME, tamanho e cota (RF-BIB-07) |
| Leitura | URL assinada com validade de **5 minutos**, gerada só quando o usuário pede (RNF-SEC-05) |
| Validação | tipo verificado por extensão **e** por *magic bytes*; `Content-Type` do cliente não é confiável |
| Exclusão | remove objeto e linha; exclusão de conta varre o prefixo `{user_id}/` |
| Cota | `user_limits.storage_quota_mb` verificada antes de assinar o upload |

## 6. Segredos e credenciais

| Segredo | Onde vive | Nunca |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | variável de ambiente do servidor | em arquivo `use client`, em log, no repositório |
| `ANTHROPIC_API_KEY` | idem | idem |
| `CRON_SECRET` | idem | em query string |
| `CREDENTIALS_ENC_KEY` | idem | no banco |
| Chave de API do usuário | `integration_credentials.secret_ciphertext`, cifrada com AES-256-GCM usando `CREDENTIALS_ENC_KEY` | retornada em leitura; exibida além dos últimos 4 caracteres; usada fora do servidor |
| **Senha de plataforma externa** | **em lugar nenhum** | existir como campo em qualquer formulário do sistema |

A última linha é verificada por revisão documentada ao fim da Fase 5: busca por `senha`,
`password`, `credential` em todos os formulários (critério de conclusão do módulo 12).

Decifragem acontece em memória, no momento do uso, dentro do coletor; o valor nunca é logado nem
devolvido em resposta.

## 7. Validação de entrada e rate limiting

| Ponto | Validação |
|---|---|
| Server Action | Zod antes de qualquer uso; falha devolve `{ ok:false, error:{ code, message_ptbr, field } }` |
| Route Handler | Zod no corpo e nos parâmetros; 400 com corpo tipado |
| Resposta de fonte externa | Zod/parse explícito — dado externo nunca é apenas "tipado" (documento 04 §2.2) |
| Saída de IA | Zod + validador anti-invenção (documento 20 §5) |
| URL informada pelo usuário | esquema `https?` obrigatório; bloqueio de IP privado e `localhost` para evitar SSRF; sem redirecionamento para esquema diferente |
| Upload | MIME + magic bytes + tamanho + cota |

Buckets de rate limit (`app_private.check_rate_limit`):

| Bucket | Limite padrão | Janela |
|---|---|---|
| `manual_collect` | 5 (RN-028) | 1 h |
| `ai_call` | 30 | 1 h |
| `upload` | 20 | 1 h |
| `auth_attempt` | 10 | 15 min |
| `linkedin_url_fetch` | 5 | 1 h |

Excedido ⇒ `429` com `retryAfterSeconds` e mensagem em pt-BR.

## 8. Cabeçalhos e proteções de navegador

```js
// next.config.ts — headers aplicados a todas as rotas
'Content-Security-Policy':
  "default-src 'self'; img-src 'self' data: blob: https://*.supabase.co; " +
  "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
'X-Frame-Options': 'DENY',
'X-Content-Type-Options': 'nosniff',
'Referrer-Policy': 'strict-origin-when-cross-origin',
'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
```

Server Actions do Next já carregam proteção CSRF por origem; nenhum endpoint de mutação aceita
`GET`.

## 9. Logs e observabilidade

| Regra | Detalhe |
|---|---|
| Formato | JSON estruturado com `request_id` correlacionando UI → rota → coleta (RNF-OBS-03) |
| Proibido em log | conteúdo de documento, texto de perfil, token, chave, cabeçalho `Authorization`, corpo de resposta de IA |
| `console.log` de objeto de configuração | proibido (RNF-SEC-10) |
| Erro não tratado | stack trace no servidor; usuário recebe mensagem genérica + código de correlação |
| `audit_logs` | apenas hash de IP e user-agent; desligável pelo usuário (RNF-PRIV-05) |
| Amostra de payload em erro de parse | truncada em 2.000 caracteres, sem dado pessoal |

## 10. Privacidade e LGPD

| Direito | Implementação |
|---|---|
| Acesso e portabilidade | `GET /api/export` — JSON completo, sem campos de segredo (RF-AUT-07) |
| Correção | todo dado é editável na própria interface |
| Exclusão | `POST /api/account/delete` remove linhas e arquivos; agregados anônimos permanecem e isso é informado (RN-094) |
| Minimização | contexto de IA montado por lista de permissão de campos (RN-072); nada de `select *` |
| Dados de terceiros | só informação profissional pública; exclusão de recrutador sob demanda; exportação do que se guarda sobre ele |
| Transparência | política de privacidade e uso de IA exibidos na primeira execução (RNF-PRIV-07) |
| Sem rastreadores | nenhum pixel, nenhum analytics com dado pessoal (RNF-PRIV-04) |
| Retenção | declarada por tipo de dado, com expurgo agendado (documento 10 §19) |

## 11. Modo discreto como mecanismo de segurança

| Risco | Proteção |
|---|---|
| Colega vê a tela | máscara de salários e nomes de empresa; título de aba neutro; PIN por inatividade |
| E-mail aparece na notificação do celular | assunto e remetente neutros configuráveis |
| Vaga da própria empresa no radar | empresa atual sugerida para a lista de vetadas ao cadastrar o emprego (RN-093); vetada tem precedência absoluta (RN-013) |
| Rastro em plataforma externa | o sistema não acessa conta nem publica nada (RN-090) |
| Histórico de atividade | registro desligável (RF-DIS-07) |

## 12. Backup e recuperação

| Item | Decisão |
|---|---|
| Banco | PITR do Supabase quando o plano oferecer; caso contrário, `pg_dump` lógico diário agendado e armazenado **fora** da plataforma, cifrado |
| Storage | cópia semanal dos objetos do usuário junto do dump |
| Teste de restauração | executado e documentado ao fim da Fase 5 (RNF-DEP-05) — backup não testado não é backup |
| Migrations | versionadas no repositório; aplicação por comando deliberado, nunca no build (RNF-DEP-04) |
| Segredos | não entram no backup; são recriados a partir do gerenciador de segredos |

## 13. Dependências e cadeia de suprimento

- lista fechada de bibliotecas (documento 04 §2.9); adicionar exige justificativa escrita;
- `npm audit` no CI, build falha em vulnerabilidade crítica (RNF-SEC-09);
- versões fixadas no `package-lock.json`, commitado;
- proibidos: serviço de scraping terceirizado, qualquer pacote de "automação de LinkedIn",
  qualquer pacote que exija chave de terceiro não declarada no `.env.example`.

## 14. Checklist de segurança por fase

**Fase 1** — RLS em todas as tabelas; teste de cobertura e de travessia; proteção de rotas;
cabeçalhos; validação com Zod; nenhum segredo no repositório.

**Fase 2** — guard de legalidade com teste; segredo de cron com comparação constante; rate limit
de coleta manual; `service_role` restrito por lint; sem dado pessoal em `collector_runs`.

**Fase 3** — bucket privado com política por pasta; URL assinada de 5 min; validação de upload por
magic bytes; PDF marcado como sensível; contexto de IA por lista de permissão.

**Fase 4** — teto de IA bloqueando de fato; cifragem de credenciais do usuário; revisão de que
nenhum campo pede senha externa.

**Fase 5** — teste de exclusão de conta; teste de exportação sem segredos; restauração de backup
executada; revisão final de CSP e de logs; varredura de dependências.
