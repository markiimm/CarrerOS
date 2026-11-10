-- =============================================================================
-- CareerOS — 0012 — Seed: fontes de vagas e catálogo inicial de competências
--
-- ATENÇÃO À IA IMPLEMENTADORA:
-- O campo legal_status abaixo reflete a avaliação feita na data da especificação e
-- NÃO substitui verificação. Antes de ativar qualquer fonte:
--   1. abrir terms_url e robots_url e ler;
--   2. confirmar que o endpoint é público e destinado a consumo programático;
--   3. registrar a data da verificação em legal_notes.
-- Fonte em 'review_needed' NÃO coleta (RN-020). Isso é proposital: o padrão é
-- seguro, e habilitar é uma decisão consciente com evidência.
-- NUNCA mude 'disallowed' para 'allowed' sem autorização por escrito da plataforma.
-- =============================================================================

insert into public.job_sources
  (slug, display_name, adapter_key, kind, legal_status, legal_notes,
   terms_url, docs_url, rate_limit_per_min, requires_user_key, config, capabilities)
values

-- ---------------------------------------------------------------------------
-- A. Entrada manual — sempre disponível, não depende de ninguém.
--    É o que garante que o produto é útil mesmo sem nenhuma integração (RN-020).
-- ---------------------------------------------------------------------------
('manual', 'Cadastro manual', 'manual', 'manual', 'allowed',
 'Vaga cadastrada pelo próprio usuário. Nenhuma coleta automatizada envolvida.',
 null, null, 600, false, '{}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":true,"providesRecruiter":true,
   "paginated":false,"maxItemsPerRequest":1}'::jsonb),

('email_alert', 'Importação de alerta de e-mail', 'email_alert', 'email_alert', 'review_needed',
 'Fase 5. O usuário encaminha os próprios alertas de vaga para um endereço do sistema. '
 'São dados do próprio usuário, mas exige avaliação de privacidade e de parsing antes de ativar.',
 null, null, 60, false, '{}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":false,"providesSalary":false,"providesRecruiter":false,
   "paginated":false,"maxItemsPerRequest":50}'::jsonb),

-- ---------------------------------------------------------------------------
-- B. ATS com quadro de vagas público — o melhor caminho.
--    São endpoints documentados, destinados a exibir as vagas da empresa em
--    sites próprios. Dado de melhor qualidade: data exata e, às vezes, recrutador.
--    Exigem config com o identificador do quadro de cada empresa.
-- ---------------------------------------------------------------------------
('greenhouse', 'Greenhouse (quadro público)', 'greenhouse', 'ats_public_api', 'review_needed',
 'Endpoint público de job board documentado. Requer board_token por empresa. '
 'VERIFICAR termos antes de ativar e registrar a data aqui.',
 'https://www.greenhouse.io/legal', 'https://developers.greenhouse.io/job-board.html',
 30, false, '{"board_tokens": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,
   "paginated":false,"maxItemsPerRequest":500}'::jsonb),

('lever', 'Lever (quadro público)', 'lever', 'ats_public_api', 'review_needed',
 'Endpoint público de postings documentado. Requer company handle por empresa. VERIFICAR termos.',
 'https://www.lever.co/legal/terms', 'https://github.com/lever/postings-api',
 30, false, '{"companies": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,
   "paginated":true,"maxItemsPerRequest":100}'::jsonb),

('ashby', 'Ashby (quadro público)', 'ashby', 'ats_public_api', 'review_needed',
 'Endpoint público de job board. Requer job board name por empresa. VERIFICAR termos.',
 null, null, 30, false, '{"boards": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":true,"providesRecruiter":false,
   "paginated":false,"maxItemsPerRequest":500}'::jsonb),

('recruitee', 'Recruitee (quadro público)', 'recruitee', 'ats_public_api', 'review_needed',
 'Endpoint público de careers site. Requer company subdomain. VERIFICAR termos.',
 null, null, 30, false, '{"companies": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,
   "paginated":true,"maxItemsPerRequest":100}'::jsonb),

-- ---------------------------------------------------------------------------
-- C. Genéricos — funcionam com QUALQUER site que publique feed ou dado estruturado.
--    É aqui que mora a escala real sem depender de parceria.
-- ---------------------------------------------------------------------------
('rss_generic', 'Feed RSS/Atom de carreiras', 'rss-generic', 'rss', 'allowed',
 'Feeds existem para serem consumidos por leitores automatizados. O usuário cadastra a URL; '
 'o adaptador respeita robots.txt e o intervalo mínimo entre coletas.',
 null, null, 20, false, '{"feeds": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,
   "paginated":false,"maxItemsPerRequest":100}'::jsonb),

