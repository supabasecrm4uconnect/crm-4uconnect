# Decisões de arquitetura e design

## ADR-001 — Sidebar sobre o drawer nativo do WhatsApp

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

Ao salvar um lead, a extensão abre e preenche o formulário nativo de contato do
WhatsApp Web. Recolher automaticamente a sidebar expõe essa automação ao usuário
e causa uma mudança visual desnecessária durante o salvamento.

### Decisão

A sidebar do Connect CRM permanece aberta, com a camada visual máxima do Chrome,
acima dos drawers nativos do WhatsApp. O recolhimento passa a ser exclusivamente
manual pelo botão lateral.

### Consequências

- A automação de cadastro fica visualmente coberta pela extensão.
- O fluxo funcional e os seletores do formulário nativo permanecem inalterados.
- Para acessar um drawer do WhatsApp enquanto a sidebar estiver aberta, o usuário
  deve recolher o CRM manualmente.

## ADR-002 — Compatibilidade da sessão com os dois aliases do CRM

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

O painel de produção responde por `crm-4uconnect.vercel.app` e
`connect-crm.vercel.app`. A ponte de sessão da extensão estava autorizada apenas
no primeiro endereço, enquanto o acesso atual ocorre pelo segundo.

### Decisão

Manter os dois aliases explicitamente autorizados em `manifest.json` e
`background.js`, usando `connect-crm.vercel.app` como destino principal dos links
da extensão. Não será usado um curinga `*.vercel.app`.

### Consequências

- Usuários autenticados em qualquer um dos aliases podem sincronizar a sessão.
- Sites Vercel não relacionados continuam impedidos de gravar ou limpar a sessão.
- Toda futura mudança de domínio deve atualizar conjuntamente `manifest.json`,
  `background.js` e `content.js`.

## ADR-003 — Mensagem única durante o salvamento completo

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

O cadastro envolve duas operações sequenciais: gravar o lead no CRM e salvar o
contato pelo formulário nativo do WhatsApp. Exibir as etapas internas tornaria a
interface mais técnica e revelaria a automação que a sidebar deve cobrir.

### Decisão

Exibir um único overlay bloqueante com spinner e a mensagem **Salvando lead...**
durante as duas operações. A interface só retorna quando a automação do WhatsApp
terminar ou quando ocorrer uma falha na gravação do CRM. O overlay reutiliza a
linguagem visual dos modais do CRM Web: backdrop `slate-950/40`, cartão branco
`rounded-xl`, borda `slate-200`, sombra `shadow-xl`, superfície `slate-50/60` e
destaque esmeralda.

### Consequências

- O usuário recebe retorno imediato após o clique sem acompanhar detalhes internos.
- O drawer nativo permanece coberto durante todo o fluxo.
- O tempo visível da mensagem inclui também a sincronização do contato.

## ADR-004 — Controles de formulário compartilhando a linguagem visual do CRM

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

Os menus de um `select` nativo e o calendário de um `input type="date"` são
renderizados pelo Chrome e pelo sistema operacional. Por isso, esses elementos
mantinham aparência diferente dos componentes personalizados usados pelo CRM Web,
mesmo quando o campo fechado recebia CSS semelhante.

### Decisão

Usar na extensão controles próprios de listbox, calendário e horário que
reproduzem os tokens dos componentes `CustomSelect`, `CustomDatePicker`,
`CustomCalendar` e `CustomTimePicker` do CRM Web. Os valores continuam espelhados
em controles nativos ocultos com os IDs anteriores, preservando a integração com
o estado e as rotinas de salvamento já existentes. As abas seguem o padrão
sublinhado usado no drawer de leads do CRM.

### Consequências

- Listboxes, calendário, seletor de horário e abas mantêm a mesma linguagem de
  cor, tipografia, espaçamento, bordas, sombras e estados ativos do CRM Web.
- As opções dos listboxes exibem os ícones equivalentes aos usados no CRM;
  opções de status preservam os indicadores de cor.
