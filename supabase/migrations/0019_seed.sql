-- 0019 — Seed: fontes de vagas e dicionário de competências
-- CareerOS · documentos 06 §2, 14 e 10 §20
-- Idempotente (ON CONFLICT). Nenhum dado de usuário aqui.

-- ---------------------------------------------------------------------------
-- Fontes de vagas
-- legal_status é a declaração formal que o guard do coletor respeita (RN-020):
--   allowed           → API/feed público documentado, uso permitido
--   requires_user_key → só roda com credencial do próprio usuário
--   review_needed     → termos ainda não avaliados: NÃO executa
--   disallowed        → proibida: NÃO executa nem com flag ligada
-- As linhas 'review_needed' e 'disallowed' existem de propósito: a tela de Configurações
-- mostra a fonte desabilitada com o motivo escrito (RF-CFG-07), em vez de esconder.
-- ---------------------------------------------------------------------------
insert into public.job_sources
  (slug, display_name, adapter_key, kind, legal_status, terms_url, legal_notes,
   rate_limit_per_min, requires_user_key, status, capabilities, config)
values
  ('manual', 'Cadastro manual', 'manual', 'manual', 'allowed',
   'https://careeros.local/termos-internos',
   'Vaga informada pelo próprio usuário. Sempre disponível: garante que o produto funcione sem nenhuma integração externa.',
   600, false, 'active',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":true,"providesRecruiter":true,"paginated":false,"maxItemsPerRequest":1}'::jsonb,
   '{}'::jsonb),

  ('greenhouse', 'Greenhouse (quadro público de empresa)', 'greenhouse', 'ats_public_api', 'allowed',
   'https://developers.greenhouse.io/job-board.html',
   'Job Board API pública, por empresa (board token). Sem autenticação. Requer cadastrar o token de cada empresa monitorada em config.boards.',
   30, false, 'active',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,"paginated":false,"maxItemsPerRequest":500}'::jsonb,
   '{"boards":[]}'::jsonb),

  ('lever', 'Lever (quadro público de empresa)', 'lever', 'ats_public_api', 'allowed',
   'https://help.lever.co/hc/en-us/articles/360042237453',
   'Postings API pública, por empresa (site slug). Sem autenticação. Requer cadastrar os slugs em config.sites.',
   30, false, 'active',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":true,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,"paginated":true,"maxItemsPerRequest":100}'::jsonb,
   '{"sites":[]}'::jsonb),

  ('ashby', 'Ashby (quadro público de empresa)', 'ashby', 'ats_public_api', 'review_needed',
   null,
   'API pública de job board existe, mas os termos de uso devem ser verificados por empresa antes de habilitar. Até a verificação, a fonte não é executada.',
   20, false, 'paused',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,"paginated":true,"maxItemsPerRequest":100}'::jsonb,
   '{"boards":[]}'::jsonb),

  ('rss-generic', 'Feed RSS/Atom de vagas', 'rss-generic', 'rss', 'allowed',
   'https://www.rssboard.org/rss-specification',
   'Feed público declarado pelo próprio site. O usuário cadastra a URL do feed; o adaptador respeita robots.txt e o intervalo mínimo entre requisições.',
   20, false, 'active',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,"paginated":false,"maxItemsPerRequest":100}'::jsonb,
   '{"feeds":[]}'::jsonb),

  ('jsonld-careers', 'Página de carreiras com JSON-LD', 'jsonld-careers', 'jsonld_page', 'allowed',
   'https://schema.org/JobPosting',
   'Leitura de metadados estruturados JobPosting em páginas públicas de carreiras, respeitando robots.txt e uma requisição por página por execução. Sem contorno de bloqueio.',
   10, false, 'active',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":true,"providesSalary":false,"providesRecruiter":false,"paginated":false,"maxItemsPerRequest":50}'::jsonb,
   '{"pages":[]}'::jsonb),

  ('email-alert', 'Importação de alerta de e-mail', 'email-alert', 'email_alert', 'requires_user_key',
   'https://careeros.local/termos-internos',
   'Importa vagas de alertas que o próprio usuário recebe, por encaminhamento para endereço dedicado. Exige configuração do usuário. Fase 5.',
   60, true, 'paused',
   '{"supportsKeywordSearch":false,"supportsLocationFilter":false,"supportsDateFilter":false,"providesPublishedAt":false,"providesSalary":false,"providesRecruiter":false,"paginated":false,"maxItemsPerRequest":50}'::jsonb,
   '{}'::jsonb),

  ('linkedin', 'LinkedIn', 'unavailable', 'official_api', 'disallowed',
   'https://www.linkedin.com/legal/user-agreement',
   'Coleta automatizada de vagas e perfis é vedada pelos termos de uso, e não há API pública de vagas para este caso de uso. O CareerOS não coleta desta fonte, não faz login e não automatiza conta. O LinkedIn Analyzer funciona com PDF exportado, texto colado ou formulário.',
   1, false, 'disabled',
   '{}'::jsonb, '{}'::jsonb),

  ('indeed', 'Indeed', 'unavailable', 'official_api', 'review_needed',
   null,
   'O acesso programático depende de parceria/aprovação comercial. Sem contrato vigente, a fonte permanece desabilitada. Scraping não é alternativa aceita.',
   1, false, 'disabled',
   '{}'::jsonb, '{}'::jsonb)