('jsonld_careers', 'Página de carreiras com JSON-LD', 'jsonld-careers', 'jsonld_page', 'review_needed',
 'Lê JobPosting em schema.org/JSON-LD — marcação publicada justamente para consumo por '
 'máquinas (buscadores). Exige verificar robots.txt de CADA domínio cadastrado, por domínio, '
 'antes da primeira coleta. O adaptador recusa domínio cujo robots.txt proíba.',
 null, 'https://schema.org/JobPosting', 10, false, '{"urls": []}'::jsonb,
 '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":true,"providesRecruiter":false,
   "paginated":false,"maxItemsPerRequest":50}'::jsonb),

-- ---------------------------------------------------------------------------
-- D. Agregadores com API oficial — exigem chave DO PRÓPRIO USUÁRIO (RN-091).
--    Nunca uma chave compartilhada embutida no produto.
-- ---------------------------------------------------------------------------
('adzuna', 'Adzuna (API oficial)', 'adzuna', 'official_api', 'requires_user_key',
 'API oficial com app_id/app_key gratuitos emitidos no nome do usuário. '
 'Cobertura BR limitada, mas a data de publicação é confiável.',
 'https://www.adzuna.co.uk/terms-and-conditions.html', 'https://developer.adzuna.com/',
 20, true, '{"country": "br"}'::jsonb,
 '{"supportsKeywordSearch":true,"supportsLocationFilter":true,"supportsDateFilter":true,
   "providesPublishedAt":true,"providesSalary":true,"providesRecruiter":false,
   "paginated":true,"maxItemsPerRequest":50}'::jsonb),

('jooble', 'Jooble (API oficial)', 'jooble', 'official_api', 'requires_user_key',
 'API oficial com chave emitida sob solicitação, no nome do usuário.',
 null, 'https://jooble.org/api/about', 20, true, '{"country": "br"}'::jsonb,
 '{"supportsKeywordSearch":true,"supportsLocationFilter":true,"supportsDateFilter":false,
   "providesPublishedAt":true,"providesSalary":true,"providesRecruiter":false,
   "paginated":true,"maxItemsPerRequest":50}'::jsonb),

-- ---------------------------------------------------------------------------
-- E. Fontes PROIBIDAS — registradas de propósito.
--    Ficam no banco para que o sistema saiba dizer "não" com motivo, em vez de
--    alguém tentar implementar depois achando que ninguém tinha pensado nisso.
--    O guard do coletor recusa executar estas fontes mesmo com flag ligada.
-- ---------------------------------------------------------------------------
('linkedin', 'LinkedIn', 'unavailable', 'official_api', 'disallowed',
 'Os termos de uso proíbem coleta automatizada, e a API de parceiros não oferece busca de vagas '
 'para este caso de uso. Caminho suportado no CareerOS: cadastro manual da vaga e análise de '
 'perfil pelos quatro canais de entrada do LinkedIn Analyzer (documento 09). '
 'NÃO implementar scraping, login automatizado ou navegador headless autenticado.',
 'https://www.linkedin.com/legal/user-agreement', null, 1, false, '{}'::jsonb, '{}'::jsonb),

('indeed', 'Indeed', 'unavailable', 'official_api', 'disallowed',
 'Coleta automatizada não autorizada; o acesso programático depende de parceria comercial '
 'específica. Usar cadastro manual enquanto não houver autorização por escrito.',
 'https://www.indeed.com/legal', null, 1, false, '{}'::jsonb, '{}'::jsonb),

('gupy', 'Gupy', 'unavailable', 'official_api', 'review_needed',
 'Plataforma brasileira muito relevante para o perfil do usuário, porém sem API pública '
 'documentada para candidatos. Status: pendente de avaliação. Caminho provável e permitido: '
 'o quadro público de cada empresa, cadastrado individualmente como jsonld_careers ou rss, '
 'após verificar o robots.txt do domínio.',
 null, null, 1, false, '{}'::jsonb, '{}'::jsonb),

('catho', 'Catho', 'unavailable', 'official_api', 'review_needed',
 'Sem API pública para candidatos. Pendente de avaliação. Usar cadastro manual.',
 null, null, 1, false, '{}'::jsonb, '{}'::jsonb),

('vagas_com', 'Vagas.com', 'unavailable', 'official_api', 'review_needed',
 'Sem API pública para candidatos. Pendente de avaliação. Usar cadastro manual.',
 null, null, 1, false, '{}'::jsonb, '{}'::jsonb)

on conflict (slug) do update set
  display_name = excluded.display_name,
  adapter_key  = excluded.adapter_key,
  kind         = excluded.kind,
  legal_notes  = excluded.legal_notes,
  terms_url    = excluded.terms_url,
  docs_url     = excluded.docs_url,
  capabilities = excluded.capabilities,
  updated_at   = now();
  -- legal_status NÃO é sobrescrito no update: uma avaliação humana já feita
  -- (allowed/disallowed) não é revertida por reexecução do seed.

