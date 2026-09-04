-- Restaura o contexto de tenant em inserts operacionais feitos por clientes
-- legados (extensão/web) sem enfraquecer o isolamento RLS.
-- Seguro para reexecução: funções são substituídas e triggers recriados.

BEGIN;

CREATE OR REPLACE FUNCTION public.fill_lead_organization_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  authenticated_org_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    authenticated_org_id := public.auth_user_org_id();

    IF authenticated_org_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Usuário autenticado não possui organização vinculada.';
    END IF;

    -- O tenant vem sempre do perfil autenticado. Um organization_id enviado
    -- pelo navegador nunca permite criar registros para outra organização.
    NEW.organization_id := authenticated_org_id;
  ELSIF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Lead precisa pertencer a uma organização.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_lead_organization_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fill_lead_organization_from_auth() FROM anon;
REVOKE ALL ON FUNCTION public.fill_lead_organization_from_auth() FROM authenticated;

-- O prefixo 00 garante execução antes de trg_enforce_organization_lead_limit,
-- pois triggers do mesmo evento/timing são executados em ordem alfabética.
DROP TRIGGER IF EXISTS trg_00_fill_lead_organization ON public.leads;
CREATE TRIGGER trg_00_fill_lead_organization
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_lead_organization_from_auth();

CREATE OR REPLACE FUNCTION public.fill_lead_child_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  parent_org_id uuid;
BEGIN
  SELECT organization_id
    INTO parent_org_id
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF parent_org_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Registro operacional precisa referenciar um lead acessível com organização.';
  END IF;

  -- Filhos herdam o tenant do lead pai; não se confia no valor do navegador.
  NEW.organization_id := parent_org_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_lead_child_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fill_lead_child_organization() FROM anon;
REVOKE ALL ON FUNCTION public.fill_lead_child_organization() FROM authenticated;

DROP TRIGGER IF EXISTS trg_00_fill_activity_organization ON public.lead_activities;
CREATE TRIGGER trg_00_fill_activity_organization
  BEFORE INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_lead_child_organization();

DROP TRIGGER IF EXISTS trg_00_fill_note_organization ON public.lead_notes;
CREATE TRIGGER trg_00_fill_note_organization
  BEFORE INSERT ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_lead_child_organization();

NOTIFY pgrst, 'reload schema';

COMMIT;
