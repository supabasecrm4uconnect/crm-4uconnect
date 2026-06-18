# WhatsApp Web — DOM & Event Reference

Referência viva de seletores, estrutura DOM e comportamentos confirmados via spy de eventos.  
Atualizar sempre que um seletor for descoberto, corrigido ou removido.

---

## Estrutura de uma linha da lista de conversas

Hierarquia completa confirmada via spy de eventos (2026-06-11):

```
div[aria-label="Lista de conversas"][role="grid"]           ← container da lista inteira
  └── div[data-testid="list-item-N"][role="row"]            ← COMPONENTE REACT da linha (N=0,1,2...)
       └── div[role="gridcell", class="x1n2onr6", tabindex="0"]
            └── div[tabindex="0", aria-selected="true/false"]
                 └── div[data-testid="cell-frame-container"]   ← frame da conversa
                      └── div[role="gridcell", aria-colindex="2"]
                           └── div[data-testid="cell-frame-title"]  ← nome ou número do contato
                                └── text node: "Nome" ou "+55 11 9999-9999"
                                └── [icons como ic-label-filled, etc.]
                      └── div (sem testid)                    ← área de última mensagem
                           └── div[data-testid="cell-frame-secondary"]
```

### Seletores confirmados
| Elemento | Seletor |
|---|---|
| Container da lista | `div[aria-label="Lista de conversas"][role="grid"]` |
| Componente React da linha | `[data-testid^="list-item-"]` (N=0,1,2...) |
| Frame da conversa | `[data-testid="cell-frame-container"]` |
| Nome/número do contato | `[data-testid="cell-frame-title"]` |
| Última mensagem | `[data-testid="cell-frame-secondary"]` |
| Status da última mensagem | `[data-testid="last-msg-status"]` |

### Notas importantes
- `cell-frame-title` é uma `<div>`, não `<span>`
- **`list-item-N` é o ponto ótimo para o fiber walk** — ele é o componente React real da linha, com `props.chat` acessível em ~30-60 níveis `.return`, vs 80-100+ a partir de `cell-frame-container`
- **`span[dir="auto"]` dentro de `cell-frame-title`** é a fonte mais confiável para o nome/número do contato:
  - O atributo `title` contém o texto puro (ex: `"Carina"` ou `"+55 86 9418-1343"`)
  - Usar `span[dir="auto"]` evita o problema de ícones como `ic-label-filled` que ficam concatenados no `textContent` total
  - Tanto contatos salvos (nome) quanto não salvos (número) usam essa estrutura
- Contatos **não salvos**: `span[dir="auto"]` tem o número formatado "+55 XX XXXXX-XXXX"
- Contatos **salvos**: `span[dir="auto"]` tem o nome. O número é extraído via fiber walk a partir de `list-item-N`
- Virtual scrolling: apenas as linhas visíveis têm DOM — ao rolar, linhas novas aparecem e precisam ser anotadas

---

## Cabeçalho da conversa aberta

```
#main header
  └── [data-testid="conversation-info-header"]   role="button"
       └── span[data-testid="conversation-info-header-chat-title"]
            └── span dir="auto"  ← nome do contato
```

### Seletores confirmados
| Elemento | Seletor |
|---|---|
| Container do header | `#main header` |
| Botão de info | `[data-testid="conversation-info-header"]` |
| Nome no header | `[data-testid="conversation-info-header-chat-title"]` |

---

## Drawer de salvar/editar contato

Aberto quando o usuário clica em "Adicionar contato" ou "Salvar contato".

```
div[data-testid="drawer-right"]                  ← container genérico do painel direito
  └── div[data-testid="save-contact-drawer"]      ← drawer específico de salvar contato
       └── inputs[type="text"] / [contenteditable="true"]  ← campos Nome, Sobrenome etc.
       └── [role="switch"] / input[type="checkbox"]        ← toggle de sincronização
       └── button[aria-label="Salvar contato"]              ← botão Salvar
```

### Botões de navegação do drawer (confirmados via spy)
| Ação | Seletor |
|---|---|
| Fechar (X) | `button[aria-label="Fechar"][data-tab="2"]` |
| Voltar (←) | `button[aria-label="Voltar"][data-tab="2"]` |
| Salvar contato | `[data-testid="save-contact-btn"]` ou `button[aria-label="Salvar contato"]` |