-- =============================================================================
-- Catálogo inicial de competências.
-- aliases é o que alimenta a extração determinística de skills das vagas
-- (documento 06 §7) — por isso inclui variações em pt e en, com e sem acento.
-- =============================================================================

insert into public.skills (slug, name, kind, category, aliases) values
-- Suporte técnico e service desk
('suporte-tecnico', 'Suporte Técnico', 'technical', 'Suporte',
  array['suporte tecnico', 'suporte técnico', 'help desk', 'helpdesk', 'service desk', 'technical support', 'suporte n1', 'suporte n2', 'suporte n3']),
('itil', 'ITIL', 'certification', 'Suporte', array['itil', 'itil v3', 'itil 4', 'itil foundation']),
('glpi', 'GLPI', 'tool', 'Suporte', array['glpi']),
('zendesk', 'Zendesk', 'tool', 'Suporte', array['zendesk']),
('jira', 'Jira', 'tool', 'Gestão', array['jira', 'jira service desk', 'jira software']),

-- Sistemas operacionais e infraestrutura
('windows-server', 'Windows Server', 'technical', 'Infraestrutura',
  array['windows server', 'win server', 'windows 2019', 'windows 2022']),
('active-directory', 'Active Directory', 'technical', 'Infraestrutura',
  array['active directory', 'ad', 'ad ds', 'gpo', 'group policy']),
('linux', 'Linux', 'technical', 'Infraestrutura',
  array['linux', 'ubuntu', 'debian', 'centos', 'red hat', 'rhel', 'shell script', 'bash']),
('vmware', 'VMware', 'technical', 'Infraestrutura', array['vmware', 'vsphere', 'esxi', 'vcenter']),
('backup', 'Backup e Recuperação', 'technical', 'Infraestrutura',
  array['backup', 'veeam', 'bacula', 'disaster recovery', 'restore']),
('office-365', 'Microsoft 365', 'tool', 'Infraestrutura',
  array['office 365', 'o365', 'microsoft 365', 'm365', 'exchange online', 'intune']),

-- Redes
('redes', 'Redes de Computadores', 'technical', 'Redes',
  array['redes', 'networking', 'tcp/ip', 'tcp ip', 'lan', 'wan', 'vlan', 'dns', 'dhcp']),
('firewall', 'Firewall', 'technical', 'Redes',
  array['firewall', 'fortigate', 'fortinet', 'pfsense', 'palo alto', 'sophos', 'mikrotik']),
('cisco', 'Cisco', 'technical', 'Redes', array['cisco', 'ccna', 'ccnp', 'ios cisco']),
('vpn', 'VPN', 'technical', 'Redes', array['vpn', 'ipsec', 'openvpn', 'wireguard']),

-- Cloud e DevOps
('aws', 'AWS', 'technical', 'Cloud',
  array['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds']),
('azure', 'Azure', 'technical', 'Cloud', array['azure', 'microsoft azure', 'azure ad', 'entra id']),
('gcp', 'Google Cloud', 'technical', 'Cloud', array['gcp', 'google cloud', 'google cloud platform']),
('docker', 'Docker', 'tool', 'DevOps', array['docker', 'containers', 'containerização', 'containerizacao']),
('kubernetes', 'Kubernetes', 'tool', 'DevOps', array['kubernetes', 'k8s', 'eks', 'aks', 'gke']),
('ci-cd', 'CI/CD', 'technical', 'DevOps',
  array['ci/cd', 'ci cd', 'github actions', 'gitlab ci', 'jenkins', 'pipeline', 'azure devops']),
('terraform', 'Terraform', 'tool', 'DevOps', array['terraform', 'infraestrutura como codigo', 'iac']),

-- Front-end
('html-css', 'HTML e CSS', 'technical', 'Front-End',
  array['html', 'html5', 'css', 'css3', 'sass', 'scss', 'tailwind', 'tailwindcss']),
('javascript', 'JavaScript', 'technical', 'Front-End',
  array['javascript', 'js', 'es6', 'ecmascript', 'vanilla js']),
('typescript', 'TypeScript', 'technical', 'Front-End', array['typescript', 'ts']),
('react', 'React', 'technical', 'Front-End', array['react', 'reactjs', 'react.js', 'react js']),
('nextjs', 'Next.js', 'technical', 'Front-End', array['next.js', 'nextjs', 'next js']),
('vue', 'Vue.js', 'technical', 'Front-End', array['vue', 'vuejs', 'vue.js', 'nuxt']),
('angular', 'Angular', 'technical', 'Front-End', array['angular', 'angularjs', 'angular 2']),

