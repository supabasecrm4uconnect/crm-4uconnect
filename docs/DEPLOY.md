# 🚀 Deploy & Operação — CRM 4U Connect

Guia prático para build, configuração de variáveis de ambiente e deploy do ecossistema **CRM 4U Connect**.

---

## 1. Componentes da Infraestrutura

- **`crm-web`**: Single Page Application React/Vite hospedada na **Vercel** (Root Directory configurado como `crm-web`).
- **`crm-extension`**: Extensão Chrome Manifest V3 distribuída/carregada em modo desenvolvedor (*unpacked*).
- **`Supabase`**: Projeto de produção (PostgreSQL + Auth + Storage + Realtime).

---

## 2. Banco de Dados — Execução de Migrations

As mudanças reutilizáveis do banco ficam em [`database/migrations/`](../database/migrations/). Operações pontuais ficam em [`database/operations/`](../database/operations/) e **nunca** entram na rotina de deploy.

O projeto ainda usa execução controlada pelo SQL Editor, sem histórico reconciliado do Supabase CLI. Em banco existente, não reexecute a cadeia inteira: aplique somente o arquivo ainda pendente, depois de validar o estado atual. Para banco novo, siga [`database/migrations/README.md`](../database/migrations/README.md).

1. `01_schema.sql` — Tabelas base, constraints, funções de updated_at e RLS inicial.
2. `02_data_seed.sql` — **Dados de teste/fictícios** (*apenas ambiente local/dev — NÃO rodar em produção*).
3. `03_security_fixes.sql` — Proteção de privilégios de `profiles`, publicação de tabelas no Realtime.
4. `04_features_and_branding.sql` — Campos `valor`, `arquivado` em `leads`, branding em `organizations` e criação do bucket `org-logos`.
5. `05_storage_security.sql` — Políticas de RLS escopando o bucket `org-logos` por organização.
6. `06_fix_lead_notes.sql` — Compatibilização da coluna `nota` em `lead_notes`.
7. `07_extension_logs.sql` — Tabela `extension_logs` e flag `debug_mode` em `profiles`.
8. `08_status_automation.sql` — Campos para criação automática de tarefas ao mover lead no funil.
9. `09_activity_automation_flag.sql` — Flag `criado_automaticamente` em `lead_activities`.
10. `10_dashboard_v2.sql` — Campo `motivo_perda` na tabela `leads`.
11. `11_remove_auto_arquivar.sql` — Remove trigger e função legada de arquivamento automático.
12. Para as migrations `12` a `30`, siga o catálogo e a ordem documentados em [`DATABASE.md`](DATABASE.md), pulando os identificadores arquivados `17` e `20`.
13. `32_restore_tenant_context_on_operational_inserts.sql` — Restaura o tenant em inserts de leads/atividades/notas e deve ser aplicada antes de distribuir a extensão v1.0.2.
14. `33_absorb_legacy_status_history_writes.sql` — Compatibilidade segura para instalações antigas que repetem o POST do histórico automático.

Os antigos scripts `17`, `20`, `25` (recuperação de dados), `31` e `34` estão preservados em `database/operations/archive/` apenas como histórico. A migration 25 atual contém somente a tabela e a política RLS de auditoria.

---

## 3. Variáveis de Ambiente (Vercel)

Use Node.js `20.19+` ou `22.12+`; o requisito também está fixado no campo `engines` do `crm-web/package.json` para evitar builds com runtime incompatível.

Configure as variáveis no painel da Vercel (**Project Settings → Environment Variables**):

