# 🚀 CRM 4U Connect — Central do Repositório

Solução completa de **CRM integrado ao WhatsApp Web** para aceleração de vendas, gestão de leads, follow-ups em tempo real e análise gerencial.

---

## 🧭 Mapa da Documentação Técnica

Para facilitar o entendimento e desenvolvimento contínuo da aplicação, consulte os guias dedicados na pasta [`docs/`](docs/):

| Documento | Descrição |
|---|---|
| 🎯 [**Contexto e Negócio**](docs/CONTEXT.md) | Visão geral do produto, personas, ciclo de vida do lead e regras comerciais. |
| 🏗️ [**Arquitetura do Sistema**](docs/ARCHITECTURE.md) | Diagramas de componentes, fluxo de dados, Session Bridge e integração WhatsApp. |
| 📋 [**Registro de Decisões (ADRs)**](docs/DECISIONS.md) | Histórico e justificativas das decisões de arquitetura e escolhas técnicas. |
| 🗄️ [**Banco de Dados & Schema**](docs/DATABASE.md) | Diagrama ERD, dicionário de dados de todas as tabelas e políticas de RLS. |
| 🚀 [**Deploy & Operação**](docs/DEPLOY.md) | Checklist de deploy na Vercel, variáveis de ambiente e crons. |
| 🧠 [**Memória Viva do Projeto**](MEMORY.md) | Diário de bordo dinâmico, estado atual, gotchas técnicos e backlog ativo. |
| 🤖 [**Diretrizes para IAs / Devs**](AGENTS.md) | Regras mandatórias de arquitetura e protocolo de documentação contínua. |
| 🧩 [**WhatsApp DOM Reference**](crm-extension/WHATSAPP_DOM_REFERENCE.md) | Mapeamento de seletores do WhatsApp Web e navegação por React Fiber. |

---

## 📦 Estrutura do Repositório

```text
CRM - 4U Connect/
├── docs/                      # 📚 Central de documentação do projeto
│   ├── CONTEXT.md             # Visão do produto e regras de negócio
│   ├── ARCHITECTURE.md        # Diagramas e fluxos arquiteturais
│   ├── DECISIONS.md           # Registro de decisões arquiteturais (ADRs)
│   ├── DATABASE.md            # Modelo de dados e dicionário de tabelas
│   ├── DEPLOY.md              # Guia de deploy, Vercel e produção
│   └── specs/                 # Especificações originais e PDFs do projeto
├── database/                  # 🗄️ Banco de dados & Migrations
│   ├── migrations/            # Evolução reutilizável do schema e segurança
│   ├── operations/            # Operações manuais; nunca entram no deploy
│   └── tools/                 # Scripts auxiliares de manutenção do banco
├── crm-extension/             # 🧩 Extensão Chrome (Sidebar no WhatsApp Web)
│   ├── manifest.json          # Manifesto V3
│   ├── background.js          # Service Worker & bypass de fotos
│   ├── content.js             # UI e injeção no WhatsApp Web
│   ├── session-bridge.js      # Ponte de autenticação com o CRM Web
│   └── tools/                 # Ferramentas de debug (leitor-eventos)
├── crm-web/                   # 💻 Painel Web Administrativo (React + Vite + TS)
│   ├── api/                   # Serverless Functions (Keep-Alive Cron)
│   ├── src/                   # Código-fonte da aplicação
│   └── package.json           # Dependências do frontend
└── README.md                  # Este arquivo
```

---

## ⚡ Guia Rápido de Inicialização

### 1. Pré-requisitos
- Node.js 20.19+ ou 22.12+ e npm instalados (requisito do Vite 8).
- Projeto configurado no [Supabase](https://supabase.com).
- Google Chrome para carregar a extensão.

### 2. Configurar o Banco de Dados
Acesse o SQL Editor do seu projeto Supabase e siga a sequência documentada em [`database/migrations/README.md`](database/migrations/README.md). Operações de [`database/operations/`](database/operations/) nunca fazem parte do deploy.

### 3. Rodar o Painel Web Localmente
```bash
cd crm-web
npm install
npm run dev
```
Acesse a aplicação em `http://localhost:5173`.

### 4. Carregar a Extensão no WhatsApp Web
1. No Chrome, acesse `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `crm-extension`.
4. Abra o WhatsApp Web (`https://web.whatsapp.com`) e dê refresh.
