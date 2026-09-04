-- ====================================================================
-- Script 18: Correção de Políticas RLS para Compartilhamento de Leads na Organização
-- Objetivo: Garantir que todos os membros de uma mesma empresa/organização
-- (Admin, Atendentes e Colaboradores) visualizem e trabalhem nos leads,
-- status do pipeline, atividades e notas da sua organização.
-- ====================================================================

-- 1. Políticas para public.leads
DROP POLICY IF EXISTS "Usuário acessa próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Membros da organização acessam leads" ON public.leads;

CREATE POLICY "Membros da organização acessam leads"
  ON public.leads FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active())
  WITH CHECK ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active());

-- 2. Políticas para public.lead_activities
DROP POLICY IF EXISTS "Usuário acessa próprias atividades" ON public.lead_activities;
DROP POLICY IF EXISTS "Membros da organização acessam atividades" ON public.lead_activities;

CREATE POLICY "Membros da organização acessam atividades"
  ON public.lead_activities FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active())
  WITH CHECK ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active());

-- 3. Políticas para public.lead_status_history
DROP POLICY IF EXISTS "Usuário acessa próprio histórico" ON public.lead_status_history;
DROP POLICY IF EXISTS "Membros da organização acessam histórico" ON public.lead_status_history;

CREATE POLICY "Membros da organização acessam histórico"
  ON public.lead_status_history FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active())
  WITH CHECK ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active());

-- 4. Políticas para public.lead_notes
DROP POLICY IF EXISTS "Usuário acessa próprias notas" ON public.lead_notes;
DROP POLICY IF EXISTS "Membros da organização acessam notas" ON public.lead_notes;

CREATE POLICY "Membros da organização acessam notas"
  ON public.lead_notes FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active())
  WITH CHECK ((organization_id = auth_user_org_id() OR is_super_admin()) AND is_active());

-- 5. Políticas para lead_statuses, lead_sources e lead_segments
DROP POLICY IF EXISTS "Org lê seus statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Org gerencia seus statuses" ON public.lead_statuses;
DROP POLICY IF EXISTS "Membros da organização acessam statuses" ON public.lead_statuses;

CREATE POLICY "Membros da organização acessam statuses"
  ON public.lead_statuses FOR ALL TO authenticated
  USING (organization_id = auth_user_org_id() OR is_super_admin())
  WITH CHECK (organization_id = auth_user_org_id() OR is_super_admin());

DROP POLICY IF EXISTS "Org acessa próprias origens" ON public.lead_sources;
DROP POLICY IF EXISTS "Membros da organização acessam origens" ON public.lead_sources;

CREATE POLICY "Membros da organização acessam origens"
  ON public.lead_sources FOR ALL TO authenticated
  USING (organization_id = auth_user_org_id() OR is_super_admin())
  WITH CHECK (organization_id = auth_user_org_id() OR is_super_admin());

DROP POLICY IF EXISTS "Org acessa próprios segmentos" ON public.lead_segments;
DROP POLICY IF EXISTS "Membros da organização acessam segmentos" ON public.lead_segments;

CREATE POLICY "Membros da organização acessam segmentos"
  ON public.lead_segments FOR ALL TO authenticated
  USING (organization_id = auth_user_org_id() OR is_super_admin())
  WITH CHECK (organization_id = auth_user_org_id() OR is_super_admin());