| Variável | Ambiente | Obrigatória | Finalidade |
|---|---|:---:|---|
| `VITE_SUPABASE_URL` | Production / Preview / Dev | Sim | URL da API do projeto Supabase (ex: `https://<ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Production / Preview / Dev | Sim | Anon Key pública para autenticação do cliente. |
| `CRON_SECRET` | Production | Opcional | Chave para autenticação do Vercel Cron no endpoint `/api/keep-alive`. |

> ⚠️ **Atenção**: Nunca adicione a `service_role` key nas variáveis de ambiente do frontend.

---

## 4. Crons & Serverless (`vercel.json`)

O arquivo `crm-web/vercel.json` gerencia:
- **Keep-Alive Diário**: Executa às `09:00 BRT` no endpoint `/api/keep-alive` para garantir que instâncias no tier gratuito do Supabase não entrem em modo hibernação (*paused*).
- **SPA Rewrites**: Redireciona todas as rotas web para `index.html`.

---

## 5. Extensão Google Chrome (`crm-extension`)

### 5.1. Instalação / Carregamento
1. Abra o Google Chrome e navegue até `chrome://extensions/`.
2. Ative a chave **"Modo do desenvolvedor"** no canto superior direito.
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta [`crm-extension/`](../crm-extension/).
5. Abra o WhatsApp Web (`https://web.whatsapp.com`) e dê um refresh na página (F5).

Após atualizar os arquivos de uma instalação existente, clique em **Recarregar** no card da extensão em `chrome://extensions/` e depois dê F5 tanto no CRM Web quanto no WhatsApp Web. A extensão **v1.0.2** contém o fluxo limpo. Para manter sem alteração uma instalação antiga já distribuída, aplique as migrations 32 e 33.

### 5.2. Configuração de Domínio de Produção
Ao alterar o domínio onde o CRM Web está hospedado, garanta a sincronização nos 3 arquivos da extensão:
1. `manifest.json`: atualizar `host_permissions` e `matches` de `content_scripts`.
2. `background.js`: atualizar a lista `ALLOWED_SESSION_ORIGINS`.
3. `content.js`: atualizar a constante `CRM_URL`.

---

## 6. Checklist de Deploy

### 6.1. Preview seguro antes da produção

1. Crie uma branch fora da `main`, por exemplo `preview/revisao-segura-AAAA-MM-DD`.
2. Execute `npm run build`, `npm run lint` e valide a extensão antes do push.
3. Envie somente a branch de Preview. A integração Git da Vercel gera um deployment temporário sem alterar os domínios de produção.
4. Confirme as variáveis do ambiente **Preview** antes de testar gravações. Se `VITE_SUPABASE_URL` apontar para produção, qualquer cadastro, lead ou follow-up criado pelo Preview também será dado real de produção.
   - A ausência de `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` impede a inicialização do cliente. O aplicativo detecta essa condição antes de carregar o Supabase e mostra quais nomes de variáveis precisam ser configurados; deployments antigos podem apresentar `supabaseUrl is required` no console.
   - Prefira um projeto Supabase de homologação. Só reutilize as credenciais públicas de produção no Preview com autorização explícita e sabendo que as gravações atingirão os dados reais.
5. O deployment de Preview não executa arquivos SQL de `database/migrations/` ou `database/operations/`.
6. Mantenha o Preview protegido por autenticação da Vercel quando ele contiver telas ou dados administrativos.
7. Só integre a branch na `main` após validar login, leads, pipeline, follow-ups, configurações e Clientes & Assinaturas.

O script `https://vercel.live/.../feedback.js` pertence à barra de feedback do Preview. A CSP do CRM mantém scripts externos bloqueados intencionalmente; esse aviso não interfere no funcionamento do aplicativo.

### 6.2. Produção

- [ ] Somente as migrations realmente pendentes de `database/migrations/` foram revisadas e executadas no Supabase.
- [ ] Nenhum arquivo de `database/operations/` foi incluído automaticamente no deploy.
- [ ] Migration `32_restore_tenant_context_on_operational_inserts.sql` aplicada e validada no Supabase.
- [ ] Migration `33_absorb_legacy_status_history_writes.sql` aplicada quando houver extensões antigas em uso.
- [ ] Extensão v1.0.2 recarregada nas máquinas dos atendentes; CRM Web e WhatsApp Web atualizados com F5.
- [ ] Build e testes locais aprovados:
  ```bash
  cd crm-web
  npm ci
  npm run build
  npm run lint
  ```
- [ ] Variáveis de ambiente configuradas na Vercel.
- [ ] Domínios da extensão atualizados e conferidos.

### 6.3. Promoção web de 04/09/2026

- O Preview foi validado com login e gravação de leads antes da promoção.
- O commit de produção `e6905a9` contém exclusivamente arquivos de `crm-web/`; `crm-extension/` e `database/` não foram alterados.
- A extensão publicada permaneceu em uso. O domínio legado `crm-4uconnect.vercel.app`, autorizado por essa versão, continua ativo e servindo o mesmo bundle do alias `connect-crm.vercel.app`.
- O status da Vercel concluiu com sucesso e ambos os domínios responderam HTTP 200 após o deploy.
