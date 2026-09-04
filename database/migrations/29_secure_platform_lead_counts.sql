-- Contagens administrativas agregadas, sem expor dados de leads de outras organizações.
-- Seguro para reexecução: recria somente a função de leitura.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_superadmin_organization_lead_counts()
RETURNS TABLE (
  organization_id uuid,
  total_leads bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    l.organization_id,
    count(*)::bigint AS total_leads
  FROM public.leads AS l
  WHERE public.is_super_admin()
  GROUP BY l.organization_id;
$$;

REVOKE ALL ON FUNCTION public.get_superadmin_organization_lead_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_superadmin_organization_lead_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_superadmin_organization_lead_counts() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
