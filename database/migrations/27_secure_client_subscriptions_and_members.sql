-- Blindagem de Clientes & Assinaturas sem alterar clientes, leads ou históricos existentes.
-- Reexecução segura: apenas recria políticas, funções e gatilhos de proteção.

BEGIN;

-- O acesso operacional depende tanto do perfil ativo quanto da assinatura vigente.
CREATE OR REPLACE FUNCTION public.is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
      AND p.status = 'ativo'
      AND o.plano_status IN ('ativo', 'trial')
      AND (o.plano_expira_em IS NULL OR o.plano_expira_em >= now())
  );
$$;

-- A criação de tenant ocorre exclusivamente pelo cadastro inicial do cliente,
-- executado pelo gatilho de Auth; a Data API não cria organizações manualmente.
DROP POLICY IF EXISTS "Admin pode inserir org" ON public.organizations;
DROP POLICY IF EXISTS "Superadmin cria organizações" ON public.organizations;

-- Remove as políticas legadas que, combinadas por OR, permitiam elevação de privilégio.
DROP POLICY IF EXISTS "Admin gerencia perfis da organização" ON public.profiles;
DROP POLICY IF EXISTS "Le proprio perfil ou admin ve todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Ver próprios perfis da organização" ON public.profiles;
DROP POLICY IF EXISTS "Membros veem perfis da própria organização" ON public.profiles;
DROP POLICY IF EXISTS "Administradores gerenciam perfis da própria organização" ON public.profiles;

-- A equipe pode ver apenas os perfis da própria organização; super admin vê todos.
CREATE POLICY "Membros veem perfis da própria organização"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = auth_user_org_id()
    OR is_super_admin()
  );

-- Edições comuns ficam limitadas ao próprio perfil ou à equipe da mesma organização.
-- Campos de privilégio e de organização são barrados pelos gatilhos abaixo.
CREATE POLICY "Administradores gerenciam perfis da própria organização"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (organization_id = auth_user_org_id() AND is_admin())
    OR is_super_admin()
  )
  WITH CHECK (
    (id = auth.uid() AND organization_id = auth_user_org_id())
    OR (organization_id = auth_user_org_id() AND is_admin())
    OR is_super_admin()
  );

-- Não há DELETE de perfis pela Data API: desligamento é reversível via status=inativo.
DROP POLICY IF EXISTS "Administradores removem perfis da própria organização" ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- is_admin e is_super_admin nunca são delegados ao navegador.
  IF auth.uid() IS NOT NULL
     AND (
       NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Os privilégios globais do perfil só podem ser alterados pela administração do banco.';
  END IF;

  IF (NEW.tipo_usuario IS DISTINCT FROM OLD.tipo_usuario)
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar tipo_usuario ou status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- A associação de perfil não é alterável pela aplicação. O contexto sem auth.uid()
-- é reservado ao SQL Editor e ao gatilho de cadastro, que cria a organização inicial
-- de um novo cliente quando ele próprio se registra.
CREATE OR REPLACE FUNCTION public.prevent_profile_organization_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A organização de um perfil não pode ser alterada pela aplicação.';
  END IF;
  RETURN NEW;
END;
$$;

-- Impede ultrapassar a cota de leads no banco, inclusive fora da interface.
CREATE OR REPLACE FUNCTION public.enforce_organization_lead_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_max_leads integer;
  v_current_count integer;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Lead precisa pertencer a uma organização.';
  END IF;

  SELECT max_leads INTO v_max_leads
  FROM public.organizations
  WHERE id = NEW.organization_id;

  SELECT count(*) INTO v_current_count
  FROM public.leads
  WHERE organization_id = NEW.organization_id;

  IF v_current_count >= COALESCE(v_max_leads, 500) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Limite de leads do plano atingido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_organization_lead_limit ON public.leads;
CREATE TRIGGER trg_enforce_organization_lead_limit
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_lead_limit();

NOTIFY pgrst, 'reload schema';

COMMIT;
