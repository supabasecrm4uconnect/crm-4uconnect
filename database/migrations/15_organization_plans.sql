-- ============================================================
-- Migration 15: Sistema de Planos, Vigência e Limites de Organização
-- ============================================================

-- Adiciona campos de plano, status, limites e datas na tabela organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plano text DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS plano_status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS max_usuarios integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_leads integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS plano_inicio timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plano_expira_em timestamptz DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS plano_valor_recorrente numeric DEFAULT 0;

-- Garante que organizações existentes tenham valores padrões preenchidos
UPDATE public.organizations
SET
  plano = COALESCE(plano, 'mensal'),
  plano_status = COALESCE(plano_status, 'ativo'),
  max_usuarios = COALESCE(max_usuarios, 1),
  max_leads = COALESCE(max_leads, 500),
  plano_inicio = COALESCE(plano_inicio, now()),
  plano_expira_em = COALESCE(plano_expira_em, now() + interval '30 days')
WHERE plano IS NULL OR max_usuarios IS NULL OR max_leads IS NULL;

-- Atualiza a função de novo usuário para já registrar os limites padrões ao criar nova empresa
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

  -- Se foi informado o nome da empresa no cadastro, cria a organização com limites padrões
  IF v_empresa IS NOT NULL THEN
    INSERT INTO public.organizations (
      nome,
      nome_exibicao,
      plano,
      plano_status,
      max_usuarios,
      max_leads,
      plano_inicio,
      plano_expira_em
    )
    VALUES (
      v_empresa,
      v_empresa,
      'mensal',
      'ativo',
      1,
      500,
      now(),
      now() + interval '30 days'
    )
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
