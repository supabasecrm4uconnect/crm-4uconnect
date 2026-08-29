-- ============================================================
-- CRM 4U Connect — Script 4: Novas features (pós-reunião cliente)
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Execute no SQL Editor DEPOIS dos scripts 1, 2 e 3.
-- Idempotente (IF NOT EXISTS / OR REPLACE / ON CONFLICT).
-- ------------------------------------------------------------
-- Cobre:
--   1. Valor R$ no lead              (leads.valor)
--   2. Arquivamento de leads          (leads.arquivado / arquivado_em)
--   3. White-label por organização    (organizations.nome_exibicao / logo_url)
--   4. Auto-arquivamento por prazo     (organizations.auto_arquivar_dias + função)
--   5. Bucket de logos                 (storage: org-logos)
-- ============================================================


-- =========================================
-- 1 + 2: Colunas novas em leads
-- =========================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor        numeric(12,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS arquivado    boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS arquivado_em timestamptz;

-- Garante que registros antigos não fiquem com arquivado NULL
UPDATE public.leads SET arquivado = false WHERE arquivado IS NULL;

-- Índice para a listagem (filtra arquivado = false na maioria das telas)
CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON public.leads (arquivado);


-- =========================================
-- 3 + 4: Branding e prazo de auto-arquivamento na organização
-- =========================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS nome_exibicao     text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url          text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_arquivar_dias integer;


-- =========================================
-- 4: Função de auto-arquivamento
-- Arquiva leads parados há mais de `auto_arquivar_dias` (por org),
-- exceto os já arquivados e os que estão como 'fechado'.
-- SECURITY DEFINER → roda como owner, ignora RLS (chamada pelo cron via anon).
-- =========================================
CREATE OR REPLACE FUNCTION public.arquivar_leads_inativos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  total integer;
BEGIN
  UPDATE public.leads l
  SET    arquivado = true,
         arquivado_em = now()
  FROM   public.organizations o
  WHERE  l.organization_id = o.id
    AND  o.auto_arquivar_dias IS NOT NULL
    AND  o.auto_arquivar_dias > 0
    AND  COALESCE(l.arquivado, false) = false
    AND  COALESCE(l.status, '') <> 'fechado'
    AND  l.updated_at < now() - make_interval(days => o.auto_arquivar_dias);

  GET DIAGNOSTICS total = ROW_COUNT;
  RETURN total;
END;
$$;

-- Permite que o cron (anon) e o app (authenticated) disparem o arquivamento.
REVOKE EXECUTE ON FUNCTION public.arquivar_leads_inativos() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.arquivar_leads_inativos() TO anon, authenticated;


-- =========================================
-- 5: Bucket público para logos das organizações
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (bucket é público) + escrita para usuários autenticados.
DROP POLICY IF EXISTS "org-logos leitura pública"      ON storage.objects;
DROP POLICY IF EXISTS "org-logos upload autenticado"   ON storage.objects;
DROP POLICY IF EXISTS "org-logos update autenticado"   ON storage.objects;
DROP POLICY IF EXISTS "org-logos delete autenticado"   ON storage.objects;

CREATE POLICY "org-logos leitura pública"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'org-logos');

CREATE POLICY "org-logos upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "org-logos update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos')
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "org-logos delete autenticado"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');


-- =========================================
-- VERIFICAÇÃO (rode separadamente se quiser conferir)
-- =========================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='leads' AND column_name IN ('valor','arquivado','arquivado_em');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='organizations' AND column_name IN ('nome_exibicao','logo_url','auto_arquivar_dias');
-- SELECT proname FROM pg_proc WHERE proname = 'arquivar_leads_inativos';
-- SELECT id FROM storage.buckets WHERE id = 'org-logos';