-- Back-end
('nodejs', 'Node.js', 'technical', 'Back-End', array['node', 'nodejs', 'node.js', 'express', 'nestjs']),
('python', 'Python', 'technical', 'Back-End', array['python', 'py', 'django', 'flask', 'fastapi']),
('java', 'Java', 'technical', 'Back-End', array['java', 'spring', 'spring boot', 'jpa', 'hibernate']),
('csharp', 'C#', 'technical', 'Back-End',
  array['c#', 'csharp', 'c sharp', '.net', 'dotnet', 'asp.net', 'entity framework']),
('php', 'PHP', 'technical', 'Back-End', array['php', 'laravel', 'symfony', 'codeigniter']),
('api-rest', 'APIs REST', 'technical', 'Back-End',
  array['api rest', 'rest', 'restful', 'api', 'graphql', 'webhooks']),

-- Dados e banco de dados
('sql', 'SQL', 'technical', 'Dados',
  array['sql', 'consultas sql', 't-sql', 'pl/sql', 'queries']),
('postgresql', 'PostgreSQL', 'technical', 'Dados', array['postgresql', 'postgres', 'psql']),
('mysql', 'MySQL', 'technical', 'Dados', array['mysql', 'mariadb']),
('sqlserver', 'SQL Server', 'technical', 'Dados',
  array['sql server', 'microsoft sql server', 'mssql', 'ssms']),
('oracle', 'Oracle', 'technical', 'Dados', array['oracle', 'oracle db', 'oracle database']),
('mongodb', 'MongoDB', 'technical', 'Dados', array['mongodb', 'mongo', 'nosql']),
('power-bi', 'Power BI', 'tool', 'Dados',
  array['power bi', 'powerbi', 'power-bi', 'dax', 'power query']),
('excel', 'Excel Avançado', 'tool', 'Dados',
  array['excel', 'excel avancado', 'excel avançado', 'planilhas', 'tabela dinamica', 'procv', 'vlookup']),
('etl', 'ETL', 'technical', 'Dados',
  array['etl', 'elt', 'pipeline de dados', 'data pipeline', 'airflow', 'ssis']),
('estatistica', 'Estatística', 'technical', 'Dados',
  array['estatistica', 'estatística', 'analise estatistica', 'statistics']),
('pandas', 'Pandas', 'tool', 'Dados', array['pandas', 'numpy', 'jupyter']),
('tableau', 'Tableau', 'tool', 'Dados', array['tableau']),
('looker', 'Looker Studio', 'tool', 'Dados',
  array['looker', 'looker studio', 'data studio', 'google data studio']),

-- Segurança
('seguranca-informacao', 'Segurança da Informação', 'technical', 'Segurança',
  array['seguranca da informacao', 'segurança da informação', 'security', 'infosec', 'cibersegurança', 'ciberseguranca']),
('lgpd', 'LGPD', 'technical', 'Segurança', array['lgpd', 'gdpr', 'privacidade de dados', 'protecao de dados']),

-- Ferramentas transversais
('git', 'Git', 'tool', 'Desenvolvimento',
  array['git', 'github', 'gitlab', 'bitbucket', 'controle de versao', 'versionamento']),
('scrum', 'Scrum', 'soft', 'Gestão',
  array['scrum', 'agile', 'ágil', 'agil', 'kanban', 'metodologias ageis', 'metodologias ágeis']),

-- Idiomas
('ingles', 'Inglês', 'language', 'Idiomas',
  array['ingles', 'inglês', 'english', 'ingles avancado', 'ingles intermediario', 'fluent english']),
('espanhol', 'Espanhol', 'language', 'Idiomas', array['espanhol', 'spanish', 'español']),

-- Comportamentais
('comunicacao', 'Comunicação', 'soft', 'Comportamental',
  array['comunicacao', 'comunicação', 'comunicacao clara', 'communication']),
('trabalho-em-equipe', 'Trabalho em equipe', 'soft', 'Comportamental',
  array['trabalho em equipe', 'teamwork', 'colaboracao', 'colaboração']),
('resolucao-problemas', 'Resolução de problemas', 'soft', 'Comportamental',
  array['resolucao de problemas', 'resolução de problemas', 'problem solving', 'analise de problemas']),
('atendimento-cliente', 'Atendimento ao cliente', 'soft', 'Comportamental',
  array['atendimento ao cliente', 'customer service', 'customer success', 'relacionamento com cliente'])

on conflict (slug) do update set
  name     = excluded.name,
  kind     = excluded.kind,
  category = excluded.category,
  aliases  = excluded.aliases;