### Painéis que disparam auto-ocultação do sidebar CRM
```
[data-testid="drawer-right"]         ← qualquer painel direito
[data-testid="save-contact-drawer"]  ← Adicionar/Salvar Contato
[data-testid="contact-info-1"]       ← Info do Contato
[data-testid="group-info"]           ← Info do Grupo
[data-testid="profile-view"]         ← Perfil
[data-testid="settings-view"]        ← Configurações
```

---

## React Fiber — extração de dados

O content script roda em "isolated world" e não enxerga `__reactFiber*` nos elementos DOM.  
A solução é usar `inject.js` no "page world" para ler o fiber e retornar os dados via `postMessage`.

### Chave fiber em elementos DOM
```javascript
// Detectar a chave dinamicamente:
var keys = Object.keys(el);
var fiberKey = keys.find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
```

### Prop `chat` no fiber
- Na conversa **aberta** (header): encontrado em ~15 níveis de `.return` a partir de `#main header`
- Na **lista via `cell-frame-container`**: pode estar 80-100+ níveis acima — problemático no carregamento inicial
- Na **lista via `list-item-N`** (ponto ótimo): encontrado em ~30-60 níveis — funciona mesmo antes de qualquer interação do usuário
- A profundidade varia conforme o estado de renderização do React; `list-item-N` é o wrapper direto do componente de linha e resolve o problema de "precisa clicar primeiro"

### Campos do objeto `chat.contact`
| Campo | Descrição |
|---|---|
| `__x_phoneNumber` / `phoneNumber` | Número de telefone |
| `formattedPhone` / `numberPhone` | Número formatado |
| `pushname` / `name` / `formattedName` | Nome do contato |
| `verifiedName` / `businessName` | Nome de negócio |
| `profilePicThumbObj` / `__x_profilePicThumbObj` | Objeto da foto de perfil (ver seção Foto de perfil) |

### Campos do JID (`chat.id` ou `chat.__x_id`)
```javascript
// JID string: "5511999998888@c.us"
// JID object: { user: "5511999998888", server: "c.us", _serialized: "..." }
```
Grupos têm JID com `@g.us`; broadcasts com `@broadcast`.

---

## Regras de matching de leads (telefone e nome)

### 9º dígito brasileiro
Celulares BR existem em duas formas equivalentes — com e sem o 9º dígito:
```
554299981280   (12 dígitos — forma antiga, sem o 9)
5542999981280  (13 dígitos — forma atual, com o 9)
```
O WhatsApp pode reportar qualquer uma das formas (o JID costuma usar a forma em que o
contato foi registrado), e o CRM pode ter armazenado a outra. **Todo indexamento e
busca de telefone deve usar `phoneVariants()`**, que retorna as duas formas.
- Aplica-se apenas a celulares: o dígito inicial do número local é 6-9. Fixos (2-5) não ganham o 9.
- Usado em: `loadLeadsCache` (chaves do cache), `cacheLookupByPhone`, `getLeadByPhone` (query `in.()`), atualização do cache pós-save.

### Normalização de nomes
Nomes no CRM podem ter espaços duplos ou caixa diferente do exibido no WhatsApp
(ex: `"VANESSA  FERREIRA"` no banco vs `"Vanessa Ferreira"` na agenda).
**Comparações de nome devem usar `normalizeName()`**: colapsa espaços múltiplos + lowercase.

---

## Elementos de presença da página (aguardar carregamento)

| Estado | Seletor presente |
|---|---|
| WA carregado (sempre, mesmo sem chat aberto) | `#pane-side` ou `[aria-label="Lista de conversas"]` |
| Chat aberto | `#main` |

⚠️ **Nunca aguardar só por `#main`** para iniciar features da lista: ele só existe com um
chat aberto — em reload sem chat, a espera estoura o timeout inteiro (era a causa do
delay de 15-30s para os badges aparecerem).

---

## Foto de perfil do contato

### Fontes (em ordem de prioridade no inject.js)
1. `chat.contact.profilePicThumbObj` (ou `__x_profilePicThumbObj`) — campos `eurl`, `img`, `imgFull` (e variantes `__x_`)
2. `#main header img` — o `<img>` do avatar no cabeçalho da conversa aberta

### Formatos possíveis do src — e como tratar cada um
| Formato | Características | Tratamento |
|---|---|---|
| `https://pps.whatsapp.net/...` | URL do CDN do WhatsApp. **EXPIRA em semanas** (param `oe=`). CORS bloqueia fetch do content script | background.js faz o fetch (`FETCH_PHOTO`) e converte para base64 |
| `blob:https://web.whatsapp.com/...` | Só acessível dentro da página | inject.js converte para base64 no page world antes do postMessage |
| `data:image/...` | Base64 pronto (raro) | usa direto |

