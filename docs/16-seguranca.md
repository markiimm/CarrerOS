# 16 — Segurança e privacidade

> Dois ativos a proteger: os **dados de carreira** do usuário (que incluem o fato de ele estar
> procurando emprego — informação que pode custar o emprego atual) e as **credenciais**.
> A regra que resume tudo: **o CareerOS nunca armazena senha de plataforma externa e nunca age em
> nome do usuário em plataforma externa** (RN-090, RN-091).

## 1. Autenticação

| Item | Decisão |
|---|---|
| Provedor | Supabase Auth (JWT) |
| Métodos | e-mail + senha e magic link. OAuth (Google/GitHub) opcional na Fase 5 |
| Senha | mínimo 12 caracteres, validada contra lista de senhas vazadas (zxcvbn no cliente + política do Supabase); hashing é do Supabase (bcrypt), nunca implementado aqui |
| Confirmação de e-mail | obrigatória |
| Sessão | cookie `httpOnly`, `secure`, `sameSite=lax`, rotação de refresh token |
| Expiração | access token 1 h; refresh 30 dias com rotação |
| MFA (TOTP) | Fase 5, opcional — recomendado por se tratar de dado sensível de carreira |
| Trava local por PIN | opcional: bloqueia a interface após 15 min de inatividade sem derrubar a sessão. **O PIN é hash local (`localStorage` com PBKDF2), nunca enviado ao servidor** — é proteção contra quem passa pela mesa, não contra invasor remoto |
| Recuperação de senha | token de uso único, 60 min, invalidando sessões ativas |

**Onde a sessão é validada:** `middleware.ts` (presença e validade do token) **e** no acesso ao
dado (RLS). Middleware sozinho não é autorização — é só redirecionamento.

## 2. Autorização

Três camadas, nesta ordem de confiança:

1. **RLS no Postgres** — a autorização real (doc 10 §14). Toda tabela com RLS ativa e `FORCE`.
2. **Server Actions / Route Handlers** — revalidam a identidade com `supabase.auth.getUser()`
   (nunca `getSession()` em decisão de autorização, por não verificar assinatura no servidor).
3. **Interface** — esconde o que o usuário não pode fazer. É usabilidade, nunca segurança.

**Teste obrigatório (RNF-TST-03):** para cada tabela com `user_id`, um teste autentica como
usuário B e tenta ler/alterar linha de A, esperando zero linhas ou erro. Mais o teste que falha
se alguma tabela de `public` ficar sem RLS.

## 3. Proteção de rotas

```
/                      → público (landing mínima)
/login /cadastro ...   → público; redireciona para /painel se já autenticado
/(app)/*               → exige sessão; sem sessão → /login?next=<rota>
/api/cron/*            → exige Authorization: Bearer ${CRON_SECRET} (comparação
                         em tempo constante); NÃO aceita sessão de usuário
/api/webhooks/*        → verificação de assinatura do remetente
/api/*                 → exige sessão + rate limit por usuário
```

`CRON_SECRET` com ≥ 32 bytes aleatórios. Comparação com `crypto.timingSafeEqual`. Toda
requisição a `/api/cron/*` é registrada em `audit_logs`, inclusive a recusada.

## 4. Validação de entrada

| Camada | Regra |
|---|---|
| Borda | **todo** payload de Server Action e Route Handler passa por schema Zod antes de qualquer uso. Sem exceção, inclusive em rota interna |
| Tipos | `strict: true` no TypeScript; proibido `any` em fronteira de dados (lint) |
| Banco | `CHECK` nas regras invariantes (janela de recência, soma de pesos, coerência de datas, prefixo de `storage_path`) — a aplicação pode ter bug; o banco segura |
| Saída de IA | Zod + validador anti-invenção (doc 20 §5) antes de persistir |
| HTML de terceiros | `description_html` de vaga é **sanitizado na exibição** (DOMPurify/`rehype-sanitize`), nunca renderizado cru. O payload bruto fica em `job_raw_payloads`, que não vai para a tela |
| Upload | tipo verificado por *magic bytes* (não pela extensão nem pelo `Content-Type` declarado), tamanho ≤ 10 MB, nome gerado pelo servidor (`uuid`), extensão derivada do tipo real |
| URL fornecida pelo usuário | esquema `http(s)` apenas; bloqueio de IP privado/loopback/link-local antes de qualquer `fetch` server-side (**anti-SSRF** — crítico nos adaptadores `rss-generic` e `jsonld-careers`, que buscam URL que o usuário digita) |

