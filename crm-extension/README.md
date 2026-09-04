# 🧩 Connect CRM — Extensão Google Chrome

Extensão Manifest V3 que injeta uma barra lateral de CRM diretamente na interface do **WhatsApp Web** (`web.whatsapp.com`).

---

## 📁 Estrutura de Arquivos

```text
crm-extension/
├── manifest.json              # Manifesto V3 (permissões, scripts, recursos)
├── background.js              # Service Worker (CORS bypass de fotos, ponte de sessão)
├── content.js                 # Script injetado no WhatsApp Web (DOM & UI da Sidebar)
├── inject.js                  # Script auxiliar acessível no contexto da página
├── session-bridge.js          # Injetado no CRM Web para sincronizar JWT do Supabase
├── logger.js                  # Telemetria e envio de logs de erro/debug ao Supabase
├── sidebar.css                # Folha de estilos da sidebar do CRM
├── WHATSAPP_DOM_REFERENCE.md  # Documentação de seletores DOM e React Fiber Walk
├── tools/
│   └── leitor-eventos.js      # Script utilitário para DevTools / Spy de cliques
├── favicon.png                # Ícone da extensão
└── logo.png                   # Marca Connect CRM
```

---

## 🚀 Como Instalar e Testar Localmente

1. No Google Chrome, abra `chrome://extensions/`.
2. Ative a opção **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `crm-extension`.
4. Abra o painel do CRM (`http://localhost:5173` ou produção) e faça login.
5. Abra o WhatsApp Web (`https://web.whatsapp.com`) e recarregue a página (F5).
6. A barra lateral do CRM carregará automaticamente à direita.

---

## 🔍 Ferramentas de Desenvolvimento e Debug

- **Inspecionar Cliques e Componentes**: Abra o console no WhatsApp Web (F12) e execute o script [`tools/leitor-eventos.js`](tools/leitor-eventos.js) para inspecionar novos elementos e seletores do WhatsApp.
- **Referência do DOM**: Consulte [`WHATSAPP_DOM_REFERENCE.md`](WHATSAPP_DOM_REFERENCE.md) para detalhes de seletores confirmados e navegação por React Fiber.
- **Logs de Diagnóstico**: Administradores podem ativar o modo de debug para um usuário específico na tela `/diagnostico` do CRM Web para receber logs detalhados da extensão.
