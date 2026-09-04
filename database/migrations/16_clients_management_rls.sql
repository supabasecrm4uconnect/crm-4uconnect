-- ============================================================
-- Migration 16: Super Admin, Multi-Tenancy e Gestão de Clientes
-- ============================================================

-- 1. Garante que colunas essenciais existam em organizations e profiles
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_email text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS departamento text DEFAULT 'comercial',
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- 2. Função para verificar se o usuário é o Super Administrador da Plataforma CRM
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin = true FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 3. Ajusta constraints de Foreign Keys para ON DELETE CASCADE / SET NULL em todas as tabelas
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_origem_id_fkey,
  DROP CONSTRAINT IF EXISTS leads_segmento_id_fkey,
  DROP CONSTRAINT IF EXISTS leads_organization_id_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_origem_id_fkey FOREIGN KEY (origem_id) REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  ADD CONSTRAINT leads_segmento_id_fkey FOREIGN KEY (segmento_id) REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_statuses
  DROP CONSTRAINT IF EXISTS lead_statuses_organization_id_fkey;
ALTER TABLE public.lead_statuses
  ADD CONSTRAINT lead_statuses_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_sources
  DROP CONSTRAINT IF EXISTS lead_sources_organization_id_fkey;
ALTER TABLE public.lead_sources
  ADD CONSTRAINT lead_sources_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_segments
  DROP CONSTRAINT IF EXISTS lead_segments_organization_id_fkey;
ALTER TABLE public.lead_segments
  ADD CONSTRAINT lead_segments_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_organization_id_fkey;
ALTER TABLE public.lead_activities
  ADD CONSTRAINT lead_activities_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_status_history
  DROP CONSTRAINT IF EXISTS lead_status_history_organization_id_fkey;
ALTER TABLE public.lead_status_history
  ADD CONSTRAINT lead_status_history_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.lead_notes
  DROP CONSTRAINT IF EXISTS lead_notes_organization_id_fkey;
ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Atualiza RLS de organizations:
-- Clientes normais/admins de empresa só veem a SUA PRÓPRIA organização.
-- Apenas o SUPER ADMIN tem visão e controle global sobre todos os clientes!
DROP POLICY IF EXISTS "Ver própria org" ON public.organizations;
DROP POLICY IF EXISTS "Ver própria org ou admin ve todas" ON public.organizations;
DROP POLICY IF EXISTS "Ver própria org ou superadmin ve todas" ON public.organizations;
CREATE POLICY "Ver própria org ou superadmin ve todas"
  ON public.organizations FOR SELECT TO authenticated
  USING ((id = auth_user_org_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Admin pode atualizar própria org" ON public.organizations;
DROP POLICY IF EXISTS "Admin pode atualizar orgs" ON public.organizations;
DROP POLICY IF EXISTS "Superadmin pode atualizar orgs" ON public.organizations;
CREATE POLICY "Superadmin pode atualizar orgs"
  ON public.organizations FOR UPDATE TO authenticated
  USING ((id = auth_user_org_id()) OR is_super_admin())
  WITH CHECK ((id = auth_user_org_id()) OR is_super_admin());

DROP POLICY IF EXISTS "Admin pode deletar org" ON public.organizations;
DROP POLICY IF EXISTS "Superadmin pode deletar org" ON public.organizations;
CREATE POLICY "Superadmin pode deletar org"
  ON public.organizations FOR DELETE TO authenticated
  USING (is_super_admin());

-- 4.1. Proteção mandatória: Clientes comuns NUNCA podem alterar colunas de planos ou cotas
CREATE OR REPLACE FUNCTION public.protect_organization_plan_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Se quem está alterando não é Super Admin, impede alteração de plano, limites e vigência
  IF NOT public.is_super_admin() THEN
    IF (NEW.plano IS DISTINCT FROM OLD.plano) OR
       (NEW.plano_status IS DISTINCT FROM OLD.plano_status) OR
       (NEW.max_usuarios IS DISTINCT FROM OLD.max_usuarios) OR
       (NEW.max_leads IS DISTINCT FROM OLD.max_leads) OR
       (NEW.plano_inicio IS DISTINCT FROM OLD.plano_inicio) OR
       (NEW.plano_expira_em IS DISTINCT FROM OLD.plano_expira_em) OR
       (NEW.plano_valor_recorrente IS DISTINCT FROM OLD.plano_valor_recorrente) THEN
      RAISE EXCEPTION 'Acesso negado: Apenas o Super Administrador pode alterar o plano, limites ou vigência da organização.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_organization_plan_columns ON public.organizations;
CREATE TRIGGER trg_protect_organization_plan_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_organization_plan_columns();

-- 5. RLS estrito para profiles:
-- Cada empresa/usuário só enxerga os colaboradores da SUA PRÓPRIA organização.
-- Apenas o Super Admin tem acesso a todos os perfis do sistema!
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
DROP POLICY IF EXISTS "Ver próprios perfis da organização" ON public.profiles;
DROP POLICY IF EXISTS "Admin gerencia perfis da organização" ON public.profiles;

CREATE POLICY "Ver próprios perfis da organização"
  ON public.profiles FOR SELECT TO authenticated
  USING ((organization_id = auth_user_org_id()) OR is_super_admin() OR (id = auth.uid()));

CREATE POLICY "Admin gerencia perfis da organização"
  ON public.profiles FOR ALL TO authenticated
  USING (((organization_id = auth_user_org_id()) AND (tipo_usuario = 'admin' OR is_admin())) OR is_super_admin() OR (id = auth.uid()))
  WITH CHECK (((organization_id = auth_user_org_id()) AND (tipo_usuario = 'admin' OR is_admin())) OR is_super_admin() OR (id = auth.uid()));

-- 6. RLS permissivo para lead_statuses, lead_sources e lead_segments
DROP POLICY IF EXISTS "Org lê seus statuses" ON public.lead_statuses;
CREATE POLICY "Org lê seus statuses"
  ON public.lead_statuses FOR SELECT TO authenticated
  USING ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Org gerencia seus statuses" ON public.lead_statuses;
CREATE POLICY "Org gerencia seus statuses"
  ON public.lead_statuses FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL)
  WITH CHECK ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Org acessa próprias origens" ON public.lead_sources;
CREATE POLICY "Org acessa próprias origens"
  ON public.lead_sources FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL)
  WITH CHECK ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL);

