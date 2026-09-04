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

Usar na extensão controles próprios de listbox e calendário que reproduzem os
tokens dos componentes `CustomSelect`, `CustomDatePicker` e `CustomCalendar` do
CRM Web. Os valores continuam espelhados em controles nativos ocultos com os IDs
anteriores, preservando a integração com o estado e as rotinas de salvamento já
existentes. As abas seguem o padrão sublinhado usado no drawer de leads do CRM.

### Consequências

- Listboxes, calendário e abas mantêm a mesma linguagem de cor, tipografia,
  espaçamento, bordas, sombras e estados ativos do CRM Web.
- O calendário oferece navegação mensal e ações **Limpar** e **Hoje** sem depender
  do seletor nativo do navegador.
- Mudanças futuras nesses componentes do CRM Web devem ser refletidas também em
  `crm-extension/content.js` e `crm-extension/sidebar.css`.
