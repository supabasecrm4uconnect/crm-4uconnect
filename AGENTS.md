# 🤖 Diretrizes para Assistentes de IA e Desenvolvedores — CRM 4U Connect

Este documento estabelece as **regras obrigatórias de conduta, arquitetura e documentação contínua** para qualquer agente de IA (Antigravity, Claude, Copilot, Cursor, etc.) e desenvolvedor que atue neste repositório.

---

## 🎯 Protocolo de Documentação Contínua (Regra de Ouro)

Toda IA que trabalhar neste projeto é **co-responsável por manter a documentação atualizada proativamente**. Siga rigorosamente a tabela de gatilhos abaixo:

| Evento / Modificação | Ação Obrigatória da IA | Arquivo Alvo |
|---|---|---|
| **Decisão de Arquitetura ou Design** (nova biblioteca, nova estratégia de auth, novo fluxo na extensão, etc.) | Criar uma nova entrada **ADR** com Contexto, Decisão e Consequências. | [`docs/DECISIONS.md`](file:///docs/DECISIONS.md) |
| **Alteração no Banco de Dados** (nova tabela, coluna, índice, RLS ou trigger) | 1. Criar novo arquivo SQL numerado em `database/migrations/`<br>2. Atualizar o dicionário e o diagrama ERD. | [`docs/DATABASE.md`](file:///docs/DATABASE.md) e [`database/migrations/`](file:///database/migrations) |
| **Conclusão de Tarefa / Descoberta de Gotcha** (onde paramos, novas pendências ou armadilhas) | Atualizar a fotografia do estado atual, gotchas e backlog ativo. | [`MEMORY.md`](file:///MEMORY.md) |
| **Alteração em Regra Comercial ou Ciclo de Vida** (novos tipos de atividade, novas personas, etc.) | Atualizar os modelos de negócio e jornadas de usuário. | [`docs/CONTEXT.md`](file:///docs/CONTEXT.md) |
| **Alteração de Infraestrutura ou Deploy** (novas env vars, novos crons, etc.) | Atualizar o guia de deploy e checklists operacionais. | [`docs/DEPLOY.md`](file:///docs/DEPLOY.md) |

---

## 🏗️ Restrições Arquiteturais Mandatórias

1. **Multi-tenancy e RLS Rigorosos**:
   - Todas as tabelas no schema `public` **devem ter `organization_id`** e **Row Level Security (RLS) habilitado**.
   - Toda consulta ou mutação valida se o usuário pertence à organização (`auth.uid()`).

2. **Segurança de Credenciais**:
   - O frontend (`crm-web`) e a extensão (`crm-extension`) utilizam **apenas a `VITE_SUPABASE_ANON_KEY`**.
   - **NUNCA** commitar, expor ou injetar a `service_role` key no browser.

3. **Sincronia de Domínios da Extensão Chrome**:
   - Qualquer alteração na URL de produção do CRM Web deve ser replicada simultaneamente em:
     1. `crm-extension/manifest.json` (`host_permissions` e `matches`)
     2. `crm-extension/background.js` (`ALLOWED_SESSION_ORIGINS`)
     3. `crm-extension/content.js` (`CRM_URL`)

4. **Avatares do WhatsApp**:
   - Fotos de perfil do WhatsApp **nunca** devem ser salvas como links diretos do CDN `pps.whatsapp.net` (pois expiram).
   - Devem ser baixadas pelo `background.js` e salvas no banco como **Base64 Data URI** (`data:image/jpeg;base64,...`).

5. **Migrations Idempotentes**:
   - Todo script em `database/migrations/` deve ser seguro para reexecução (`IF NOT EXISTS`, `OR REPLACE`, `DROP ... IF EXISTS`).
   - `02_data_seed.sql` é exclusivo para ambiente local/dev — **nunca** rodar em produção ativa.

6. **Organização da Raiz**:
   - Mantenha a raiz do repositório limpa. Não crie scripts temporários soltos na raiz. Use `crm-extension/tools/` para scripts de extensão ou `docs/` para documentação.

---

## 🧭 Mapa Rápido de Arquivos de Referência

- 🎯 Negócio e Personas: [`docs/CONTEXT.md`](file:///docs/CONTEXT.md)
- 🏗️ Diagramas e Integração: [`docs/ARCHITECTURE.md`](file:///docs/ARCHITECTURE.md)
- 📋 Registro de Decisões: [`docs/DECISIONS.md`](file:///docs/DECISIONS.md)
- 🗄️ Modelo de Dados: [`docs/DATABASE.md`](file:///docs/DATABASE.md)
- 🚀 Guia de Deploy: [`docs/DEPLOY.md`](file:///docs/DEPLOY.md)
- 🧠 Diário de Bordo Vivo: [`MEMORY.md`](file:///MEMORY.md)
- 🧩 Mapeamento do DOM do WhatsApp: [`crm-extension/WHATSAPP_DOM_REFERENCE.md`](file:///crm-extension/WHATSAPP_DOM_REFERENCE.md)
