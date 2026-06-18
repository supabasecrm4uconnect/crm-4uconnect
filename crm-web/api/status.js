const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://cimehhzkwgiwgfnkeauo.supabase.co').replace(/^﻿/, '').trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || '').replace(/^﻿/, '').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const checks = {};
  const start = Date.now();

  // Check 1: Supabase REST API
  try {
    const t0 = Date.now();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/lead_statuses?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    checks.database = { ok: r.status < 500, status: r.status, latencyMs: Date.now() - t0 };
  } catch (e) {
    checks.database = { ok: false, error: String(e?.message || e), latencyMs: Date.now() - start };
  }

  // Check 2: Supabase Auth
  try {
    const t0 = Date.now();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    checks.auth = { ok: r.status < 500, status: r.status, latencyMs: Date.now() - t0 };
  } catch (e) {
    checks.auth = { ok: false, error: String(e?.message || e), latencyMs: Date.now() - start };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  return res.status(allOk ? 200 : 503).json({
    ok: allOk,
    checks,
    at: new Date().toISOString(),
  });
}
