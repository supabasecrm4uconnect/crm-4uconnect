# 💻 CRM 4U Connect — Painel Web

Aplicação web SPA desenvolvida em **React 19 + TypeScript + Vite + Tailwind CSS** para gestão de clientes, funil de vendas, follow-ups e métricas de desempenho.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Roteamento**: React Router v7
- **Estilização**: Tailwind CSS + Lucide React (ícones)
- **Backend & Auth**: Supabase JS SDK v2
- **Hospedagem & Serverless**: Vercel (com Vercel Cron para keep-alive)

---

## 📁 Estrutura de Diretórios

```text
crm-web/
├── api/                       # Vercel Serverless Functions
│   ├── keep-alive.js          # Executado via cron para manter o Supabase ativo
│   └── status.js              # Endpoint de verificação de integridade
├── public/                    # Arquivos estáticos
├── src/
│   ├── assets/                # Imagens e ícones
│   ├── components/            # Componentes reutilizáveis
│   │   ├── pipeline/          # Board Kanban, colunas e cards de lead
│   │   ├── CommandPalette.tsx # Busca rápida e atalhos (Ctrl/Cmd + K)
│   │   ├── ImportLeadsModal.tsx# Importador de leads via CSV
│   │   ├── LeadDrawer.tsx     # Drawer lateral de detalhes, histórico e notas
│   │   └── Layout.tsx         # Sidebar de navegação e layout padrão
│   ├── contexts/              # Provedores de estado global
│   │   ├── AuthContext.tsx    # Sessão e usuário logado no Supabase
│   │   ├── BrandingContext.tsx# Logo e personalização visual da organização
│   │   ├── FollowUpsContext.tsx# Notificações e contadores de follow-up
│   │   └── StatusesContext.tsx# Status do funil carregados dinamicamente
│   ├── hooks/                 # Custom React hooks (ex: useLeadsRealtime)
│   ├── lib/                   # Utilitários, helpers e cliente do Supabase
│   ├── pages/                 # Páginas da aplicação
│   │   ├── Login.tsx          # Tela de autenticação
│   │   ├── Dashboard.tsx      # Métricas de vendas, conversão e perda
│   │   ├── Leads.tsx          # Visualização Kanban e Tabela de leads
│   │   ├── FollowUps.tsx      # Agenda e tarefas programadas
│   │   ├── Arquivados.tsx     # Gestão de leads arquivados
│   │   ├── Configuracoes.tsx  # Configuração de status, origens, segmentos e membros
│   │   ├── Diagnostico.tsx    # Visualizador de logs técnicos da extensão Chrome
│   │   └── Status.tsx         # Página pública de status do serviço
│   ├── types/                 # Interfaces TypeScript do modelo de dados
│   ├── App.tsx                # Declaração de rotas e providers
│   └── main.tsx               # Ponto de entrada da aplicação
├── vercel.json                # Configuração de rewrites e crons na Vercel
└── vite.config.ts             # Configuração do Vite
```

---

## 🚀 Comandos Disponíveis

Execute dentro do diretório `crm-web/`:

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (http://localhost:5173)
npm run dev

# Gerar build de produção para Vercel
npm run build

# Executar verificação de linting
npm run lint

# Visualizar o build de produção localmente
npm run preview
```

---

## 🔐 Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` com base no `.env.example`:

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```