### Regra de persistência
⚠️ **Nunca salvar URL `pps.whatsapp.net` no banco** — ela expira e a foto quebra.
`foto_url` na tabela `leads` só recebe data URI (base64). Fluxo: `resolvePhotoToDataUri()`
no content.js resolve ANTES de criar/atualizar o lead; se a conversão falhar, salva sem foto.

### Notas
- `FileReader` **não existe** em service workers (MV3) — background.js usa `blob.arrayBuffer()` + `btoa` em chunks
- Foto só é capturada com a conversa ABERTA (vem do fiber do header) — leads antigos ganham foto na primeira vez que o chat for aberto com a extensão ativa
- `manifest.json` precisa de `host_permissions` para `https://pps.whatsapp.net/*`
- Guarda de tamanho: data URIs acima de ~150KB são descartados (thumbs normais têm 5-30KB)

---

## Mensagens postMessage entre content.js e inject.js

| Direção | source | type | Descrição |
|---|---|---|---|
| content → inject | `crm4u_cs` | `GET_PHONE` | Solicita dados do contato aberto no header |
| inject → content | `crm4u_inject` | `PHONE_RESULT` | Retorna `{ phone, name, isGroup, photo }` |
| content → inject | `crm4u_cs` | `ANNOTATE_CHATS` | Solicita anotação de `data-crm-phone` nas linhas da lista |
| inject → content | `crm4u_inject` | `ANNOTATE_CHATS_DONE` | Confirma quantas linhas foram anotadas |

---

## Labels do WhatsApp (etiquetas nativas)

```
button[data-testid="label-chat-header-button"]   ← botão de gerenciar labels no header
li[data-testid="label_item_N"]                   ← item de label no dropdown (N = índice)
  └── input[type="checkbox"][aria-checked="true/false"]  ← estado da label
```

---

## Caixa de composição e envio de mensagem

```
#main footer
  └── div[data-testid="compose-box-input"]        ← área de texto principal (contenteditable)
       ou
  └── div[contenteditable="true"][data-tab="10"]  ← alternativa (data-tab varia por versão do WA)
  └── button[data-testid="send"]                  ← botão Enviar
       ou
  └── button[aria-label="Enviar"]                 ← alternativa por aria-label
```

### Seletores confirmados (spy 2026-06-12)
| Elemento | Seletor |
|---|---|
| Caixa de texto (compose) | `div[contenteditable="true"][data-tab="10"]` |
| Botão Enviar | `button[aria-label="Enviar"][data-tab="11"]` |

### Inserção de texto em contenteditable
O campo de composição do WA é um `div[contenteditable]` controlado pelo React.  
O método mais confiável para injetar texto programaticamente (sem sobrescrever o estado interno do React):
```javascript
compose.focus();
compose.innerHTML = '';
document.execCommand('insertText', false, mensagem);  // Nota: API deprecated mas funcional no Chrome
```
`setReactInputValue` funciona apenas para `<input>` — **não** funciona em `div[contenteditable]`.

---

## Fluxo: editar contato já salvo na agenda

Acessado via menu "Mais opções" quando o contato já está na agenda do celular.

```
button[aria-label="Mais opções"][data-tab="6"]          ← botão ⋮ no cabeçalho do chat
  → click → menu aparece
button[aria-label="Dados do contato"][role="menuitem"]   ← opção no menu
  → click → abre [data-testid="contact-info-1"]  ⚠️ NÃO é save-contact-drawer
button[aria-label="Editar"]                              ← lápis dentro de contact-info-1
  → click → painel transiciona para [data-testid="save-contact-drawer"] (modo edição)
[inputs de nome/sobrenome ficam editáveis]
[data-testid="save-contact-btn"]                         ← salvar
div[data-testid="confirm-popup"]                         ← popup opcional (quando contato já existe no celular)
  └── button com textContent "Continuar"                 ← confirmar
```

⚠️ **Ordem dos drawers**: "Dados do contato" → `contact-info-1` primeiro, depois "Editar" → `save-contact-drawer`.  
Aguardar `save-contact-drawer` antes de clicar em "Editar" causa timeout.

### Diferença entre os dois fluxos de contato no WA

| Situação | Menu mostra | Fluxo a usar |
|---|---|---|
| Contato **não** salvo na agenda | `button[aria-label="Add to contacts"]` | `automateWhatsAppSaveContact()` (ADD flow) |
| Contato **já** salvo na agenda | `button[aria-label="Dados do contato"]` | `automateWhatsAppEditContact()` (EDIT flow) |

