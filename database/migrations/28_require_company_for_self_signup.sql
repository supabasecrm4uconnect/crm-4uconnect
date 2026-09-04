-- O produto usa uma conta inicial por cliente. Evita perfis ou organizações soltas.
-- Não modifica qualquer conta ou organização já existente.

BEGIN;

-- A versão publicada anterior ainda exibe "Novo Cliente". Sem política INSERT,
-- a Data API não consegue criar uma organização manual/órfã.
DROP POLICY IF EXISTS "Superadmin cria organizações" ON public.organizations;
DROP POLICY IF EXISTS "Admin pode inserir org" ON public.organizations;

-- O gatilho de Auth é a única via de criação do tenant inicial. A empresa é
-- obrigatória para que cada cadastro novo nasça isolado em sua própria organização.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_nome text;
  v_empresa text;
  v_departamento text;
  v_org_id uuid;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_empresa := NULLIF(btrim(NEW.raw_user_meta_data->>'empresa'), '');
  v_departamento := COALESCE(NEW.raw_user_meta_data->>'departamento', 'comercial');

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O nome da empresa é obrigatório para criar uma conta.';
  END IF;

  INSERT INTO public.organizations (
    nome, nome_exibicao, plano, plano_status, max_usuarios, max_leads,
    plano_inicio, plano_expira_em
  )
  VALUES (
    v_empresa, v_empresa, 'mensal', 'ativo', 1, 500,
    now(), now() + interval '30 days'
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (
    id, nome, email, tipo_usuario, status, organization_id, departamento
  )
  VALUES (
    NEW.id, v_nome, NEW.email, 'atendente', 'inativo', v_org_id, v_departamento
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    departamento = COALESCE(EXCLUDED.departamento, public.profiles.departamento);

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
