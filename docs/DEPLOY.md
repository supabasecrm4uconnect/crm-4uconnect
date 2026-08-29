# Deploy & Operação — CRM 4U Connect

## Componentes
- **crm-web** — app React/Vite (hospedado na Vercel, Root Directory = `crm-web`).
- **crm-extension** — extensão Chrome (carregada manualmente / unpacked).
- **Supabase** — banco/Postgres + Auth + Storage (projeto de produção `cimehhzkwgiwgfnkeauo`).

## Banco — ordem das migrations (SQL Editor do Supabase)
Rodar uma vez, em ordem (todas idempotentes):
1. `migration_1_schema.sql` — schema, RLS, triggers, realtime de `lead_statuses`.
2. `migration_2_data.sql` — **seed FICTÍCIO** (apenas ambiente novo/dev; **não** rodar em produção já populada).
3. `migration_3_security_fixes.sql` — proteção de privilégios em `profiles`, `lead_notes`, realtime das tabelas de leads.
4. `migration_4_features.sql` — `leads.valor`/`arquivado`, branding em `organizations`, bucket `org-logos`.
5. `migration_5_security.sql` — escopa o bucket `org-logos` por organização.
6. `migration_11_remove_auto_arquivar.sql` — remove a função `arquivar_leads_inativos()` e a coluna `auto_arquivar_dias` (arquivamento automático removido do produto).

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)
| Var | Onde | Obrigatória | Uso |
|-----|------|-------------|-----|
| `VITE_SUPABASE_URL` | Production | sim | URL do Supabase (cliente). |
| `VITE_SUPABASE_ANON_KEY` | Production | sim | Anon key (pública, cliente). |
| `CRON_SECRET` | Production | opcional | Protege `/api/keep-alive`. O Vercel Cron envia `Authorization: Bearer $CRON_SECRET`. Sem ele, o endpoint fica público, mas só faz um SELECT trivial. |

> A anon key é pública; nunca commitar ou expor a service role key ao browser.

## Crons (vercel.json)
- `/api/keep-alive` — diário 09:00 BRT (mantém o Supabase free ativo).

## Extensão Chrome
- `manifest.json` injeta o `session-bridge.js` apenas em `http://localhost:5173` e `https://crm-4uconnect.vercel.app` (domínio real). Ao trocar o domínio de produção, atualizar: `manifest.json` (host_permissions + content_scripts), `ALLOWED_SESSION_ORIGINS` em `background.js`, e `CRM_URL` em `content.js`.
- Após alterar arquivos da extensão: recarregar em `chrome://extensions` e dar refresh no WhatsApp Web.

## Checklist de deploy
- [ ] `migration_4`, `migration_5` e `migration_11` aplicadas em produção.
- [ ] `cd crm-web && npm ci && npm run build` passa; `npm run lint` sem erros.
- [ ] Domínio real conferido na extensão (manifest/background/content.js).
- [ ] Conferir branding por org (nome/logo) e bucket `org-logos`.

## Risco residual conhecido (decisão registrada)
- `service_role` key e senha do banco foram expostas no chat numa sessão anterior; **decisão de NÃO rotacionar** (risco aceito). Se mudar de ideia: resetar senha do banco + girar JWT (troca a anon key → atualizar `.env`, `content.js` e redeploy).