- Listboxes longos mantêm altura máxima de 240px e rolagem vertical, sem reduzir
  a altura individual das opções.
- Menus com mais de cinco opções já abrem em modo rolável, reservando espaço para
  uma barra sempre visível com trilho `slate-100` e indicador esmeralda; as
  colunas de hora e minuto aplicam o mesmo comportamento.
- O calendário oferece navegação mensal e ações **Limpar** e **Hoje** sem depender
  do seletor nativo do navegador.
- O horário oferece colunas de hora/minuto, ação **Agora**, atalhos e confirmação,
  sem depender do seletor nativo do navegador.
- Mudanças futuras nesses componentes do CRM Web devem ser refletidas também em
  `crm-extension/content.js` e `crm-extension/sidebar.css`.
- Como a animação de entrada dos campos usa `transform`, o campo que contém um
  popover aberto recebe uma camada elevada própria; elevar somente o menu não é
  suficiente para superar os contextos de empilhamento dos campos seguintes.

## ADR-005 — Título da extensão sincronizado pelo CRM Web

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

O CRM Web monta o título a partir do nome do produto e da organização associada
ao perfil logado. A extensão repetia parcialmente essa regra e buscava
`organizations?limit=1`; para superadministradores, que podem visualizar mais de
uma organização, a consulta podia selecionar outra empresa e mostrar um título
diferente do CRM.

### Decisão

O `session-bridge.js` passa a sincronizar também o `document.title` mantido pelo
`BrandingContext` do CRM Web. A extensão usa esse `app_title` como fonte
principal. Como fallback, resolve primeiro o `organization_id` do perfil logado
e busca somente essa organização, reproduzindo o fluxo do CRM.

### Consequências

- O cabeçalho da extensão acompanha exatamente o título exibido pelo CRM Web,
  inclusive mudanças de branding sem renovação do token.
- Superadministradores não recebem mais o nome de uma organização arbitrária.
- Sessões antigas sem `app_title` continuam funcionando por meio da consulta de
  fallback vinculada ao perfil.

## ADR-006 — Salvamento contextual e validação local no formulário da extensão

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

O formulário de um lead existente exibia a ação de salvar mesmo quando nenhum
campo havia mudado. Além disso, a sincronização do nome com o contato nativo do
WhatsApp acontecia sem o overlay usado na criação, enquanto Valor e Observação
aceitavam entradas sem limites adequados à interface compacta da extensão.

### Decisão

Comparar o formulário com o lead carregado usando valores normalizados. O botão
**Salvar alterações** só é exibido quando nome, status, origem, segmento, valor,
observação ou tags realmente diferem da referência original. Valores monetários
são higienizados no navegador, aceitando apenas dígitos e separador decimal,
limitando a parte inteira a seis dígitos e continuando a ser convertidos para o
mesmo número enviado à coluna `valor`.

Limitar novas entradas no campo Observação a 500 caracteres, com contador
visível. Observações antigas acima do limite não são truncadas apenas por serem
carregadas. Quando o nome mudar, manter o overlay **Salvando lead...** até o fim
da gravação no CRM e da tentativa de sincronização com o WhatsApp. As três abas
passam a dividir igualmente toda a largura disponível.

### Consequências

- Saves redundantes deixam de ser oferecidos ao usuário e o botão reaparece
  imediatamente se houver uma alteração real.
- Formatos monetários equivalentes não geram falso estado de alteração.
- O maior valor digitável pela extensão é `999999,99`; a regra vale também para
  conteúdo colado e não modifica automaticamente valores antigos apenas carregados.
- A validação é exclusivamente de frontend: não há migration nem mudança de
  tabela, coluna, tipo, RLS ou payload da API.
- Falha apenas na sincronização do WhatsApp é diferenciada de falha na gravação
  do CRM, evitando informar que dados já persistidos foram perdidos.
- O botão de criação de um contato ainda não cadastrado permanece visível, pois
  salvar o novo lead é a ação principal desse estado.