DROP POLICY IF EXISTS "Org acessa próprios segmentos" ON public.lead_segments;
CREATE POLICY "Org acessa próprios segmentos"
  ON public.lead_segments FOR ALL TO authenticated
  USING ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL)
  WITH CHECK ((organization_id = auth_user_org_id()) OR is_super_admin() OR organization_id IS NULL);

-- 7. Função RPC segura para exclusão atômica de organização
CREATE OR REPLACE FUNCTION public.delete_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas o Super Administrador pode excluir uma organização.';
  END IF;

  -- 1. Desvincula perfis
  UPDATE public.profiles SET organization_id = NULL WHERE organization_id = p_org_id;

  -- 2. Limpa FKs de leads antes de deletar origens e segmentos
  UPDATE public.leads SET origem_id = NULL, segmento_id = NULL, responsavel_id = NULL WHERE organization_id = p_org_id;

  -- 3. Deleta registros filhos dos leads
  DELETE FROM public.lead_notes WHERE organization_id = p_org_id OR lead_id IN (SELECT id FROM public.leads WHERE organization_id = p_org_id);
  DELETE FROM public.lead_activities WHERE organization_id = p_org_id OR lead_id IN (SELECT id FROM public.leads WHERE organization_id = p_org_id);
  DELETE FROM public.lead_status_history WHERE organization_id = p_org_id OR lead_id IN (SELECT id FROM public.leads WHERE organization_id = p_org_id);

  -- 4. Deleta logs de extensão se existirem
  BEGIN
    DELETE FROM public.extension_logs WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 5. Deleta os leads da organização
  DELETE FROM public.leads WHERE organization_id = p_org_id;

  -- 6. Deleta configurações (status, origens, segmentos)
  DELETE FROM public.lead_sources WHERE organization_id = p_org_id;
  DELETE FROM public.lead_segments WHERE organization_id = p_org_id;
  DELETE FROM public.lead_statuses WHERE organization_id = p_org_id;

  -- 7. Deleta a organização
  DELETE FROM public.organizations WHERE id = p_org_id;
