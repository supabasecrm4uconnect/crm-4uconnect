-- ====================================================================
-- SCRIPT DE EMERGÊNCIA 19: RESTAURAÇÃO E ISOLAMENTO 100% TOTAL DE LEADS
-- ====================================================================
-- Objetivo:
-- 1. Blindar as regras RLS para que NENHUMA conta veja leads de outra empresa.
-- 2. Vincular corretamente os leads existentes ao organization_id do seu respectivo criador/responsável (incluindo comercial@4uconnect.com.br).
-- 3. Garantir que cada empresa/cliente tenha sua própria organização isolada.
-- ====================================================================

-- PASSO 1: Garantir que cada perfil tenha sua própria organização
DO $$
DECLARE
  p RECORD;
  new_org_id uuid;
BEGIN
  -- Para cada perfil sem organização_id, cria sua organização exclusiva
  FOR p IN SELECT id, nome, email FROM public.profiles WHERE organization_id IS NULL LOOP
    INSERT INTO public.organizations (
      nome,
      nome_exibicao,
      responsavel_nome,
      responsavel_email,
      plano,
      plano_status,
      max_usuarios,
      max_leads,
      plano_inicio,
      plano_expira_em,
      plano_valor_recorrente
    )
    VALUES (
      COALESCE(p.nome, split_part(p.email, '@', 1)),
      COALESCE(p.nome, split_part(p.email, '@', 1)),
      p.nome,
      p.email,
      'mensal',
      'ativo',
      2,
      1000,
      now(),
      now() + interval '30 days',
      97.00
    )
    RETURNING id INTO new_org_id;

    UPDATE public.profiles SET organization_id = new_org_id WHERE id = p.id;
  END LOOP;
END $$;

-- PASSO 2: Restaurar organization_id dos Leads com base no seu responsável/criador
-- (Garante que os leads do comercial@4uconnect.com.br e de outros clientes voltem para a sua própria organização)
UPDATE public.leads l
SET organization_id = p.organization_id
FROM public.profiles p
WHERE l.responsavel_id = p.id
  AND p.organization_id IS NOT NULL
  AND (l.organization_id IS NULL OR l.organization_id != p.organization_id);

-- Para leads sem responsável_id ou onde ainda está nulo, vincula à organização do primeiro admin disponível
UPDATE public.leads l
SET organization_id = (SELECT organization_id FROM public.profiles WHERE email = 'comercial@4uconnect.com.br' LIMIT 1)
WHERE l.organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE email = 'comercial@4uconnect.com.br');

-- PASSO 3: Atualizar tabelas filhas (atividades, notas, histórico) com o organization_id do lead pai
UPDATE public.lead_activities a
SET organization_id = l.organization_id
FROM public.leads l
WHERE a.lead_id = l.id
  AND l.organization_id IS NOT NULL
  AND (a.organization_id IS NULL OR a.organization_id != l.organization_id);

UPDATE public.lead_notes n
SET organization_id = l.organization_id
FROM public.leads l
WHERE n.lead_id = l.id
  AND l.organization_id IS NOT NULL
  AND (n.organization_id IS NULL OR n.organization_id != l.organization_id);

UPDATE public.lead_status_history h
SET organization_id = l.organization_id
FROM public.leads l
WHERE h.lead_id = l.id
  AND l.organization_id IS NOT NULL
  AND (h.organization_id IS NULL OR h.organization_id != l.organization_id);

-- PASSO 4: POLÍTICAS RLS COM ISOLAMENTO 100% TOTAL (SEM VAZAMENTO ENTRE CONTAS)
-- Cada usuário SÓ enxerga os dados da SUA PRÓPRIA organização (auth_user_org_id()).

-- 4.1 Leads
DROP POLICY IF EXISTS "Usuário acessa próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Membros da organização acessam leads" ON public.leads;

CREATE POLICY "Membros da organização acessam leads"
  ON public.leads FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  );

-- 4.2 Atividades
DROP POLICY IF EXISTS "Usuário acessa próprias atividades" ON public.lead_activities;
DROP POLICY IF EXISTS "Membros da organização acessam atividades" ON public.lead_activities;

CREATE POLICY "Membros da organização acessam atividades"
  ON public.lead_activities FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  );

-- 4.3 Histórico de Status
DROP POLICY IF EXISTS "Usuário acessa próprio histórico" ON public.lead_status_history;
DROP POLICY IF EXISTS "Membros da organização acessam histórico" ON public.lead_status_history;

CREATE POLICY "Membros da organização acessam histórico"
  ON public.lead_status_history FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  );

-- 4.4 Notas
DROP POLICY IF EXISTS "Usuário acessa próprias notas" ON public.lead_notes;
DROP POLICY IF EXISTS "Membros da organização acessam notas" ON public.lead_notes;

CREATE POLICY "Membros da organização acessam notas"
  ON public.lead_notes FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  );

-- 4.5 Status, Origens e Segmentos
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

-- PASSO 5: Relatório de Diagnóstico
SELECT
  p.email,
  p.nome,
  p.tipo_usuario,
  p.is_super_admin,
  o.nome AS nome_organizacao,
  o.id AS organization_id,
  (SELECT count(*) FROM public.leads WHERE organization_id = p.organization_id) AS total_leads_da_organizacao
FROM public.profiles p
LEFT JOIN public.organizations o ON p.organization_id = o.id
ORDER BY p.email;
