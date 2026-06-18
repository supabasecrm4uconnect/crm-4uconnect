// Vercel Cron → mantém o projeto Supabase (plano free) ativo com um ping diário.
// O Supabase pausa projetos do plano gratuito após ~7 dias sem atividade; uma
// requisição por dia evita isso com folga. Acionado pelo cron definido em vercel.json.
//
// URL e anon key são PÚBLICAS (as mesmas já embutidas no app/extensão) — sem segredo aqui.
// Se um dia a anon key for rotacionada, atualize abaixo (mas mesmo uma key antiga ainda
// gera uma requisição ao projeto, que é o que conta para não pausar).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cimehhzkwgiwgfnkeauo.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWVoaHprd2dpd2dmbmtlYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Nzk0NTEsImV4cCI6MjA5NzE1NTQ1MX0.lMAp7uK7_H3jRqGksZGVVH72bxyOISIOAefTPAlLxJI';

export default async function handler(req, res) {
  // Se CRON_SECRET estiver configurado na Vercel, exige o header que o Vercel Cron envia.
  // (Sem CRON_SECRET o endpoint fica público, mas só faz um SELECT trivial — risco mínimo.)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    // Consulta trivial só para gerar atividade no Postgres (RLS pode retornar vazio — tanto faz,
    // o que importa é a requisição executar uma query no banco).
    const r = await fetch(`${SUPABASE_URL}/rest/v1/lead_statuses?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    return res.status(200).json({ ok: true, supabaseStatus: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
