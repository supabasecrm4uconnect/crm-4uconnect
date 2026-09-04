-- ============================================================================
-- Migration 22: Isola catálogos comerciais por organização
--
-- Status, origens e segmentos são configurações próprias de cada tenant.
-- Super admins continuam com acesso global às telas administrativas de clientes,
-- mas não recebem catálogos de outras organizações nas telas operacionais.
-- Nenhum dado de lead é modificado.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Org lê seus statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Org gerencia seus statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Membros da organização acessam statuses" ON public.lead_statuses;

CREATE POLICY "Membros da organização acessam statuses"
  ON public.lead_statuses FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Org acessa próprias origens" ON public.lead_sources;
DROP POLICY IF EXISTS "Membros da organização acessam origens" ON public.lead_sources;

CREATE POLICY "Membros da organização acessam origens"
  ON public.lead_sources FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Org acessa próprios segmentos" ON public.lead_segments;
DROP POLICY IF EXISTS "Membros da organização acessam segmentos"
  ON public.lead_segments;

CREATE POLICY "Membros da organização acessam segmentos"
  ON public.lead_segments FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = auth_user_org_id());

NOTIFY pgrst, 'reload schema';

COMMIT;
