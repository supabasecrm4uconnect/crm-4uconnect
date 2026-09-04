-- Protege clientes contra exclusao permanente pela aplicacao e pela API.
-- O desligamento operacional deve usar organizations.plano_status = 'bloqueado'.

BEGIN;

-- A conta comercial continua administradora da propria organizacao, mas deixa de
-- ser administradora global da plataforma.
UPDATE public.profiles
SET is_super_admin = false,
    is_admin = true,
    tipo_usuario = 'admin'
WHERE email = 'comercial@4uconnect.com.br'
  AND is_super_admin IS DISTINCT FROM false;

-- Nao permitir DELETE de organizacoes via Data API, mesmo para Super Admin.
DROP POLICY IF EXISTS "Superadmin pode deletar org" ON public.organizations;

-- Versoes antigas do CRM possuíam um fallback de exclusão que tentava
-- desvincular perfis antes de apagar a organização. Impede essa alteração
-- destrutiva por qualquer chamada normal ao banco.
CREATE OR REPLACE FUNCTION public.prevent_profile_organization_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A organização de um perfil não pode ser alterada pela aplicação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_organization_assignment ON public.profiles;
CREATE TRIGGER protect_profile_organization_assignment
  BEFORE UPDATE OF organization_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_organization_reassignment();

-- Mantem a RPC explicitamente inutilizavel como uma segunda barreira contra
-- chamadas antigas ou acesso direto pela API. O owner do banco continua sendo
-- a unica autoridade de emergencia via SQL Editor.
CREATE OR REPLACE FUNCTION public.delete_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'A exclusão permanente de clientes está desativada. Use o bloqueio do plano para desativar o acesso sem apagar dados.';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_organization(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_organization(uuid) FROM authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
