-- ====================================================================
-- SCRIPT 20: DEDUPLICAÇÃO DE STATUS, ORIGENS E SEGMENTOS DO PIPELINE
-- ====================================================================

-- 1. Remove statuses duplicados por organização (mantendo apenas o mais antigo/válido)
DELETE FROM public.lead_statuses a
USING public.lead_statuses b
WHERE a.ctid < b.ctid
  AND a.value = b.value
  AND (a.organization_id = b.organization_id OR (a.organization_id IS NULL AND b.organization_id IS NULL));

-- 2. Remove origens duplicadas por organização
DELETE FROM public.lead_sources a
USING public.lead_sources b
WHERE a.ctid < b.ctid
  AND lower(trim(a.nome)) = lower(trim(b.nome))
  AND (a.organization_id = b.organization_id OR (a.organization_id IS NULL AND b.organization_id IS NULL));

-- 3. Remove segmentos duplicados por organização
DELETE FROM public.lead_segments a
USING public.lead_segments b
WHERE a.ctid < b.ctid
  AND lower(trim(a.nome)) = lower(trim(b.nome))
  AND (a.organization_id = b.organization_id OR (a.organization_id IS NULL AND b.organization_id IS NULL));

-- 4. Garante que as políticas de RLS de statuses, origens e segmentos limitem estritamente à organização atual
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
DROP POLICY IF EXISTS "Membros da organização acessam segmentos" ON public.lead_segments;

CREATE POLICY "Membros da organização acessam segmentos"
  ON public.lead_segments FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = auth_user_org_id());

-- 5. Relatório de Statuses Ativos por Organização
SELECT
  s.organization_id,
  o.nome AS organizacao,
  s.value,
  s.label,
  s.ordem
FROM public.lead_statuses s
LEFT JOIN public.organizations o ON s.organization_id = o.id
ORDER BY s.organization_id, s.ordem;
