# 🧠 Memória Viva do Projeto — CRM 4U Connect

Última atualização: **04/09/2026**

Este arquivo é o **diário de bordo dinâmico** do projeto. Ele registra o estado atual do desenvolvimento, tarefas em andamento, armadilhas técnicas (*gotchas*) e decisões operacionais imediatas.

---

## 📌 Estado Atual do Projeto

- **Fase**: Estabilização da extensão v1.0.2 e do fluxo de criação de leads.
- **Painel Web (`crm-web`)**:
  - React 19 + TypeScript + Vite + Tailwind CSS.
  - Kanban de Leads, Tabela com filtros, Drawer de detalhes, Linha do tempo de notas, Agenda de Follow-ups, Dashboard analítico e Clientes & Assinaturas.
  - Hospedado na Vercel (`https://connect-crm.vercel.app`).
- **Extensão Chrome (`crm-extension`)**:
  - Manifest V3 (versão `1.0.2`).
  - Injeção de sidebar no WhatsApp Web (`web.whatsapp.com`).
  - Sincronização de autenticação *zero-login* via `session-bridge.js`.
  - Captura de fotos via Service Worker em Base64 Data URI.
  - Extração de contatos salvos via React Fiber Walk.
- **Banco de Dados (Supabase)**:
  - 30 migrations reutilizáveis em `database/migrations/` e 5 operações históricas isoladas em `database/operations/archive/`.
  - Multi-tenancy isolado por `organization_id` via RLS.
  - Realtime ativo em `leads`, `lead_statuses` e `lead_activities`.
  - **Correção de catálogos duplicados aplicada**: a migration `22_scope_catalogs_to_current_organization.sql` restringiu `lead_statuses`, `lead_sources` e `lead_segments` à organização atual, inclusive para Super Admin. Validação na organização `comercial`: 10 status, 19 origens e 14 segmentos, sem repetição visual e sem alteração em leads.
  - **Isolamento de leads corrigido**: a migration `23_remove_global_leads_policy.sql` remove a política permissiva global `Acesso aos leads` e restaura o acesso apenas para a organização atual. A mudança é exclusivamente de RLS e não altera registros.
  - **Exclusão permanente de clientes bloqueada**: a migration `24_protect_clients_from_permanent_deletion.sql` desativa a RPC destrutiva, remove o DELETE da Data API, bloqueia a desvinculação de perfis e usa o bloqueio de plano como desativação reversível. `comercial@4uconnect.com.br` deixa de ser Super Admin.
  - **Recuperação auditada de vínculos de leads aplicada**: a operação histórica `database/operations/archive/25_recover_leads_by_exclusive_audit_evidence.sql` transferiu 220 leads com autoria exclusiva comprovada (41 Connect CRM, 176 Lucas, 3 Kátia). A auditoria preserva 220 snapshots; atividades, notas e histórico foram validados sem divergência de organização. Os 106 sem evidência permaneceram na organização comercial.
  - **Integridade do histórico de status corrigida**: `26_database_status_history_integrity.sql` move a gravação de timeline para triggers no banco, impedindo que mudanças de status fiquem sem histórico por erro de RLS. Movimentos de teste sem timeline são recuperados com seus horários originais.
  - **Clientes & Assinaturas blindado**: `27_secure_client_subscriptions_and_members.sql` impede elevação de privilégio via perfil, torna `bloqueado`/vencido efetivo no acesso e valida limite de leads no banco. O produto não usa mais colaboradores: cada cliente se cadastra como usuário normal da própria organização e aguarda liberação.
  - **Cadastro autônomo obrigatório**: `28_require_company_for_self_signup.sql` remove a criação manual de organizações pela API e exige o nome da empresa no gatilho de Auth. Assim, cada novo cliente nasce isolado e não há perfis/tenants órfãos.
  - **Prevenção adicional versionada**: `21_safe_catalog_deduplication.sql` remapeia referências de leads antes de limpar duplicidades internas e cria índices únicos normalizados por organização. Não foi necessário executá-la na produção, pois não havia duplicidades dentro da mesma organização.
  - **Correção do salvamento pela extensão**: `32_restore_tenant_context_on_operational_inserts.sql` deriva o tenant de novos leads no banco antes da validação de cota e faz atividades/notas herdarem a organização do lead pai. A extensão v1.0.2 também envia `organization_id`, remove o POST manual de histórico já substituído pelos triggers da migration 26 e mostra erros específicos em vez do genérico “Erro de conexão”.
  - **Compatibilidade com extensão antiga**: o teste após a migration 32 confirmou criação do lead seguida de `403` no POST redundante de `lead_status_history`. A migration 33 absorve somente essa repetição já existente, sem duplicar eventos e sem permitir histórico manual inédito.

