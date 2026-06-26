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
4. `migration_4_features.sql` — `leads.valor`/`arquivado`, branding e `auto_arquivar_dias` em `organizations`, função `arquivar_leads_inativos()`, bucket `org-logos`.
5. `migration_5_security.sql` — fecha o RPC de auto-arquivamento (só `service_role`) e escopa o bucket `org-logos` por organização.

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)
| Var | Onde | Obrigatória | Uso |
|-----|------|-------------|-----|
| `VITE_SUPABASE_URL` | Production | sim | URL do Supabase (cliente). |
| `VITE_SUPABASE_ANON_KEY` | Production | sim | Anon key (pública, cliente). |
| `CRON_SECRET` | Production | **sim** | Protege `/api/keep-alive` e `/api/auto-arquivar`. O Vercel Cron envia `Authorization: Bearer $CRON_SECRET`. **Sem ele, `/api/auto-arquivar` responde 401 (fail-closed).** |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | **sim (p/ auto-arquivar)** | Chave service role (server-side, **nunca** no cliente). Usada só pela rota `/api/auto-arquivar` para chamar o RPC. |

> A anon key é pública; a service role é secreta — só em env server-side da Vercel, nunca commitada nem exposta ao browser.

## Crons (vercel.json)
- `/api/keep-alive` — diário 09:00 BRT (mantém o Supabase free ativo).
- `/api/auto-arquivar` — diário 06:00 BRT (arquiva leads inativos por org com `auto_arquivar_dias` setado).

## Extensão Chrome
- `manifest.json` injeta o `session-bridge.js` apenas em `http://localhost:5173` e `https://crm-4uconnect.vercel.app` (domínio real). Ao trocar o domínio de produção, atualizar: `manifest.json` (host_permissions + content_scripts), `ALLOWED_SESSION_ORIGINS` em `background.js`, e `CRM_URL` em `content.js`.
- Após alterar arquivos da extensão: recarregar em `chrome://extensions` e dar refresh no WhatsApp Web.

## Checklist de deploy
- [ ] `migration_4` e `migration_5` aplicadas em produção.
- [ ] `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` configuradas na Vercel.
- [ ] `cd crm-web && npm ci && npm run build` passa; `npm run lint` sem erros.
- [ ] Domínio real conferido na extensão (manifest/background/content.js).
- [ ] Testar `/api/auto-arquivar` (401 sem header; com `CRON_SECRET` + service role arquiva).
- [ ] Conferir branding por org (nome/logo) e bucket `org-logos`.

## Risco residual conhecido (decisão registrada)
- `service_role` key e senha do banco foram expostas no chat numa sessão anterior; **decisão de NÃO rotacionar** (risco aceito). Se mudar de ideia: resetar senha do banco + girar JWT (troca a anon key → atualizar `.env`, `content.js` e redeploy).
