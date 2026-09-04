# 📋 Registro de Decisões de Arquitetura (ADRs) — CRM 4U Connect

Este documento registra todas as decisões técnicas e de arquitetura tomadas no desenvolvimento do **CRM 4U Connect**, o contexto de cada decisão, alternativas consideradas e suas consequências.

---

## Índice das Decisões

- [ADR-001: Autenticação Compartilhada via Session Bridge](#adr-001-autenticação-compartilhada-via-session-bridge)
- [ADR-002: Extração de Telefones do WhatsApp Web via React Fiber Walk](#adr-002-extração-de-telefones-do-whatsapp-web-via-react-fiber-walk)
- [ADR-003: Armazenamento de Avatares em Data URI Base64](#adr-003-armazenamento-de-avatares-em-data-uri-base64)
- [ADR-004: Remoção do Arquivamento Automático de Leads](#adr-004-remoção-do-arquivamento-automático-de-leads)
- [ADR-005: Multi-tenancy e Isolamento Rigoroso via RLS no PostgreSQL](#adr-005-multi-tenancy-e-isolamento-rigoroso-via-rls-no-postgresql)
- [ADR-006: Telemetria e Logs da Extensão via Supabase com Flag de Debug](#adr-006-telemetria-e-logs-da-extensão-via-supabase-com-flag-de-debug)
- [ADR-007: Keep-Alive Diário via Vercel Cron para Supabase Free](#adr-007-keep-alive-diário-via-vercel-cron-para-supabase-free)
- [ADR-008: Aceite de Risco Residual de Credenciais Históricas](#adr-008-aceite-de-risco-residual-de-credenciais-históricas)
- [ADR-009: Autoatendimento de Perfil e Gestão por Departamentos](#adr-009-autoatendimento-de-perfil-nome-e-senha-com-senha-atual-e-gestão-por-departamentos)
- [ADR-010: Proteção de Status Vitais de Sistema e Métricas Universais no Dashboard](#adr-010-proteção-de-status-vitais-de-sistema-e-métricas-universais-no-dashboard)
- [ADR-011: Padronização Visual Global, Eliminação de Inconsistências e Manual DESIGN.md](#adr-011-padronização-visual-global-eliminação-de-inconsistências-e-manual-designmd)
- [ADR-012: Skeletons 1:1 de Alta Fidelidade e Transições em Efeito Cascata](#adr-012-skeletons-11-de-alta-fidelidade-e-transições-em-efeito-cascata)
- [ADR-013: Deduplicação Segura de Catálogos Comerciais](#adr-013-deduplicação-segura-de-catálogos-comerciais)
- [ADR-014: Catálogos Operacionais Sempre Isolados por Organização](#adr-014-catálogos-operacionais-sempre-isolados-por-organização)
- [ADR-015: Isolamento de leads não pode ter bypass global](#adr-015-isolamento-de-leads-não-pode-ter-bypass-global)
- [ADR-016: Clientes são bloqueados, não excluídos](#adr-016--clientes-são-bloqueados-não-excluídos)
- [ADR-017: Recuperação de leads por autoria exclusiva auditada](#adr-017--recuperação-de-leads-por-autoria-exclusiva-auditada)
- [ADR-018: Histórico de status é responsabilidade do banco](#adr-018--histórico-de-status-é-responsabilidade-do-banco)
- [ADR-019: Cadastro autônomo cria um tenant; acesso depende da assinatura](#adr-019--cadastro-autônomo-cria-um-tenant-acesso-depende-da-assinatura)
- [ADR-020: Métricas administrativas agregadas sem acesso global aos leads](#adr-020--métricas-administrativas-agregadas-sem-acesso-global-aos-leads)
- [ADR-021: Minha Conta & Planos é a referência única de informações da empresa](#adr-021--minha-conta--planos-é-a-referência-única-de-informações-da-empresa)
- [ADR-022: Transferência conservadora de leads sem autoria para a titular identificada](#adr-022--transferência-conservadora-de-leads-sem-autoria-para-a-titular-identificada)
- [ADR-023: Tenant de inserts operacionais é derivado no banco](#adr-023--tenant-de-inserts-operacionais-é-derivado-no-banco)
- [ADR-024: Compatibilidade restrita com o POST de histórico da extensão legada](#adr-024--compatibilidade-restrita-com-o-post-de-histórico-da-extensão-legada)
- [ADR-025: Separação entre migrations e operações manuais](#adr-025-separação-entre-migrations-e-operações-manuais)

---

### ADR-001: Autenticação Compartilhada via Session Bridge

- **Status**: ✅ Aceito & Implementado
- **Contexto**: A extensão Chrome precisa realizar chamadas autenticadas ao Supabase com o JWT do usuário logado. Exigir que o atendente faça login na web e depois redigite login e senha na barra lateral do WhatsApp criava fricção e suporte desnecessário.
- **Decisão**: Criar o script `session-bridge.js` injetado na aplicação `crm-web`. O script escuta o `localStorage` do Supabase (`sb-*-auth-token`), e sempre que há login/logout ou rotação de token, envia o JWT ao Service Worker (`background.js`) via `chrome.runtime.sendMessage`, persistindo em `chrome.storage.local`.
- **Consequências**:
  - *Positivas*: Experiência *zero-login* na extensão. O atendente entra no CRM Web e a extensão no WhatsApp Web fica autenticada instantaneamente.
  - *Negativas / Atenções*: A lista `ALLOWED_SESSION_ORIGINS` no `background.js` e as permissões no `manifest.json` precisam conter exatamente os domínios reais de produção e desenvolvimento do CRM.

---

### ADR-002: Extração de Telefones do WhatsApp Web via React Fiber Walk

- **Status**: ✅ Aceito & Implementado
- **Contexto**: No WhatsApp Web, quando um contato está salvo na agenda do telefone do atendente, o DOM exibe apenas o nome fantasia (ex: "Carina"), sem o número de telefone em nenhum atributo HTML visível. O número de telefone é o identificador único para buscar e sincronizar o lead no CRM.
- **Decisão**: Implementar uma travessia na árvore interna de componentes do React (*React Fiber Walk*) a partir do nó `[data-testid^="list-item-"]` ou do cabeçalho da conversa. Acessando a propriedade `props.chat.id.user` do componente React interno, obtemos o telefone limpo em formato E.164.
- **Consequências**:
  - *Positivas*: Funciona de forma transparente tanto para contatos salvos na agenda quanto para contatos não salvos.
  - *Negativas / Atenções*: Caso o WhatsApp Web altere estruturalmente a hierarquia de componentes React, o Fiber Walk pode precisar de ajustes (mapeados no documento `WHATSAPP_DOM_REFERENCE.md`).

---

### ADR-003: Armazenamento de Avatares em Data URI Base64

- **Status**: ✅ Aceito & Implementado
- **Contexto**: As fotos de perfil no WhatsApp vêm do CDN `pps.whatsapp.net`. Essas URLs possuem tokens temporários que expiram em poucos dias. Além disso, o content script sofre bloqueio de CORS ao tentar baixar a foto diretamente.
- **Decisão**: O `content.js` delega o download ao Service Worker (`background.js`), que possui permissão de host para o CDN do WhatsApp. O Service Worker baixa o blob da foto e o converte para uma string **Base64 Data URI** (`data:image/jpeg;base64,...`), gravando diretamente no campo `foto_url` da tabela `leads`.
- **Consequências**:
  - *Positivas*: As fotos nunca quebram ou expiram no CRM Web e não dependem de upload em bucket externo.
  - *Negativas*: Aumenta levemente o tamanho dos registros na tabela `leads` (mitigado pelo fato de avatares do WhatsApp serem pequenos, ~10-30KB).

---

### ADR-004: Remoção do Arquivamento Automático de Leads

- **Status**: ✅ Aceito & Implementado (`migration_11_remove_auto_arquivar.sql`)
- **Contexto**: Inicialmente foi implementada uma função de banco `arquivar_leads_inativos()` com a coluna `auto_arquivar_dias` nas organizações, para arquivar leads sem interação após X dias.
- **Decisão**: A funcionalidade de arquivamento automático foi descontinuada e removida do produto. O arquivamento de leads passou a ser uma ação 100% manual e explícita do atendente ou administrador.
- **Consequências**:
  - *Positivas*: Elimina o risco de leads em negociação quente ou pausada sumirem do Pipeline visual sem a ciência do atendente.
  - *Negativas*: Requer disciplina dos vendedores para arquivar leads que não farão mais parte do funil ativo.

---

### ADR-005: Multi-tenancy e Isolamento Rigoroso via RLS no PostgreSQL

- **Status**: ✅ Aceito & Implementado
- **Contexto**: Múltiplas empresas e organizações utilizam o CRM. Vazamento de leads entre organizações seria uma violação gravíssima de privacidade e segurança.
- **Decisão**: Implementar RLS (*Row Level Security*) em todas as tabelas públicas, associando cada registro a uma `organization_id`. Consultas e inserções validam o `organization_id` do usuário logado através do token JWT (`auth.uid()`).
- **Consequências**:
  - *Positivas*: Segurança garantida no nível do banco de dados (mesmo se houver falha no código do frontend, um usuário nunca conseguirá acessar dados de outra organização).
  - *Negativas*: Toda nova tabela adicionada ao schema deve obrigatoriamente ter `organization_id`, RLS habilitado e políticas criadas.

---

### ADR-006: Telemetria Enxuta de Erros da Extensão (Sem Modo Debug)

- **Status**: ✅ Aceito & Atualizado (`migration_07` + `migration_12_remove_debug_mode.sql`)
- **Contexto**: A extensão roda no WhatsApp Web e precisa registrar quebras de seletores ou erros de autenticação. A versão inicial enviava logs informativos (`INFO`) a cada F5 e possuía uma flag `debug_mode` que gerava requisições extras no boot.
- **Decisão**: Simplificar o `logger.js`:
  1. Apenas **`ERROR`** e **`WARN`** são enviados ao Supabase (`extension_logs`).
  2. Logs de **`INFO`** e **`DEBUG`** ficam restritos ao `console.log` local do navegador.
  3. Remoção do `debug_mode` (eliminando a chamada extra no boot da extensão e o botão na UI).
  4. Redução de metadados: navegador salvo apenas como nome limpo (`Chrome`, `Edge`, etc.) e URL simplificada.
- **Consequências**:
  - *Positivas*: Redução de mais de 90% no volume de requisições e escritas no Supabase; zero requisições extras no boot; código mais direto e interface focada em erros reais.
  - *Negativas*: Logs informativos não são visualizados remotamente (devem ser inspecionados no F12 se necessário).

---

### ADR-007: Keep-Alive Diário via Vercel Cron para Supabase Free

- **Status**: ✅ Aceito & Implementado
- **Contexto**: Projetos no plano Free do Supabase entram em modo inativo (*paused*) se ficarem sem tráfego por alguns dias consecutivos (ex: finais de semana e feriados prolongados).
- **Decisão**: Configurar um endpoint serverless `/api/keep-alive` no Vercel com execução diária às 09:00 BRT via `vercel.json` crons, executando uma query rápida (`SELECT 1`) no banco de dados.
- **Consequências**:
  - *Positivas*: Garante alta disponibilidade e evita que atendentes encontrem o sistema congelado no início da semana.

---

### ADR-008: Aceite de Risco Residual de Credenciais Históricas

- **Status**: ⚠️ Risco Aceito & Registrado
- **Contexto**: A `service_role key` e a senha do banco foram compartilhadas em contexto de desenvolvimento em sessões anteriores.
- **Decisão**: Decisão do cliente de **NÃO rotacionar** as credenciais no momento.
- **Procedimento para Rotação Futura**:
  1. No painel do Supabase, resetar a senha do banco de dados.
  2. Gerar novo JWT Secret (rotaciona a anon key e a service role key).
  3. Atualizar `.env` no Vercel e `content.js`/`background.js` na extensão e realizar novo deploy.

---

### ADR-009: Autoatendimento de Perfil (Nome e Senha com Senha Atual) e Gestão por Departamentos

- **Status**: ✅ Aceito & Implementado
- **Contexto**: Usuários e atendentes necessitam de autonomia e segurança para atualizar seus dados pessoais e trocar de senha de forma protegida contra terceiros. Além disso, a gestão de membros e setores da organização precisa ser centralizada.
- **Decisão**:
  1. Integrar na aba **Usuários & Equipe** (`/configuracoes?tab=usuarios`) a seção de **Meu Perfil** (Meus Dados de Identificação + Alteração de Senha Segura com validação obrigatória da Senha Atual via reautenticação antes da troca).
  2. Atualizar o atalho no cabeçalho superior (`Olá, [Nome]` -> *Meu Perfil*) para direcionar diretamente para `/configuracoes?tab=usuarios`.
  3. Adicionar a coluna `departamento` (`text DEFAULT 'comercial'`) com restrição CHECK na tabela `public.profiles` (`13_profile_departamento.sql`).
  4. Incluir seleção de departamento no formulário de cadastro (`Login.tsx`) e controle completo por administradores em `Configuracoes.tsx`.
- **Consequências**:
  - *Positivas*: Máxima segurança contra alterações indevidas de senha, interface unificada sem modais redundantes e visão clara do perfil individual ao lado da equipe.

---

### ADR-010: Proteção de Status Vitais de Sistema e Métricas Universais no Dashboard

- **Status**: ✅ Aceito & Implementado
- **Contexto**: Em um CRM multi-tenant onde as empresas podem criar, reordenar, renomear e excluir etapas de funil, a exclusão inadvertida de status vitais (`novo`, `fechado`, `perdido`, `em_atendimento`, `proposta_enviada`) quebrava o fluxo de entrada de leads (WhatsApp/Webhooks), a conversão de vendas e o registro de perda. Além disso, ter cards com slugs fixos (*hardcoded*) no Dashboard fazia com que o painel mostrasse contagens zeradas ou cards órfãos quando uma empresa personalizava suas colunas.
- **Decisão**:
  1. **Proteção de Status Vitais**: Os status chave `novo`, `novo_lead`, `em_atendimento`, `proposta_enviada`, `fechado` e `perdido` são marcados como protegidos do sistema (`SYSTEM_STATUS_VALUES`). Eles **não podem ser desativados ou excluídos** em Configurações (o botão de lixeira é substituído por um cadeado 🔒 e a função de exclusão bloqueia tentativas programmaticamente). É permitido apenas renomear o rótulo de exibição, alterar cores e reordenar a ordem no funil.
  2. **Pipeline Ativo Universal no Dashboard**: No Dashboard, os cards fixos anteriores ("Em atendimento" e "Proposta enviada") foram substituídos pela métrica universal **"Em Negociação"** (calculando dinamicamente todos os leads onde `status NOT IN ('fechado', 'perdido')`).
- **Consequências**:
  - *Positivas*: Integridade absoluta do banco de dados e dos fluxos automatizados; o Dashboard é 100% resiliente e funciona para qualquer nicho de negócio, independente de quantas etapas a organização configurar no Kanban.

---

### ADR-011: Padronização Visual Global, Eliminação de Inconsistências e Manual DESIGN.md

- **Status**: ✅ Aceito & Implementado
- **Contexto**: Havia inconsistências visuais acumuladas no sistema: campos de seleção (`CustomSelect`) com bordas e fundos verde-água desconexos ao selecionar itens, botões em modais sem ícones e com estados desabilitados em tons "verde-água/menta claro" (`disabled:bg-emerald-300`), além de badges de status com fundo claro e baixo contraste.
- **Decisão**:
  1. **Criação do `docs/DESIGN.md`**: Manual canônico estabelecendo hierarquia de botões (Primário, Secundário, Destrutivo), inputs, seletores, modais e badges.
  2. **Neutralização de `CustomSelect`**: Todos os seletores agora utilizam fundo neutro `bg-white`, borda `border-slate-200` e texto `text-slate-800`, eliminando fundos esverdeados artificiais.
  3. **Universalidade de Ícones e Estados Disabled**: Todos os botões de ação e submissão receberam ícones contextuais do Lucide e estados desabilitados padronizados (`disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed`).
  4. **StatusBadges Sólidos**: Badges de status passaram a adotar fundo sólido com texto branco (`px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs`).
- **Consequências**:
  - *Positivas*: Consistência visual absoluta em todas as telas, maior legibilidade, contraste profissional e regras claras para futuras implementações.

---

### ADR-012: Skeletons 1:1 de Alta Fidelidade e Transições em Efeito Cascata

- **Status**: ✅ Aceito & Implementado
- **Contexto**: A aplicação exibia spinners soltos (`<Loader2>`) ou skeletons genéricos e retangulares que não correspondiam ao layout real dos elementos renderizados, além de exibir conteúdo de forma abrupta sem transição de carregamento.
- **Decisão**:
  1. **Skeletons 1:1 Dedicados**: Criação de componentes dedicados em `src/components/skeletons/` (`DashboardSkeleton`, `PipelineSkeleton`, `LeadTableSkeleton`, `LeadDrawerSkeleton`, `ConfiguracoesSkeleton`, `DiagnosticoSkeleton`) com animação shimmer suave e dimensões exatas de cards, colunas de Kanban, badges e formulários.
  2. **Efeito Cascata Escalonado (*Staggered Cascade Animation*)**: Aplicação da classe `.animate-cascade-item` com atrasos dinâmicos (`animationDelay`) nos blocos, cartões do funil e linhas de tabelas, proporcionando uma transição fluida e moderna do estado de carregamento para o estado populado.
- **Consequências**:
  - *Positivas*: Percepção de carregamento muito mais rápida, previsibilidade visual (o usuário sabe exatamente o que vai carregar) e sensação de acabamento de ponta em toda a aplicação.

---

### ADR-013: Deduplicação Segura de Catálogos Comerciais

- **Status**: ✅ Aceito & Implementado (`migration_21_safe_catalog_deduplication.sql`)
- **Contexto**: Origens, segmentos e etapas do funil podem ser criados pela tela de configurações e durante a importação de planilhas. Sem unicidade por organização, entradas equivalentes passam a aparecer repetidas nos seletores. Excluir cópias diretamente pode apagar a classificação de leads quando há chaves estrangeiras vinculadas.
- **Decisão**:
  1. A migration 21 escolhe uma configuração canônica por organização (a mais antiga), atualiza os `origem_id` e `segmento_id` dos leads para essa configuração e só então remove as cópias.
  2. Para status, normaliza o texto gravado nos leads para o `value` canônico antes de remover a configuração duplicada.
  3. Índices únicos por `organization_id` e valor/nome normalizado impedem reincidência no banco; a tela de configurações e a importação fazem a mesma validação antes de gravar.
- **Consequências**:
  - *Positivas*: Nenhum lead é excluído ou fica sem origem/segmento durante a limpeza; cada organização mantém seu próprio catálogo; importações repetidas não geram novas cópias visuais.
  - *Atenções*: A migration 20 não deve ser usada para este reparo, pois exclui configurações antes de redirecionar os vínculos dos leads. Executar exclusivamente a migration 21 no banco de produção.

---

### ADR-014: Catálogos Operacionais Sempre Isolados por Organização

- **Status**: ✅ Aceito & Implementado (`migration_22_scope_catalogs_to_current_organization.sql`)
- **Contexto**: A política das tabelas `lead_statuses`, `lead_sources` e `lead_segments` permitia que super admins lessem registros de todas as organizações. Como as telas operacionais carregavam esses catálogos sem selecionar uma empresa-alvo, exibiam opções visualmente repetidas de clientes distintos.
- **Decisão**: Restringir as três políticas RLS ao `organization_id = auth_user_org_id()` inclusive para super admins e filtrar explicitamente os carregamentos da tela de configurações e do contexto de status pela organização do usuário logado.
- **Consequências**:
  - *Positivas*: Cada usuário, incluindo super admins em suas telas operacionais, visualiza somente o pipeline, as origens e os segmentos do seu tenant; não há alteração de leads ou perda de classificação.
  - *Atenções*: A gestão global de clientes continua em `organizations` e `profiles`; para administrar o catálogo de outro cliente, deve-se autenticar como membro daquela organização ou implementar uma troca explícita de tenant no futuro.
### ADR-015: Isolamento de leads não pode ter bypass global

#### Contexto

Foi identificada em produção uma política RLS adicional, `Acesso aos leads`, com condição `true` na tabela `public.leads`. Políticas permissivas são combinadas por `OR` no PostgreSQL, portanto ela anulava a política de escopo por `organization_id` e poderia expor leads de outros clientes.

#### Decisão

Remover a política global e recriar explicitamente a política `Membros da organização acessam leads`, limitada a `organization_id = auth_user_org_id()` e a usuários ativos.

#### Consequências

- Nenhum lead é alterado ou removido.
- Usuários veem apenas leads da própria organização.
- A administração global de clientes permanece em `organizations` e `profiles`; ela não concede leitura operacional global de leads.

---

# ADR-016 — Clientes são bloqueados, não excluídos

## Contexto

A função `delete_organization` removia em cascata a organização, seus leads e os registros operacionais relacionados. Isso cria risco inaceitável de perda acidental de dados de clientes. Também foi identificado que `comercial@4uconnect.com.br` possuía o papel global `is_super_admin` sem necessidade operacional.

## Decisão

Usar `plano_status = 'bloqueado'` como desativação operacional, remover a ação de exclusão do CRM e tornar a RPC de exclusão inutilizável para a API. Somente `leoclecio@outlook.com` permanece como Super Admin; a conta comercial continua administradora apenas do próprio tenant.

## Consequências

- Bloquear um cliente preserva integralmente seus leads e histórico.
- A API autenticada não consegue excluir organizações nem desvincular perfis de um cliente.
- O SQL Editor do proprietário do projeto continua uma via de emergência deliberada, pois um administrador técnico sempre pode alterar o banco.

# ADR-017 — Recuperação de leads por autoria exclusiva auditada

## Contexto

Os 874 leads estavam associados à conta e organização comercial. O histórico operacional permitiu identificar 220 leads com autoria exclusiva: 41 de `leoclecio@outlook.com`, 176 de `comercial@immovicontabilidade.com.br` e 3 de `comercial@contabilizandodigital.com.br`. Outros 106 não possuem evidência suficiente e devem permanecer inalterados.

## Decisão

Transferir somente os 220 candidatos para o perfil e organização correspondentes, dentro de uma transação com contagens esperadas, mapeamento de catálogos por nome normalizado, preservação de datas e trilha persistente de auditoria.

## Consequências

- Nenhum lead sem evidência é movido.
- Atividades, notas e histórico acompanham o lead para manter o isolamento por organização.
- Os registros de auditoria permitem identificar e reverter cada transferência, se necessário.

# ADR-018 — Histórico de status é responsabilidade do banco

## Contexto

Após o RLS exigir `organization_id` em `lead_status_history`, alterações de status realizadas pela aplicação podiam atualizar o lead e falhar silenciosamente ao inserir a timeline. O resultado era divergência entre o status atual e o último evento registrado.

## Decisão

Centralizar a criação de histórico em triggers de `leads` para INSERT e UPDATE de `status`. A aplicação deixa de inserir eventos manualmente, e o banco grava o status anterior, o novo status, o usuário autenticado e a organização do próprio lead em uma única transação.

## Consequências

- Não existe mais atualização de status sem tentativa automática de histórico.
- Versões publicadas anteriores continuam corretas: a inserção manual antiga é negada, mas o trigger já gravou o evento.
- Eventos de teste sem histórico são reparados a partir do status anterior e do timestamp já persistido no lead.

# ADR-019 — Cadastro autônomo cria um tenant; acesso depende da assinatura

## Contexto

O CRM opera sem colaboradores compartilhados: cada novo cliente cria a própria conta e a própria organização, começando inativo até a liberação manual. A área de Clientes & Assinaturas possuía políticas antigas que permitiam criação de organizações por qualquer conta autenticada, alteração de flags globais do próprio perfil e um bloqueio de plano apenas visual.

## Decisão

Restringir a criação manual de organizações ao Super Admin, exigir empresa e WhatsApp principal no cadastro autônomo e manter o usuário novo como atendente inativo da sua organização. O WhatsApp fica no contato administrativo da organização, não em uma tabela de leads. A autorização operacional passa a exigir simultaneamente perfil ativo, assinatura `ativo` ou `trial` e vigência não expirada. As flags `is_admin`, `is_super_admin` e o vínculo de organização não podem ser alterados pelo navegador; a cota de leads é validada por trigger no banco.

## Consequências

- Bloqueio ou vencimento impede acesso aos dados sem apagar a empresa, leads ou histórico.
- O menu e a rota de Clientes & Assinaturas são exclusivos do Super Admin também na interface.
- Não há criação de colaboradores nem exclusão de perfis pela interface; cada cliente usa sua conta inicial própria.
- O cadastro autônomo continua criando a organização por trigger de Auth, em contexto controlado de banco.
- A Data API não cria organizações manualmente; o cadastro sem empresa é recusado antes de persistir qualquer conta.
- O cadastro sem WhatsApp válido é recusado antes de criar perfil ou organização; o contato fica disponível para comunicação administrativa.

# ADR-020 — Métricas administrativas agregadas sem acesso global aos leads

## Contexto

A página Clientes & Assinaturas precisa mostrar a quantidade de leads de cada organização e o total da plataforma. A política de RLS de `leads` deliberadamente restringe a leitura de linhas à própria organização; restaurar acesso global para superadmin exporia dados de clientes além do necessário para a métrica.

## Decisão

A página usa a RPC `get_superadmin_organization_lead_counts()`, executável apenas por usuários autenticados que satisfaçam `is_super_admin()`. A função retorna exclusivamente `organization_id` e `total_leads`; não devolve campos de leads nem altera registros.

## Consequências

- A visão administrativa exibe contagens corretas, inclusive no KPI global, e preserva o isolamento dos dados detalhados de leads.
- Novas métricas globais devem seguir o mesmo padrão de agregação mínima.

# ADR-021 — Minha Conta & Planos é a referência única de informações da empresa

## Contexto

Administradores e clientes recebiam variações diferentes de nome da empresa, plano, vigência e consumo. Isso ocultava informações importantes da conta inicial do cliente e mantinha uma aba de empresa separada, apesar do modelo de uma conta por organização.

## Decisão

Concentrar **Minha Conta**, **Informações da Empresa** e **Seu Plano** na aba **Minha Conta & Planos**, com os mesmos cartões e campos para administrador e cliente. O administrador vê apenas a ação adicional de gerenciar plano; os dados exibidos permanecem os mesmos.

## Consequências

- Todo titular consulta plano contratado, mensalidade, vigência e consumo de leads no mesmo local.
- O nome da própria empresa pode ser atualizado sem conceder alteração de plano, limites ou vigência.
- URLs antigas com `tab=empresa` são direcionadas para a aba unificada.

# ADR-022 — Transferência conservadora de leads sem autoria para a titular identificada

## Contexto

Uma revisão da responsável pela conta comercial identificou que 106 leads sem autoria registrada no histórico de status ou nas atividades não pertenciam à sua organização. A conta ativa `julia@gmail.com`, da organização Costuras Finas, foi indicada como a titular correta.

## Decisão

Transferir exclusivamente esses 106 leads para Julia, preservando as datas originais e realocando os 137 eventos de status sem autor para a mesma organização. A migration exige que a pré-validação encontre exatamente 106 candidatos ou nenhum (reexecução), impedindo transferências em massa fora do lote aprovado.

## Consequências

- Os 548 leads restantes da conta comercial não são alterados.
- Não há notas nem atividades a migrar; a timeline de status permanece visível para Julia.
- Status, origens e segmentos necessários já existem no tenant de destino, sem criação ou sobrescrita de catálogos.

# ADR-023 — Tenant de inserts operacionais é derivado no banco

## Contexto

A extensão e alguns fluxos legados do CRM criavam leads e atividades sem enviar `organization_id`. Após a cota de leads passar a ser validada antes do `INSERT`, o banco recusava a linha sem tenant. Em paralelo, a extensão ainda tentava gravar manualmente `lead_status_history`, embora a migration 26 já tivesse transferido essa responsabilidade para triggers e bloqueado inserções diretas. O resultado visível era a mensagem genérica “Erro de conexão”, inclusive quando o lead já havia sido criado e somente a segunda requisição falhara.

## Decisão

O cliente atualizado envia explicitamente o `organization_id` obtido pela própria consulta protegida por RLS. Como compatibilidade e defesa em profundidade, triggers `BEFORE INSERT` derivam o tenant do perfil autenticado para `leads` e do lead pai para `lead_activities` e `lead_notes`; valores de tenant fornecidos pelo navegador não são considerados autoridade. A extensão deixa de inserir histórico manualmente e passa a interpretar respostas HTTP/PostgREST separando conectividade, permissão, tenant, duplicidade e limite do plano.

## Consequências

- A criação de leads volta a funcionar com a RLS e a validação de cota atuais sem abrir acesso entre organizações.
- Clientes antigos que omitem `organization_id` continuam compatíveis após a migration 32.
- Um único `INSERT` de lead também cria seu histórico inicial no banco; não há falso erro depois de uma gravação bem-sucedida.
- Erros de regra de negócio deixam de ser apresentados incorretamente como falha de internet.

# ADR-024 — Compatibilidade restrita com o POST de histórico da extensão legada

## Contexto

Após a migration 32, a extensão antiga voltou a criar leads, mas continuou exibindo “Erro de conexão”. O console confirmou que o `INSERT` de `leads` tinha sucesso e que a falha `403` ocorria no POST seguinte para `lead_status_history`. Esse cliente legado repete uma transição que a migration 26 já registrou automaticamente no mesmo `INSERT`/`UPDATE` do lead. A instalação existente precisa continuar funcionando sem substituição da extensão.

## Decisão

Permitir que o POST autenticado alcance um trigger de compatibilidade em `lead_status_history`. O trigger aceita normalmente apenas inserções aninhadas originadas pelo trigger oficial de `leads`; para chamadas diretas, valida usuário ativo, tenant do lead pai e existência de uma transição idêntica. Quando ela já existe, retorna `NULL` e transforma somente a repetição legada em operação sem efeito e sem erro. Se não existir evento idêntico, a escrita manual permanece bloqueada com `42501`.

## Consequências

- A extensão antiga conclui o fluxo visual de sucesso sem duplicar a timeline.
- O histórico continua sendo responsabilidade exclusiva dos triggers de `leads`.
- Não é possível usar a policy de compatibilidade para criar eventos inéditos ou acessar outro tenant.
- A extensão v1.0.2 permanece a implementação limpa, mas deixa de ser obrigatória para corrigir as instalações antigas já distribuídas.

---

### ADR-025: Separação entre migrations e operações manuais

#### Contexto

O diretório de migrations misturava evolução reutilizável do schema com exclusões, transferências e recuperações ligadas a contas e contagens específicas de produção. A orientação de executar todos os arquivos em ordem podia interromper um ambiente novo ou alterar dados reais por engano.

#### Decisão

- `database/migrations/` passa a conter somente mudanças reutilizáveis de schema, RLS, funções, triggers e compatibilidade.
- Operações pontuais são preservadas em `database/operations/archive/`, fora da rotina de deploy.
- A antiga migration 25 foi dividida: a criação da tabela de auditoria permanece como migration; a recuperação dos 220 leads fica apenas no arquivo histórico.
- Os identificadores antigos são mantidos para rastreabilidade, mesmo que isso deixe lacunas na sequência de migrations.

#### Consequências

- Um deploy normal não oferece mais scripts destrutivos como parte da cadeia de banco.
- Ambientes novos podem receber a estrutura de auditoria sem depender de usuários, UUIDs ou contagens existentes em produção.
- A adoção futura do Supabase CLI exige criar uma baseline e reconciliar o histórico do banco antes de automatizar `db push`.