---

## ⚠️ Armadilhas Técnicas Conhecidas (*Gotchas / Não Esquecer*)

1. **Alteração de Domínio do CRM Web**:
   - Se o domínio da Vercel mudar, você **DEVE** atualizar 3 locais na extensão:
     1. `crm-extension/manifest.json`: `host_permissions` e `content_scripts.matches`.
     2. `crm-extension/background.js`: array `ALLOWED_SESSION_ORIGINS`.
     3. `crm-extension/content.js`: constante `CRM_URL`.
   - Após alterar, recarregar a extensão em `chrome://extensions` e dar F5 no WhatsApp Web.

2. **Fotos do WhatsApp e CDN**:
   - URLs de imagem do CDN `pps.whatsapp.net` expiram em poucos dias e sofrem bloqueio de CORS no content script.
   - **Regra**: Sempre passar pelo `background.js` (ação `FETCH_PHOTO`) e salvar no banco como Data URI Base64 (`data:image/jpeg;base64,...`).

3. **Migrations no Supabase**:
   - O arquivo `database/migrations/02_data_seed.sql` contém **dados fictícios** e **NUNCA** deve ser executado em produção que já possua dados reais.
   - Toda migration nova deve ser idempotente (`IF NOT EXISTS`, `OR REPLACE`).
   - Arquivos de `database/operations/` não fazem parte do deploy. São procedimentos manuais ligados a uma auditoria específica e nunca devem ser executados em lote.

4. **Arquivamento de Leads**:
   - O arquivamento automático foi descontinuado (`migration_11`). Leads só são arquivados manualmente pelo atendente/gestor.

5. **Acesso do PostgREST e Cache de Schema**:
   - Se alterar tabelas diretamente no SQL Editor, execute `NOTIFY pgrst, 'reload schema';` para atualizar o cache do PostgREST.

6. **Limpeza de status, origens e segmentos duplicados**:
   - **Não executar** `20_deduplicate_statuses_and_cleanup.sql` para limpar produção: ele apaga configurações antes de preservar as referências dos leads.
   - Executar somente `21_safe_catalog_deduplication.sql`. Ela primeiro redireciona `origem_id`, `segmento_id` e status para o registro canônico e só depois remove cópias; nenhum lead é excluído.

7. **Catálogos repetidos para Super Admin**:
   - Status, origens e segmentos com o mesmo nome podem existir legitimamente em organizações diferentes. A migration `22_scope_catalogs_to_current_organization.sql` foi aplicada e removeu o bypass de Super Admin apenas dessas três tabelas, evitando que a tela operacional misture catálogos de clientes distintos.

8. **Histórico de status na extensão**:
   - Nunca inserir diretamente em `lead_status_history`. A migration 26 cria o evento no mesmo `INSERT`/`UPDATE` do lead e a RLS bloqueia gravações manuais.
   - Se a extensão antiga mostrar “Erro de conexão” logo após salvar, confira primeiro se o lead foi criado: a falha pode ser somente o POST manual de histórico. Aplicar a migration 33 absorve esse POST redundante; distribuir a v1.0.2 remove a chamada na origem.

9. **Tenant em inserts operacionais**:
   - Aplicar a migration 32 antes de testar a v1.0.2 em produção. Ela mantém clientes legados compatíveis e garante que o tenant venha do usuário autenticado/lead pai, nunca de um valor confiado do navegador.

---

## 📋 Lista de Tarefas & Próximos Passos (Backlog Ativo)