A função `syncContactNameToWA()` abre o menu e detecta qual das duas opções está presente, roteando automaticamente.

---

## Mensagens agendadas — follow-up automático

### Fluxo de agendamento
1. `handleSaveFollowup` (tipo `enviar_mensagem` + descricao + data + hora) → `chrome.runtime.sendMessage({ type: 'SCHEDULE_FOLLOWUP' })`
2. `background.js` → `chrome.alarms.create(alarmName, { when: timestamp })`  
3. No horário: `chrome.alarms.onAlarm` → `chrome.tabs.sendMessage({ type: 'SEND_FOLLOWUP_MESSAGE' })`
4. `content.js` → `sendScheduledMessage(phone, message)` → navega até o chat → envia

### Permissões necessárias no manifest.json
```json
"permissions": ["storage", "alarms", "notifications", "tabs"]
```

### Navegação ao chat do lead
- **Caminho 1 (chat já aberto)**: verifica `state.current.phone` → envia direto via `doSend()`
- **Caminho 2 (na lista)**: procura `[data-crm-phone]` anotado → clica na linha
- **Caminho 3 (fallback)**: `window.location.href = 'https://web.whatsapp.com/send/?phone=...'` + persiste `pendingMessageToSend` em `chrome.storage.local`

---

## Histórico de descobertas

| Data | Descoberta | Como foi identificada |
|---|---|---|
| 2026-06-11 | `cell-frame-title` é `<div>`, não `<span>` | Spy de eventos — texto interno "Carina" + ancestral exibido |
| 2026-06-11 | Badge aparecia ao lado do timestamp pois `titleEl.parentElement` é o gridcell com hora | Relato do usuário + spy |
| 2026-06-11 | Botões "Fechar" e "Voltar" no drawer têm `data-tab="2"` | Spy de eventos — clique no X e na seta |
| 2026-06-11 | Fiber walk de 30 níveis insuficiente para lista; contatos salvos precisam de 80-100+ a partir de `cell-frame-container` | Badges aparecendo só após clicar |
| 2026-06-11 | Contatos não salvos na agenda: número extraível direto do text node do `cell-frame-title` | Spy mostrando "+55 83 9615-2916" como texto |
| 2026-06-11 | `div[data-testid^="list-item-"]` é o componente React real de cada linha; `props.chat` fica ~30-60 níveis acima a partir dele (vs 100+ a partir de `cell-frame-container`) | Spy de eventos mostrando hierarquia DOM completa — resolve o "precisa clicar primeiro" |
| 2026-06-11 | Container da lista: `div[aria-label="Lista de conversas"][role="grid"]` | Spy de eventos — hierarquia DOM |
| 2026-06-11 | `span[dir="auto"]` dentro de `cell-frame-title` tem o nome/número puro no atributo `title`; `textContent` total é poluído por ícones como `ic-label-filled` | Análise do bug de name-matching — textContent retornava "Carinaicela-label-filled" em vez de "Carina" |
| 2026-06-11 | 9º dígito BR: WhatsApp e CRM podem armazenar formas diferentes do mesmo celular (`554299981280` ≡ `5542999981280`) — matching exato falhava | Lead "perdido" (VANESSA) sumia após reload; investigação no Supabase mostrou o número de 12 dígitos no banco |
| 2026-06-11 | `#main` só existe com chat aberto; `#pane-side` existe sempre — esperar por `#main` causava delay de 20s (timeout) nos badges | Relato de demora de 15-30s + leitura do `waitForElement` |
| 2026-06-11 | Avatares vêm como URL `pps.whatsapp.net` (expira!) ou `blob:` — nunca como base64; o filtro antigo `data:image` rejeitava tudo e `foto_url` ficava NULL em 100% dos leads | Query no Supabase: 24/24 leads sem foto |
| 2026-06-12 | "Dados do contato" abre `contact-info-1`, não `save-contact-drawer` — aguardar o drawer errado causava timeout em `automateWhatsAppEditContact` | Console: "Timeout aguardando: [data-testid="save-contact-drawer"]" antes do clique em Editar |
| 2026-06-12 | Botão Enviar: `button[aria-label="Enviar"][data-tab="11"]`; compose box: `div[contenteditable="true"][data-tab="10"]` | Spy de eventos — clique no send button |
| 2026-06-12 | `sendScheduledMessage` deve clicar em `list-item-N` (pai), não em `cell-frame-container` (filho) — o handler de click do WA está no pai | Envio agendado caia no fallback de URL mesmo com contato visível na lista |