## 5. Proteção de credenciais e segredos

| Segredo | Onde vive | Regra |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | variável de ambiente, **somente servidor** | se aparecer em código cliente ou em `NEXT_PUBLIC_*`, é incidente. Lint/CI falha ao detectar |
| `ANTHROPIC_API_KEY` | ambiente, somente servidor | nenhuma chamada de IA pelo cliente |
| `CRON_SECRET` | ambiente | só comparada em `/api/cron/*` |
| `CREDENTIAL_ENCRYPTION_KEY` | ambiente (32 bytes) | cifra `user_credentials.secret_ciphertext` (AES-256-GCM) |
| Chave de fonte do usuário | `user_credentials`, cifrada | lida **só** por `get_source_credential()` (security definer); UI vê apenas `secret_last4` pela view |
| Senha de plataforma externa | **lugar nenhum** | o produto não tem campo para isso. Jamais terá (RN-091) |

Apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são expostos ao cliente — e
a `anon key` é inútil sozinha, porque toda tabela tem RLS e `anon` foi revogado de `public`.

Rotação: `CRON_SECRET` e chaves de IA a cada 90 dias ou imediatamente após suspeita.

## 6. Rate limiting

Sem Redis (ADR-010): tabela `rate_limit_hits` + função `check_rate_limit()`.

| Ação | Limite | Resposta ao exceder |
|---|---|---|
| Coleta manual | 5/hora/usuário (`user_limits`) | 429 com segundos de espera (RN-028) |
| Chamada de IA | teto mensal de custo + 20/hora | erro explicativo com consumo (RN-070) |
| Login | 5 tentativas/15 min/IP | política do Supabase + atraso progressivo |
| Upload | 30/hora | 429 |
| Requisição a fonte externa | `job_sources.rate_limit_per_min`, global por fonte | espera serializada (RN-027) |
| API geral | 100/min/usuário | 429 |

## 7. Cabeçalhos HTTP (`next.config.ts`)

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'unsafe-inline' (apenas nonce em produção);
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;         /* logos de empresa */
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSRF: Server Actions do Next já validam origem; rotas que mudam estado exigem `POST` com
`Origin`/`Sec-Fetch-Site` conferidos.

## 8. Privacidade de documentos

| Regra | Implementação |
|---|---|
| Nenhum bucket público | os 4 buckets com `public = false` (migration 0011) |
| Isolamento por pasta | política de Storage exige `(storage.foldername(name))[1] = auth.uid()` |
| Reforço no banco | `CHECK (storage_path LIKE user_id || '/%')` em `documents` |
| Entrega | URL assinada de **60 s**, gerada no servidor, sob demanda. Nunca URL permanente |
| Nome de arquivo | gerado pelo servidor; o nome original do usuário vai para `title`, não para o caminho |
| PDF do LinkedIn | só o texto extraído vai à IA; o arquivo nunca é enviado (RN-067) |
| Exclusão | excluir auditoria/documento apaga o objeto no Storage **explicitamente** (Storage não tem FK) |

## 9. Logs e observabilidade

| Regra | Detalhe |
|---|---|
| Nunca logar | senha, token, `secret_ciphertext`, conteúdo integral de documento, corpo de e-mail, payload de IA com dado pessoal |
| IP e user-agent | só como hash com sal da aplicação (`audit_logs.ip_hash`) |
| O que se registra | login/logout, falha de autenticação, mudança de configuração, exclusão, acesso a documento, execução de cron (inclusive recusada), chamada de IA (metadado, não conteúdo) |
| Retenção | `audit_logs` 180 dias; `job_raw_payloads` 90 dias; `collector_runs` 180 dias — rotina semanal `retention` |
| Erros | mensagem genérica ao usuário, detalhe no log do servidor. Stack trace nunca chega ao cliente |
| Terceiros | **nenhum** script de analytics de terceiros (RNF-PRIV-04). Métricas de produto, se houver, são próprias e agregadas |