END;
$$;

-- 8. Auto-Cura: Promove o primeiro usuário a Super Admin e isola cada perfil em sua própria empresa
DO $$
DECLARE
  r RECORD;
  org_rec RECORD;
  new_org_id uuid;
  first_profile_id uuid;
  first_org_id uuid;
BEGIN
  -- Marca o primeiro usuário criado no sistema como Super Admin
  SELECT id INTO first_profile_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF first_profile_id IS NOT NULL THEN
    UPDATE public.profiles SET is_super_admin = true, tipo_usuario = 'admin' WHERE id = first_profile_id;
  END IF;

  -- Cria a organização principal se não existir
  SELECT id INTO first_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  IF first_org_id IS NULL THEN
    INSERT INTO public.organizations (nome, nome_exibicao, plano, plano_status, max_usuarios, max_leads, plano_inicio, plano_expira_em, plano_valor_recorrente)
    VALUES ('CRM 4U Connect', 'CRM 4U Connect', 'anual', 'ativo', 10, 50000, now(), now() + interval '365 days', 756.00)
    RETURNING id INTO first_org_id;
  END IF;

  -- Garante que todo profile tenha uma organization_id válida
  FOR r IN
    SELECT p.id, p.nome, p.email, p.organization_id, p.is_super_admin
    FROM public.profiles p
    WHERE p.organization_id IS NULL
  LOOP
    IF r.is_super_admin = true THEN
      UPDATE public.profiles SET organization_id = first_org_id WHERE id = r.id;
    ELSE
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
        COALESCE(r.nome, split_part(r.email, '@', 1)),
        COALESCE(r.nome, split_part(r.email, '@', 1)),
        r.nome,
        r.email,
        'mensal',
        'ativo',
        1,
        500,
        now(),
        now() + interval '30 days',
        97.00
      )
      RETURNING id INTO new_org_id;

      UPDATE public.profiles
      SET organization_id = new_org_id,
          tipo_usuario = COALESCE(NULLIF(tipo_usuario, ''), 'atendente')
      WHERE id = r.id;
    END IF;
  END LOOP;

  -- Garante que todas as organizações existentes possuam status, origens e segmentos padrão
  FOR org_rec IN SELECT id FROM public.organizations LOOP
    IF NOT EXISTS (SELECT 1 FROM public.lead_statuses WHERE organization_id = org_rec.id) THEN
      INSERT INTO public.lead_statuses (value, label, color_text, color_bg, color_dot, ordem, ativo, organization_id)
      VALUES
        ('novo_lead',          'Novo lead',           '#475569','#f1f5f9','#94a3b8', 1, true, org_rec.id),
        ('em_atendimento',     'Em atendimento',      '#1d4ed8','#eff6ff','#3b82f6', 2, true, org_rec.id),
        ('aguardando_retorno', 'Aguardando retorno',  '#b45309','#fffbeb','#f59e0b', 3, true, org_rec.id),
        ('proposta_enviada',   'Proposta enviada',    '#6d28d9','#f5f3ff','#8b5cf6', 4, true, org_rec.id),
        ('followup_agendado',  'Follow-up agendado',  '#c2410c','#fff7ed','#f97316', 5, true, org_rec.id),
        ('fechado',            'Fechado',             '#065f46','#ecfdf5','#10b981', 6, true, org_rec.id),
        ('perdido',            'Perdido',             '#dc2626','#fef2f2','#f87171', 7, true, org_rec.id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.lead_sources WHERE organization_id = org_rec.id) THEN
      INSERT INTO public.lead_sources (nome, ativo, organization_id)
      VALUES
        ('WhatsApp', true, org_rec.id),
        ('Instagram', true, org_rec.id),
        ('Facebook', true, org_rec.id),
        ('Google / Site', true, org_rec.id),
        ('Indicação', true, org_rec.id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.lead_segments WHERE organization_id = org_rec.id) THEN
      INSERT INTO public.lead_segments (nome, ativo, organization_id)
      VALUES
        ('Pessoa Física', true, org_rec.id),
        ('Pequena Empresa', true, org_rec.id);
    END IF;
  END LOOP;
END $$;