on conflict (slug) do update
  set display_name       = excluded.display_name,
      adapter_key        = excluded.adapter_key,
      kind               = excluded.kind,
      legal_status       = excluded.legal_status,
      terms_url          = excluded.terms_url,
      legal_notes        = excluded.legal_notes,
      rate_limit_per_min = excluded.rate_limit_per_min,
      requires_user_key  = excluded.requires_user_key,
      capabilities       = excluded.capabilities,
      updated_at         = now();

-- ---------------------------------------------------------------------------
-- Dicionário de competências (extração determinística, documento 06 §7)
-- Núcleo inicial cobrindo as áreas declaradas pelo usuário: suporte técnico,
-- infraestrutura, redes, front-end, back-end, dados e TI em geral.
-- O alvo é ~300 termos; ampliar é INSERT de dado, sem mudança de código.
-- `aliases` deve conter todas as grafias que aparecem em descrições reais.
-- ---------------------------------------------------------------------------
insert into public.skills (slug, name, category, aliases) values
  -- Suporte técnico e service desk
  ('service-desk','Service Desk','methodology','{"service desk","servicedesk","help desk","helpdesk","central de servicos","suporte n1","suporte nivel 1"}'),
  ('suporte-tecnico','Suporte Técnico','methodology','{"suporte tecnico","suporte ao usuario","technical support","suporte n2","suporte nivel 2"}'),
  ('itil','ITIL','methodology','{"itil","itil v3","itil 4","gestao de servicos de ti"}'),
  ('glpi','GLPI','tool','{"glpi"}'),
  ('zendesk','Zendesk','tool','{"zendesk"}'),
  ('jira-service','Jira Service Management','tool','{"jira service management","jira service desk","jsm"}'),
  ('movidesk','Movidesk','tool','{"movidesk"}'),
  ('remote-support','Acesso remoto','tool','{"anydesk","teamviewer","acesso remoto","vnc","rdp","remote desktop"}'),
  ('hardware','Manutenção de hardware','infra','{"hardware","manutencao de hardware","montagem de computadores","troca de pecas"}'),
  ('impressoras','Impressoras e periféricos','infra','{"impressora","impressoras","periféricos","perifericos","multifuncional"}'),
  -- Sistemas operacionais
  ('windows','Windows','os','{"windows","windows 10","windows 11","windows client"}'),
  ('windows-server','Windows Server','os','{"windows server","win server","windows server 2019","windows server 2022"}'),
  ('linux','Linux','os','{"linux","gnu/linux","ubuntu","debian","centos","red hat","rhel","oracle linux"}'),
  ('macos','macOS','os','{"macos","mac os","osx"}'),
  ('shell-script','Shell Script','language','{"shell script","bash","sh","shellscript"}'),
  ('powershell','PowerShell','language','{"powershell","power shell"}'),
  -- Redes
  ('redes','Redes de computadores','network','{"redes","redes de computadores","networking","infraestrutura de redes"}'),
  ('tcp-ip','TCP/IP','network','{"tcp/ip","tcp ip","protocolos de rede"}'),
  ('dns','DNS','network','{"dns","servidor dns","bind"}'),
  ('dhcp','DHCP','network','{"dhcp"}'),
  ('vlan','VLAN','network','{"vlan","vlans","802.1q"}'),
  ('roteamento','Roteamento','network','{"roteamento","routing","ospf","bgp","rotas estaticas"}'),
  ('firewall','Firewall','security','{"firewall","pfsense","fortigate","fortinet","sophos","palo alto"}'),
  ('vpn','VPN','network','{"vpn","ipsec","openvpn","wireguard"}'),
  ('wifi','Redes sem fio','network','{"wifi","wi-fi","wireless","ubiquiti","unifi","access point"}'),
  ('switching','Switching','network','{"switch","switches","cisco","huawei","hp procurve","switching"}'),
  ('cabeamento','Cabeamento estruturado','network','{"cabeamento estruturado","cabeamento","patch panel","fibra optica"}'),
  ('zabbix','Zabbix','tool','{"zabbix"}'),
  ('wireshark','Wireshark','tool','{"wireshark","analise de pacotes"}'),
  -- Infraestrutura e cloud
  ('active-directory','Active Directory','infra','{"active directory","ad","gpo","politicas de grupo","ldap"}'),
  ('office-365','Microsoft 365','infra','{"office 365","microsoft 365","m365","o365","exchange online","intune"}'),
  ('azure','Azure','cloud','{"azure","microsoft azure","azure ad","entra id"}'),
  ('aws','AWS','cloud','{"aws","amazon web services","ec2","s3","rds","lambda"}'),
  ('gcp','Google Cloud','cloud','{"gcp","google cloud","google cloud platform"}'),
  ('virtualizacao','Virtualização','infra','{"virtualizacao","vmware","vsphere","esxi","hyper-v","proxmox","virtualbox"}'),
  ('backup','Backup e recuperação','infra','{"backup","veeam","bacula","restore","recuperacao de desastres","disaster recovery"}'),
  ('docker','Docker','infra','{"docker","containers","conteineres"}'),
  ('kubernetes','Kubernetes','infra','{"kubernetes","k8s","k3s"}'),
  ('terraform','Terraform','infra','{"terraform","iac","infraestrutura como codigo"}'),
  ('ansible','Ansible','infra','{"ansible"}'),
  ('nginx','Nginx','infra','{"nginx"}'),
  ('apache','Apache','infra','{"apache","httpd","apache2"}'),
  ('ci-cd','CI/CD','methodology','{"ci/cd","ci cd","integracao continua","entrega continua","github actions","gitlab ci","jenkins"}'),
  ('monitoramento','Monitoramento','infra','{"monitoramento","observabilidade","grafana","prometheus","datadog","new relic"}'),
  -- Segurança
  ('seguranca-informacao','Segurança da informação','security','{"seguranca da informacao","security","infosec","cibersegurança","ciberseguranca"}'),
  ('lgpd','LGPD','security','{"lgpd","protecao de dados","gdpr"}'),
  ('antivirus','Endpoint protection','security','{"antivirus","endpoint","edr","defender","kaspersky","sentinelone"}'),
  ('pentest','Teste de intrusão','security','{"pentest","teste de intrusao","ethical hacking","owasp"}'),
  ('iso-27001','ISO 27001','security','{"iso 27001","iso27001","sgsi"}'),
  -- Front-end
  ('html','HTML','language','{"html","html5"}'),
  ('css','CSS','language','{"css","css3","flexbox","grid css"}'),
  ('javascript','JavaScript','language','{"javascript","js","es6","ecmascript"}'),
  ('typescript','TypeScript','language','{"typescript","ts"}'),
  ('react','React','framework','{"react","reactjs","react.js"}'),
  ('nextjs','Next.js','framework','{"next.js","nextjs","next js"}'),
  ('vue','Vue.js','framework','{"vue","vuejs","vue.js","nuxt"}'),
  ('angular','Angular','framework','{"angular","angularjs","angular 2+"}'),
  ('svelte','Svelte','framework','{"svelte","sveltekit"}'),
  ('tailwind','Tailwind CSS','framework','{"tailwind","tailwindcss","tailwind css"}'),
  ('sass','Sass','framework','{"sass","scss","less"}'),
  ('bootstrap','Bootstrap','framework','{"bootstrap"}'),
  ('responsive','Design responsivo','methodology','{"design responsivo","responsivo","mobile first","responsive"}'),
  ('acessibilidade','Acessibilidade web','methodology','{"acessibilidade","a11y","wcag","aria"}'),
  ('figma','Figma','tool','{"figma","design handoff"}'),
  ('react-native','React Native','framework','{"react native","react-native"}'),
  ('jest','Jest','tool','{"jest","testing library","vitest"}'),
  ('cypress','Cypress','tool','{"cypress","playwright","testes e2e"}'),
  ('webpack','Webpack/Vite','tool','{"webpack","vite","bundler","rollup"}'),
  -- Back-end
  ('nodejs','Node.js','framework','{"node","nodejs","node.js"}'),
  ('express','Express','framework','{"express","expressjs","nestjs","nest.js","fastify"}'),
  ('python','Python','language','{"python","python3"}'),
  ('django','Django','framework','{"django","django rest framework","drf","flask","fastapi"}'),
  ('java','Java','language','{"java","java 8","java 11","java 17"}'),
  ('spring','Spring','framework','{"spring","spring boot","springboot"}'),
  ('csharp','C#','language','{"c#","csharp","c sharp"}'),
  ('dotnet','.NET','framework','{".net",".net core","dotnet","asp.net","asp net"}'),
  ('php','PHP','language','{"php","php7","php8"}'),
  ('laravel','Laravel','framework','{"laravel","symfony","codeigniter"}'),
  ('go','Go','language','{"golang","go lang"}'),
  ('ruby','Ruby','language','{"ruby","ruby on rails","rails"}'),
  ('rest-api','APIs REST','methodology','{"rest","api rest","restful","apis rest"}'),
  ('graphql','GraphQL','methodology','{"graphql","apollo"}'),
  ('microservicos','Microsserviços','methodology','{"microsservicos","microservicos","microservices","arquitetura de microsservicos"}'),
  ('mensageria','Mensageria','infra','{"rabbitmq","kafka","sqs","mensageria","filas"}'),
  ('git','Git','tool','{"git","github","gitlab","bitbucket","versionamento"}'),
  ('clean-code','Clean code','methodology','{"clean code","codigo limpo","solid","design patterns","padroes de projeto"}'),
  ('tdd','TDD','methodology','{"tdd","testes automatizados","test driven development","testes unitarios"}'),
  -- Banco de dados e dados
  ('sql','SQL','database','{"sql","consultas sql","ansi sql"}'),
  ('postgresql','PostgreSQL','database','{"postgresql","postgres","psql"}'),
  ('mysql','MySQL','database','{"mysql","mariadb"}'),
  ('sqlserver','SQL Server','database','{"sql server","sqlserver","mssql","t-sql","transact-sql"}'),
  ('oracle-db','Oracle Database','database','{"oracle","oracle database","pl/sql","plsql"}'),
  ('mongodb','MongoDB','database','{"mongodb","mongo","nosql"}'),
  ('redis','Redis','database','{"redis","cache distribuido"}'),
  ('supabase','Supabase','database','{"supabase"}'),
  ('firebase','Firebase','database','{"firebase","firestore"}'),
  ('modelagem-dados','Modelagem de dados','data','{"modelagem de dados","modelagem relacional","normalizacao","der"}'),
  ('etl','ETL','data','{"etl","elt","pipeline de dados","data pipeline","airflow"}'),
  ('power-bi','Power BI','data','{"power bi","powerbi","dax"}'),
  ('tableau','Tableau','data','{"tableau","looker","metabase","qlik"}'),
  ('excel','Excel avançado','tool','{"excel","excel avancado","planilhas","google sheets","procv","tabela dinamica"}'),
  ('pandas','pandas','data','{"pandas","numpy"}'),
  ('data-warehouse','Data Warehouse','data','{"data warehouse","dw","bigquery","redshift","snowflake","databricks"}'),
  ('estatistica','Estatística','data','{"estatistica","analise estatistica","estatistica descritiva"}'),
  ('machine-learning','Machine Learning','data','{"machine learning","aprendizado de maquina","scikit-learn","ml"}'),
  ('data-analysis','Análise de dados','data','{"analise de dados","data analysis","analise exploratoria"}'),
  ('kpi','Indicadores e KPIs','data','{"kpi","kpis","indicadores","metricas","dashboards"}'),
  -- Gestão, processos e competências comportamentais
  ('scrum','Scrum','methodology','{"scrum","agil","agile","sprint","kanban","metodologias ageis"}'),
  ('gestao-projetos','Gestão de projetos','methodology','{"gestao de projetos","project management","pmbok","cronograma"}'),
  ('documentacao','Documentação técnica','soft','{"documentacao","documentacao tecnica","base de conhecimento","runbook"}'),
  ('atendimento','Atendimento ao cliente','soft','{"atendimento ao cliente","atendimento","relacionamento com cliente","customer service"}'),
  ('comunicacao','Comunicação','soft','{"comunicacao","boa comunicacao","comunicacao clara"}'),
  ('trabalho-equipe','Trabalho em equipe','soft','{"trabalho em equipe","colaboracao","teamwork"}'),
  ('resolucao-problemas','Resolução de problemas','soft','{"resolucao de problemas","troubleshooting","analise de problemas","problem solving"}'),
  ('proatividade','Proatividade','soft','{"proatividade","proativo","autonomia"}'),
  ('ingles','Inglês','language','{"ingles","english","ingles tecnico","ingles intermediario","ingles avancado"}'),
  ('espanhol','Espanhol','language','{"espanhol","spanish"}'),
  ('erp','ERP','erp','{"erp","sap","totvs","protheus","senior sistemas","oracle erp"}')
on conflict (slug) do update
  set name     = excluded.name,
      category = excluded.category,
      aliases  = excluded.aliases;

-- ---------------------------------------------------------------------------
-- Verificação do seed (falha alto e cedo se algo essencial não entrou)
-- ---------------------------------------------------------------------------
do $$
declare
  v_sources integer;
  v_skills  integer;
begin
  select count(*) into v_sources from public.job_sources;
  select count(*) into v_skills  from public.skills;

  if v_sources < 5 then
    raise exception 'SEED_INCOMPLETO: fontes de vagas insuficientes (%).', v_sources;
  end if;
  if v_skills < 50 then
    raise exception 'SEED_INCOMPLETO: dicionário de competências insuficiente (%).', v_skills;
  end if;

  if exists (select 1 from public.job_sources where legal_status = 'allowed' and terms_url is null) then
    raise exception 'SEED_INVALIDO: fonte marcada como allowed sem terms_url.';
  end if;
end $$;