## 10. Backup e recuperação

| Item | Decisão |
|---|---|
| Banco | backup diário automático do Supabase (plano free: 7 dias de retenção) |
| Exportação pelo usuário | botão em Configurações gera JSON completo dos dados pessoais + CSV das tabelas principais (RF-CFG-06) — independe do provedor e atende à portabilidade |
| Storage | não há backup automático no plano free: a exportação inclui a lista de documentos com URLs assinadas, e a documentação orienta o usuário a guardar cópia local dos certificados |
| Migrations | versionadas em git; o schema é reconstruível do zero com `supabase db push` |
| Teste de restauração | ao fim da Fase 5, restaurar um backup em projeto limpo e validar login + leitura (critério de aceite) |
| RPO/RTO alvo | RPO 24 h, RTO 4 h — adequado a uso pessoal; declarado por honestidade, não por SLA |

## 11. Proteção de informação pessoal (LGPD, uso pessoal)

| Princípio | Como se cumpre |
|---|---|
| Minimização | só o necessário por feature; contexto de IA por lista de permissão (RN-072) |
| Finalidade | dado de recrutador só para o CRM do usuário; nunca revendido, nunca compartilhado |
| Dado de terceiro | recrutadores: apenas dado profissional público + evidências com URL. Proibido inferir ou armazenar dado sensível (RN-045) |
| Direito de exclusão | exclusão de recrutador em cascata; exclusão de conta apaga banco e Storage (RN-094) |
| Portabilidade | exportação JSON/CSV |
| Transparência | tela que lista quais dados existem, por que, e quanto tempo ficam |
| Encarregado | no uso pessoal, o próprio usuário é controlador. Ao virar SaaS: política de privacidade, base legal, DPA com Supabase/Vercel/Anthropic e canal do titular — **pré-requisito da Fase 6** |

## 12. Modelagem de ameaças (as seis que importam aqui)

| Ameaça | Risco | Mitigação |
|---|---|---|
| Empregador atual descobre a busca | **o mais grave do produto** | modo discreto (RN-092), e-mail neutro, empresa atual na blocklist, sem publicação em nenhum canal, sem ação em plataforma externa |
| Vazamento entre usuários (multi-tenant) | alto | RLS + `FORCE` + teste automatizado por tabela; `anon` revogado |
| Vazamento da `service_role key` | alto | só no servidor; verificação em CI; rotação; nunca em `NEXT_PUBLIC_*` |
| Prompt injection via descrição de vaga ou perfil colado | médio (a vaga é texto de terceiro que chega à IA) | o conteúdo externo entra sempre delimitado e rotulado como **dado, não instrução**; a saída é estruturada e validada; a IA não tem ferramenta, não executa ação e não decide nada (RN-075). Doc 20 §6 |
| SSRF pelos adaptadores de URL do usuário | médio | lista de bloqueio de IP privado/loopback, resolução de DNS antes do `fetch`, só `http(s)`, timeout |
| XSS via `description_html` | médio | sanitização na exibição + CSP |

## 13. Critérios de conclusão

- [ ] Teste de isolamento por tabela passando (RLS), e teste que falha se tabela ficar sem RLS.
- [ ] Nenhum segredo em `NEXT_PUBLIC_*` (verificado em CI).
- [ ] `/api/cron/*` recusa requisição sem `CRON_SECRET` e registra a recusa.
- [ ] Todos os buckets privados; entrega só por URL assinada de 60 s.
- [ ] Zod em 100% das entradas de Server Action e Route Handler.
- [ ] `description_html` sanitizado (teste com payload de XSS).
- [ ] Bloqueio de SSRF testado com `http://169.254.169.254` e `http://127.0.0.1`.
- [ ] Cabeçalhos de segurança presentes em produção (teste de integração).
- [ ] Exclusão de conta remove banco **e** Storage (teste de integração).
- [ ] Exportação de dados gera JSON/CSV completos.
- [ ] Restauração de backup validada em projeto limpo.
- [ ] Nenhum script de terceiro na página (verificado no build).
