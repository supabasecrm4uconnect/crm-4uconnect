-- ============================================================
-- CRM 4U Connect — Script 5: Correções de segurança (pós-auditoria)
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Rode no SQL Editor DEPOIS dos scripts 1–4. Idempotente.
-- ------------------------------------------------------------
-- Cobre:
--   #2 Fecha o RPC arquivar_leads_inativos() (só service_role)
--   #3 Escopa o bucket org-logos por organização (path = <org_id>/...)
-- ============================================================


-- =========================================
-- #2: arquivar_leads_inativos() só via service role
-- Antes: GRANT a anon → qualquer um com a anon key (pública) podia
-- chamar o RPC direto (/rest/v1/rpc/...) e arquivar leads em massa.
-- Agora: só service_role (usado pela rota /api/auto-arquivar com CRON_SECRET).
-- =========================================
REVOKE EXECUTE ON FUNCTION public.arquivar_leads_inativos() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.arquivar_leads_inativos() TO service_role;


-- =========================================
-- #3: bucket org-logos amarrado à organização do usuário
-- O path do upload é "<organization_id>/logo_...". As policies passam a
-- exigir que o 1º segmento do path seja a org do usuário → ninguém
-- sobrescreve/apaga logo de outra org. Leitura segue pública (bucket público).
-- =========================================
DROP POLICY IF EXISTS "org-logos upload autenticado"   ON storage.objects;
DROP POLICY IF EXISTS "org-logos update autenticado"   ON storage.objects;
DROP POLICY IF EXISTS "org-logos delete autenticado"   ON storage.objects;
DROP POLICY IF EXISTS "org-logos upload da própria org" ON storage.objects;
DROP POLICY IF EXISTS "org-logos update da própria org" ON storage.objects;
DROP POLICY IF EXISTS "org-logos delete da própria org" ON storage.objects;

CREATE POLICY "org-logos upload da própria org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.auth_user_org_id()::text
  );

CREATE POLICY "org-logos update da própria org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.auth_user_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.auth_user_org_id()::text
  );

CREATE POLICY "org-logos delete da própria org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.auth_user_org_id()::text
  );

-- (A policy "org-logos leitura pública" do migration_4 permanece — leitura pública.)


-- =========================================
-- VERIFICAÇÃO (opcional)
-- =========================================
-- Quem pode executar a função (não deve listar anon/authenticated):
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--   WHERE routine_name = 'arquivar_leads_inativos';
-- Policies do bucket:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'org-logos%';
