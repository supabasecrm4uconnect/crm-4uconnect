-- ============================================================
-- Migration 14: Suporte ao Nome da Empresa no Cadastro de Usuário
-- ============================================================

-- Atualiza a função de criação automática de usuário/organização para considerar o nome da empresa informado no metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_nome text;
  v_empresa text;
  v_departamento text;
  v_org_id uuid;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_empresa := NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa'), '');
  v_departamento := COALESCE(NEW.raw_user_meta_data->>'departamento', 'comercial');

  -- Se foi informado o nome da empresa no cadastro, cria a organização com o nome comercial
  IF v_empresa IS NOT NULL THEN
    INSERT INTO public.organizations (nome, nome_exibicao)
    VALUES (v_empresa, v_empresa)
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.profiles (id, nome, email, tipo_usuario, status, organization_id, departamento)
  VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    'atendente',
    'inativo',
    v_org_id,
    v_departamento
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    departamento = COALESCE(EXCLUDED.departamento, public.profiles.departamento);

  RETURN NEW;
END;
$$;