- [x] Organizar migrations para `database/migrations/`.
- [x] Criar suíte completa de documentação (`CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `DATABASE.md`, `DEPLOY.md`).
- [x] Criar script de inspeção do DOM em `crm-extension/tools/leitor-eventos.js`.
- [x] Criar protocolo de regras de IA em `AGENTS.md`.
- [x] Otimizar telemetria de logs: poda de `INFO` desnecessários, remoção do `debug_mode` e script `12_remove_debug_mode.sql`.
- [x] Redesign do painel `/diagnostico` (hierarquia unificada, Fragment keys e botão Copiar Erro).
- [x] Correção de flicker na alternância de abas (`BrandingContext`) e descolamento de filtros na telemetria.
- [x] Overhaul de UI / Design System:
  - Aumento da escala global para `17.5px` e contraste de canvas (`#f1f5f9`).
  - **Escala da Interface Fixada em 105%**:
    - Ajustado `font-size: 16.8px` no `index.css` de forma fixa, proporcionando a densidade visual e proporção ideais em todas as telas sem botões extras de seleção.
  - **Sidebar Lateral Mais Compacta**:
    - Altura da logo/banner reduzida pela metade (`h-12` / 48px com `object-contain`), deixando a navegação mais alta e os itens de menu em maior destaque.
  - **Nova Top Header Bar Inspirada na Referência**:
    - Campo de busca global à esquerda (`Search Anything / ⌘K`).
    - Ícone de **Suporte técnico** com popover de contato WhatsApp e diagnóstico.
    - Sino de **Notificação de Follow-ups** com indicador de alerta vermelho e contagem.
    - Divisor vertical elegante.
    - **Pílula de Perfil**: Saudação `"Olá, [Nome]"`, avatar e dropdown com atalhos de Configurações, Diagnóstico e Logout (com remoção completa do card de perfil no rodapé da Sidebar lateral).
  - Componentes gráficos e flutuantes 100% customizados (0 seletores nativos no projeto):
    - `CustomCalendar.tsx`: Calendário interativo visual com navegação de mês/ano, grid de 42 células e seleção de intervalo/data única.
    - `CustomDatePicker.tsx` & `CustomDateRangePicker.tsx`: Seletores com presets rápidos e grade gráfica.
    - `CustomTimePicker.tsx`: Seletor de horários interativo com coluna de horas, minutos (step 5), atalhos rápidos, botão "Agora" e detecção de abertura vertical inteligente para cima/baixo (`openUp`), evitando corte na borda inferior da tela.
    - `CustomSelect.tsx`: Popovers flutuantes com dots de status, ícones e auto-posicionamento anti-overflow.
  - Tabela com linhas de grade nítidas estilo Excel/planilha e zebra striping em `/leads` e `/followups`.
  - **Edição Completa de Follow-ups**:
    - Possibilidade de editar (tipo, status, data com `CustomDatePicker`, hora com `CustomTimePicker` e descrição) e excluir atividades tanto na página `/followups` quanto dentro da aba *Follow-ups* do `LeadDrawer`.
  - **Automação de Tarefas no Kanban (`PipelineColumn.tsx` & `AutomationModal.tsx`)**:
    - Restaurado o ícone de engrenagem (`Settings`) no cabeçalho de cada coluna do Kanban em `/leads`, abrindo modal centralizado na tela para configurar regras de criação de follow-ups automáticos (tipo de atividade, prazo em dias e descrição padrão).
  - **Página & Menu Exclusivo "Clientes" (`/clientes`, `Clientes.tsx`, `ClientModal.tsx`)**:
    - Menu dedicado na barra lateral para administradores com ícone `Building2`.
    - **Painel de Controle Comercial**: Métricas consolidadas no topo (Total de Empresas, MRR em R$, Assentos em Uso e Total de Leads).
    - **Tabela Completa de Assinaturas**: Razão Social / Nome Fantasia, Plano contratado, Status com dot, Vigência com contagem de dias restantes, Barras de progresso de Assentos e Leads, Mensalidade e botão direto de gestão.
    - **Modal Completo de Criação / Edição**: Permite cadastrar novos clientes e editar empresas existentes (razão social, nome fantasia, pacote comercial, cotas, datas com atalhos de +30d/+90d/+180d/+1ano e valor cobrado).
    - **Design System 100% aderente**: Fundo Slate, verde institucional `emerald-600`, cantos `rounded-xl`/`rounded-lg` e skeleton 1:1 (`ClientesSkeleton.tsx`).
  - **Arquitetura de Configurações em Cards Visuais (Opção A + Grid de Cards)**:
    - Página `/configuracoes` reformulada:
    - **Navegação em 3 Abas Principais + Grid Panorâmico Comercial (`Configuracoes.tsx`)**:
      - **Aba 1: Regras Comerciais & Funil**: Exibe uma **visão panorâmica de 3 colunas em modo lista limpo (`divide-y`)** com **modais contextuais que abrem no centro de cada coluna específica** (`absolute inset-0 backdrop-blur-xs`) tanto para criação quanto para **edição completa**:
        - *Coluna 1 (Status do Pipeline)*: **Reordenação Drag & Drop idêntica à de `/leads`** via `@dnd-kit` (com grip handle, animação suave e persistência de `ordem` no Supabase); botão `+ Nova Etapa` / clique no botão de edição `Pencil` ou no item abre modal contextual para criar ou **editar nome e cor** com prévia em tempo real; controles de ativação e exclusão com proteção de integridade.
        - *Coluna 2 (Origens de Leads)*: Botão `+ Nova Origem` / clique no botão de edição `Pencil` ou no item abre modal contextual para criar ou **editar nome do canal**; lista contínua com toggle direto e exclusão.
        - *Coluna 3 (Segmentos de Leads)*: Botão `+ Novo Segmento` / clique no botão de edição `Pencil` ou no item abre modal contextual para criar ou **editar nome do nicho**; lista contínua com toggle direto e exclusão.
      - **Aba 2: Equipe & Acessos**:
        - *Lado Esquerdo*: **Meu Perfil & Segurança Unificados** (Meus Dados de Identificação + Alteração de Senha com confirmação de senha atual em um único card coeso e visual limpo).
        - *Lado Direito*: **Gestão da Equipe & Liberação de Acessos** (Lista de membros da organização, aprovação de novos cadastros com botão de 1 clique, alteração de cargos e departamentos).
      - **Aba 2 (Para Não-Administradores - Usuário Comum)**:
        - **Layout em 2 Colunas Balanceadas**: Unificação de *Meu Perfil* com *Identificação da Empresa* na Coluna 1 (Esquerda) e *Alterar Minha Senha* na Coluna 2 (Direita), ocultando a aba avulsa de Empresa.
      - **Aba 3: Empresa**: Identificação e Nome de Exibição da Organização (visível para Administradores).
  - **Configurações & Regras Comerciais (`Configuracoes.tsx`)**:
    - **Proteção do Funil Base de Sistema (ADR-010)**: As etapas essenciais do funil padrão (`novo`, `novo_lead`, `em_atendimento`, `proposta_enviada`, `fechado`, `perdido`) agora são permanentemente protegidas contra exclusão ou desativação. Na listagem de etapas, exibem o badge `🔒 Sistema`, o botão de toggle de desativação fica bloqueado e o botão de exclusão (`Trash2`) é substituído por um ícone de cadeado (`Lock`) com aviso explicativo. O usuário mantém a liberdade de renomear o nome exibido, trocar cores e reordenar a posição no Kanban.
  - **Layout & Navegação Global (`Layout.tsx` & `AuthContext.tsx`)**:
    - **Menu Lateral com Seleção Sólida**: O menu ativo agora utiliza **verde corporativo sólido** (`bg-brand-600 text-white font-bold shadow-xs border border-brand-700/60`) com ícone e texto brancos, eliminando o fundo verde claro pastel desbotado.
    - **Altura e Ergonomia Aumentada da Sidebar**: Links de navegação ampliados para `py-3 px-3.5` e `space-y-1.5` com cantos `rounded-lg` (área de clique confortável de ~48px).
    - **Padronização Global de Cantos (Menos Arredondados)**: Eliminados os formatos `rounded-2xl` / `rounded-3xl` em prol de **`rounded-xl`** (12px) em cards/modais e **`rounded-lg`** (8px) em botões e inputs em todo o sistema (*Dashboard*, *Leads*, *Follow-ups*, *Configurações*, *Login*, *Modais*).
    - **Eliminação de Flicker/Piscar no Menu "Diagnóstico"**: Migrado o perfil do usuário para o `AuthContext` global, consumido instantaneamente no primeiro render sem layout shift.
    - **Alinhamento Proporcional da Barra Superior (h-[72px] / 72px)**: O container do topo na sidebar e a Top Header Bar (busca, suporte, notificações e perfil) possuem **`h-[72px]`**. O card interno de branding/logo possui **`h-14` (56px)**, tendo destaque e presença visual superior em relação aos botões do menu lateral (~44px), conferindo destaque hierárquico ao logo e alinhamento contínuo com o header.
    - **Top Header Fixo Permanente**: O header do CRM é `sticky top-0 z-30 bg-white/95 backdrop-blur-md`, com remoção de `overflow-x-hidden` do container-pai para garantir ancoragem confiável no scroll.
    - **Contato de Suporte Configurado**: Botão de suporte no cabeçalho direciona diretamente para o WhatsApp **`5515992568868`** com a mensagem *"Olá, preciso de suporte no Connect CRM"*.
    - **Manual de Design System Criado (`docs/DESIGN.md`) & Padronização Global**:
      - Criado o arquivo canônico [`docs/DESIGN.md`](docs/DESIGN.md) documentando paleta de cores, hierarquia de botões (Primário, Secundário, Destrutivo), inputs, modais e badges de status.
      - **`CustomSelect.tsx` Neutro**: Eliminada a borda e fundo verde-água artificial ao selecionar itens; agora usa fundo branco e borda cinza neutra (`bg-white border-slate-200 text-slate-800`).
      - **Eliminação de Tons Verde-Água / Menta em Disabled**: Substituído `disabled:bg-emerald-300` por estado desabilitado neutro padrão (`disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed`).
      - **Universalidade de Ícones em Botões**: Todos os botões de submit e ações em modais (`Configuracoes`, `LeadDrawer`, `Leads`, `FollowUps`, `ImportLeadsModal`, `ConfirmModal`) agora contam com ícones contextuais do Lucide (`Plus`, `Check`, `Save`, `Trash2`, `X`, `Upload`, etc.).
      - **`StatusBadge.tsx` Sólido**: Badges de status com fundo sólido vibrante e texto branco (`px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs`).
    - **Atualização Granular e Validação de Alterações (Dirty State) em `/configuracoes`**:
      - Eliminado o `loadAll()` com `loading = true` ao salvar/excluir Origens ou Segmentos. As 3 colunas não recarregam mais nem piscam ao salvar; a atualização é local e granular (`reloadSources` / `reloadSegments`).
      - O botão **"Salvar Alterações"** nos modais de Status, Origem e Segmento agora permanece **desabilitado** (`disabled`) até que o usuário faça uma alteração real no formulário (`isDirty`).
    - **Sub-Header Fixo na Página `/leads` (Lista e Pipeline)**: Na rota `/leads`, o cabeçalho de controle (Título, Contador, Toggle `Lista`/`Pipeline`, Botão de Ações e a Barra de Filtros) agora é **`sticky top-[72px] z-20`**, permanecendo sempre visível no topo da tela tanto na rolagem da lista quanto do quadro de pipeline. Além disso, o `<thead className="sticky top-0">` da tabela mantém os cabeçalhos das colunas visíveis.
    - **Design das Colunas do Pipeline (Header Sólido + Fundo Claro)**:
      - O cabeçalho de cada coluna utiliza **cor sólida vibrante** (`statusCfg.color_dot`), com texto branco, contador de leads translúcido e ícone de automação.
      - A sub-barra exibe o resumo de valores financeiros da etapa de forma destacada.
      - O corpo da coluna (onde ficam os cards de leads) utiliza o **mesmo tom em versão suave e clara** (`statusCfg.color_bg`), criando contraste com os cards brancos (`bg-white shadow-card rounded-xl`).
      - Altura das colunas calibrada à tela (`h-[calc(100vh-220px)]`), garantindo que os cabeçalhos nunca sumam.
  - **Dashboard Principal (`Dashboard.tsx`)**:
    - **Alinhamento Perfeito de Headers (h-12 / 48px)**: Todos os 4 cards principais (*Atividade & Funil*, *Valores & Resultados*, *Leads Recentes*, *Por Origem*) agora possuem exatamente a mesma altura de cabeçalho (`h-12 px-5 flex items-center justify-between`), eliminando qualquer diferença milimétrica de altura entre colunas.
    - **Tipografia Limpa em Title Case**: Os títulos das métricas financeiras (*Em Negociação*, *Vendas Fechadas*, *Taxa de Conversão*) foram convertidos de caixa alta (uppercase) para Title Case natural e elegante.
    - **Remoção de Efeitos Hover nos Ícones**: Eliminada qualquer animação de ampliação/zoom (`group-hover:scale-105`) nos ícones de métricas, mantendo a interface estática, sólida e executiva.
    - **Harmonização de Ícones Temáticos**:
      - **Atividade & Funil**: Todos os ícones internos (*Total de Leads*, *Novos Hoje*, *Follow-ups*, *Em Negociação*, *Finalizados*) possuem badge sólido **preto** (`bg-slate-900 text-white`).
      - **Valores & Resultados**: Todos os ícones internos (*Em Negociação*, *Vendas Fechadas*, *Taxa de Conversão*) possuem badge sólido **verde** (`bg-emerald-600 text-white`).
    - **Remoção do Card 'Tarefas de Hoje'**: O card redundante de tarefas de hoje foi removido do dashboard inferior.
    - **Grade Inferior 2:1 Equilibrada**: A seção inferior agora organiza perfeitamente **Leads Recentes (2/3 de largura)** e **Por Origem (1/3 de largura)**, alinhando visualmente com a grade 2:1 do bloco superior.
    - **Paleta Minimalista e Executiva**: Com a saída do header âmbar do card de tarefas, o dashboard passou a utilizar apenas 2 cores corporativas elegantes nos cabeçalhos (`bg-slate-900` institucional e `bg-emerald-900` financeiro).
    - **Filtro Padrão 'Hoje'**: Ao acessar a página, o período inicial selecionado é agora **Hoje** por padrão.
    - **Paleta Minimalista de 3 Cores Corporativas & Cabeçalhos Tipográficos Limpos**:
      - Eliminados os ícones repetitivos dos cabeçalhos dos cards principais para uma estética ultra-limpa e tipográfica.
      - Paleta enxuta de no máximo 3 cores executivas:
        - **Slate 900** (`bg-slate-900 text-white`): Base institucional em *Atividade & Funil*, *Leads Recentes* e *Por Origem*.
        - **Emerald 900** (`bg-emerald-900 text-white`): Exclusivo para *Valores & Resultados* (financeiro).
        - **Amber 600** (`bg-amber-600 text-white`): Exclusivo para *Tarefas de Hoje* (ação/urgência).
    - **Linhas Divisórias e Bordas Nítidas (`divide-slate-200` / `border-slate-200`)**: Substituídas as divisórias pálidas (`divide-slate-100`) por linhas sólidas e visíveis em todos os cards filhos e listagens (Leads Recentes, Tarefas de Hoje, Follow-ups, Funil Ativo e Valores), proporcionando excelente definição geométrica.
    - **Taxa de Conversão Integrada no Bloco 2**: Reside na 3ª célula de resultado (junto com Volume R$ e Vendas Fechadas R$), alinhando com perfeição a altura dos blocos superiores.
    - **Pipeline Ativo Universal ("Em Negociação") (ADR-010)**: Métrica consolidada dinâmica (`status NOT IN ('fechado', 'perdido')`).
    - **Grid Inferior Integrado de 3 Colunas**: Tarefas de Hoje (com WhatsApp direto) | Leads Recentes | Por Origem.
  - **Página de Leads (`Leads.tsx`)**:
    - **Menu Unificado de Ações (3 Pontos)**: Substituição dos botões soltos ("Exportar", "Importar", "Organizar colunas", "Novo lead") por um menu compacto e moderno de 3 pontos (`MoreVertical`), contendo as opções **Novo Lead**, **Importar** e **Exportar** (com contador de selecionados).
    - **Remoção de "Organizar colunas"**: Removido da página de leads para manter foco visual, visto que a ordenação e personalização do funil agora residem de forma definitiva na aba **Configurações > Regras Comerciais & Funil**.
  - **Módulo de Follow-ups & Atividades (`FollowUps.tsx`, `helpers.ts`, `leadFollowup.ts`)**:
    - **Detecção Precisa de Atrasos (Data + Hora)**: A função `isOverdue` agora valida data e horário (`hora_agendada`). Atividades de hoje cujo horário já passou são corretamente categorizadas e contabilizadas como **Atrasadas** com badges vermelhos e chips de alerta em tempo real.
    - **Correção de Plural/Status de Concluídos**: O card "Concluídos" agora exibe o texto correto `X atividades concluídas`.
  - **Gestão de Equipe & Liberação de Acessos para Administradores (`Configuracoes.tsx`)**:
    - **Visão do Administrador**:
      - A aba de configurações exibe **"Usuários & Perfil"**.
      - Seção dedicada de **"Gestão da Equipe & Liberação de Acessos"** listando todos os membros da organização.
      - Botão verde em destaque **`Liberar Acesso`** (`CheckCircle2`) para aprovar instantaneamente novos cadastros pendentes ou inativos.
      - Controle completo de **Departamento** e **Permissão** (Administrador vs Atendente) por colaborador.
    - **Visão do Atendente**:
      - Acesso restrito apenas ao card de **"Meu Perfil"** e **"Alterar Minha Senha"**.
  - **Favicon do CRM (`favicon.svg`)**:
    - Favicon da aplicação web atualizado para `favicon.svg` em `index.html` e `privacidade.html`.
  - **Tela de Autenticação Centralizada com Alturas Individuais por Aba (`Login.tsx`)**:
    - Card único centralizado (`max-w-[430px]`), com altura dinâmica e individual para cada aba.
    - Cabeçalho com título e descrição alinhados à esquerda: `Connect CRM` + `Gestão de leads integrada ao seu WhatsApp Web.`.
    - Rodapé limpo: `© 2026 Connect CRM`.
    - Aba *Entrar*: Formato compacto e enxuto.
    - Aba *Criar Conta*: Expande confortavelmente para acomodar todos os campos de cadastro com transição suave.
    - Suporte a todos os campos de identificação: Nome completo, Nome da Empresa, E-mail, Departamento e Senha com confirmação.
  - **Gestão de Departamentos (`13_profile_departamento.sql`)**:
    - Departamentos cadastrados: Comercial, Atendimento ao Cliente, SDR / Pré-vendas, Financeiro e Gestão / Diretoria.
    - Selecionável no cadastro (`Login.tsx`) e gerenciável pelo admin em `Configuracoes.tsx`.
    - Badges coloridos no perfil do usuário e na listagem de equipe.
  - **Skeletons 1:1 de Alta Fidelidade e Transições em Efeito Cascata (ADR-012)**:
    - Criados componentes de Skeleton dedicados em `src/components/skeletons/`:
      - `DashboardSkeleton.tsx`: 8 KPI cards, gráficos de funil/origens e listas.
      - `PipelineSkeleton.tsx`: 5 colunas de Kanban com cabeçalhos e cartões de leads com avatar, tags e valores.
      - `LeadTableSkeleton.tsx`: Linhas de planilha com checkbox, avatar, tags e valores.
      - `LeadDrawerSkeleton.tsx`: Cabeçalho, abas e formulário em 2 colunas.
      - `ConfiguracoesSkeleton.tsx`: 3 colunas de regras comerciais e membros de equipe.
  - **Remoção da Tela e Funções de Diagnóstico (`/diagnostico`)**:
    - Removidos completamente: `Diagnostico.tsx`, `DiagnosticoSkeleton.tsx`, links de menu no `Layout.tsx`, rota no `App.tsx` e tipo `ExtensionLog` em `types/index.ts`, sem nenhum resíduo no código do painel web.
- [x] Migration 32 aplicada no Supabase de produção e criação de lead confirmada em teste de campo.
- [ ] Aplicar a migration 33 no Supabase de produção para compatibilidade com a extensão antiga instalada.
- [ ] Recarregar/distribuir a extensão Chrome v1.0.2 e validar em campo a criação e a atualização de um lead pelo WhatsApp Web.
- [ ] Avaliar implementação de disparo de mensagens pré-formatadas diretamente da sidebar (Templates / Quick Replies).

### 29/08/2026 — Conta individual por empresa

- A aba `/configuracoes?tab=usuarios` foi renomeada para **Minha Conta**. A tela não exibe controles de equipe, liberação ou bloqueio de colaboradores.
- O cartão de plano foi alinhado ao `docs/DESIGN.md`: superfície clara, badge de status sólido, consumo apenas de leads e canal de suporte oficial. Esta mudança não altera dados de clientes nem permissões.
- Em **Clientes & Assinaturas**, foram removidos a coluna, o indicador e o visualizador de colaboradores. O status e a receita recorrente agora consideram a vigência real do plano; uma assinatura vencida não é apresentada nem liberada como ativa.
- A contagem de leads em Clientes & Assinaturas passou a usar uma RPC agregada exclusiva de superadmin. A RLS de `leads` continua sem acesso global: a tela recebe somente totais por organização, nunca dados de leads de outras empresas.
- O cadastro autônomo agora exige WhatsApp principal da empresa e o persiste em `organizations.responsavel_telefone`, junto ao nome e e-mail de contato. Registros existentes não são modificados.
- Clientes & Assinaturas oferece **Liberar conta** somente quando a organização possui exatamente um perfil inicial inativo e a assinatura permite acesso. Organizações legadas com mais de um perfil exigem revisão manual.
- Cadastro autônomo não solicita departamento; novos perfis mantêm o padrão interno `comercial`. Em Configurações, todo titular visualiza o próprio plano, consumo de leads e vigência, e pode atualizar o nome da própria empresa sem acessar ou alterar dados do plano.
- A aba de configurações foi padronizada como **Minha Conta & Planos** para administrador e clientes: perfil, informações da empresa e assinatura usam os mesmos cartões; só o SuperAdmin tem a ação extra de gerenciar o plano.

### 01/09/2026 — Correção de titularidade para Costuras Finas

- A auditoria da conta `comercial@4uconnect.com.br` isolou **106 leads sem autoria registrada** (sem autor no histórico de status ou em atividades). A responsável comercial confirmou que eles não pertencem ao tenant comercial e indicou `julia@gmail.com` (organização **Costuras Finas**) como destino.
- A operação histórica `database/operations/archive/31_transfer_unattributed_leads_to_julia.sql` foi aplicada em produção: valida o lote exato antes da transferência, preserva `created_at` e `updated_at` dos leads e realocou os 137 eventos de status sem autor. A validação posterior confirmou 0 candidatos na origem, 106 leads na organização Costuras Finas, 137 eventos no destino e 0 eventos residuais na origem. Não há notas ou atividades vinculadas a esses leads; os 548 registros restantes da conta comercial não foram tocados.

### 04/09/2026 — Exclusão auditada de Julia e Conta Teste

- A operação histórica `database/operations/archive/34_safely_delete_julia_and_teste_accounts.sql` foi aplicada no Supabase de produção após auditoria e dry-run. Foram removidas as contas Auth `julia@gmail.com` e `teste@gmail.com`, seus 2 perfis e as organizações **Costuras Finas** e **Conta Teste**.
- O escopo excluído continha 106 leads, todos exclusivamente da Costuras Finas, 138 eventos de histórico de status, 14 status, 20 origens e 28 segmentos. Não havia atividades, notas, objetos no Storage, logs da extensão ou referências na auditoria de recuperação vinculadas às contas.
- As travas da migration validaram os UUIDs imutáveis, a quantidade exata de membros e registros, a ausência de vínculos cruzados e as contagens externas antes/depois. A verificação independente posterior retornou zero para usuários Auth, identidades, sessões, refresh tokens, perfis, organizações, leads, filhos, catálogos, auditoria e Storage dos UUIDs removidos.
- **Gotcha:** não reutilizar `database/operations/archive/17_delete_test_accounts.sql` em produção. O script antigo seleciona contas apenas por e-mail e pode excluir notas/atividades por autoria sem limitar a organização. Para exclusões pontuais, usar UUIDs auditados, abortar diante de qualquer vínculo externo e validar o resultado em consulta separada.
- Tokens JWT já emitidos podem permanecer criptograficamente válidos até o `exp`, porém as sessões e refresh tokens foram removidos e a ausência do perfil faz as políticas/funções de autorização do CRM negarem acesso aos dados.

### 04/09/2026 — Preparação segura para versionamento

- Migrations de schema foram separadas de operações pontuais e destrutivas conforme a ADR-025. Os identificadores 17, 20 e 31 permanecem como lacunas intencionais para preservar rastreabilidade.
- A migration 25 agora cria apenas `lead_ownership_recovery_audit` e sua RLS; a movimentação histórica dos 220 leads foi arquivada como operação manual.
- O build de produção, que inicialmente falhava por imports sem uso e incompatibilidade no tipo de status de atividades, foi corrigido e aprovado. O lint terminou sem erros, mantendo 15 avisos preexistentes de `any` explícito.
- `npm audit fix` atualizou o React Router de 7.17.0 para 7.18.3 no lockfile e a auditoria retornou zero vulnerabilidades. O requisito do runtime foi documentado e fixado em Node.js 20.19+ ou 22.12+.
- A extensão passou na validação sintática de todos os JavaScripts e do `manifest.json`; o domínio `connect-crm.vercel.app` está sincronizado nos três pontos obrigatórios e os dois aliases Vercel responderam HTTP 200.
- O bundle principal continua grande (aproximadamente 1,35 MB minificado / 380 KB gzip). É um risco de desempenho, não de quebra funcional, e pode ser reduzido depois com code splitting.
