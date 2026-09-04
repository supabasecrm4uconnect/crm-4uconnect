-- Exige e registra o WhatsApp de contato em novos cadastros autônomos.
-- Não altera clientes, organizações ou perfis existentes.

BEGIN;

-- Completa somente contatos ainda vazios quando o usuário já traz o WhatsApp
-- no metadata. Preserva qualquer dado de contato que já exista.
WITH contatos_de_cadastro AS (
  SELECT DISTINCT ON (p.organization_id)
    p.organization_id,
    NULLIF(btrim(p.nome), '') AS responsavel_nome,
    NULLIF(btrim(p.email), '') AS responsavel_email,
    NULLIF(btrim(u.raw_user_meta_data->>'whatsapp'), '') AS responsavel_telefone
  FROM public.profiles AS p
  JOIN auth.users AS u ON u.id = p.id
  WHERE p.organization_id IS NOT NULL
    AND NULLIF(btrim(u.raw_user_meta_data->>'whatsapp'), '') ~ '^\+[1-9][0-9]{9,14}$'
  ORDER BY p.organization_id, p.created_at ASC
)
UPDATE public.organizations AS o
SET
  responsavel_nome = COALESCE(o.responsavel_nome, c.responsavel_nome),
  responsavel_email = COALESCE(o.responsavel_email, c.responsavel_email),
  responsavel_telefone = COALESCE(o.responsavel_telefone, c.responsavel_telefone)
FROM contatos_de_cadastro AS c
WHERE o.id = c.organization_id
  AND (
    o.responsavel_nome IS NULL
    OR o.responsavel_email IS NULL
    OR o.responsavel_telefone IS NULL
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_nome text;
  v_empresa text;
  v_whatsapp text;
  v_departamento text;
  v_org_id uuid;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_empresa := NULLIF(btrim(NEW.raw_user_meta_data->>'empresa'), '');
  v_whatsapp := NULLIF(btrim(NEW.raw_user_meta_data->>'whatsapp'), '');
  v_departamento := COALESCE(NEW.raw_user_meta_data->>'departamento', 'comercial');

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O nome da empresa é obrigatório para criar uma conta.';
  END IF;

  IF v_whatsapp IS NULL OR v_whatsapp !~ '^\+[1-9][0-9]{9,14}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Um WhatsApp válido é obrigatório para criar uma conta.';
  END IF;

  INSERT INTO public.organizations (
    nome, nome_exibicao, responsavel_nome, responsavel_email, responsavel_telefone,
    plano, plano_status, max_usuarios, max_leads, plano_inicio, plano_expira_em
  )
  VALUES (
    v_empresa, v_empresa, v_nome, NEW.email, v_whatsapp,
    'mensal', 'ativo', 1, 500, now(), now() + interval '30 days'
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
