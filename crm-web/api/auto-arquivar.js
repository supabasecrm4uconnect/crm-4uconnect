// Vercel Cron → arquiva automaticamente leads parados há mais de
// `auto_arquivar_dias` (configurado por organização em Configurações → Empresa).
// Chama a função SECURITY DEFINER `arquivar_leads_inativos()` no Postgres.
//
// SEGURANÇA (pós-auditoria):
//  - A rota é FAIL-CLOSED: exige CRON_SECRET. Sem o segredo (ou divergente) → 401.
//    O Vercel Cron envia automaticamente `Authorization: Bearer $CRON_SECRET`.
//  - O RPC só é executável por `service_role` (ver migration_5) — a anon key
//    pública NÃO chama mais a função direto. Por isso usamos a SERVICE ROLE aqui
//    (chave server-side, nunca exposta ao cliente).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cimehhzkwgiwgfnkeauo.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // Fail-closed: CRON_SECRET é obrigatório.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (!SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/arquivar_leads_inativos`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const arquivados = await r.json().catch(() => null);
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, arquivados, at: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
