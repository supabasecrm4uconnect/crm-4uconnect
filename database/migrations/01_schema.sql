-- ============================================================
-- CRM 4U Connect — Script 1: Schema Completo
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Execute este script PRIMEIRO no SQL Editor do novo projeto
-- Pode ser executado sem risco (usa IF NOT EXISTS / OR REPLACE)
-- ============================================================


-- =========================================
-- PARTE 1: TABELAS
-- =========================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  email        text NOT NULL,
  tipo_usuario text,
  status       text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  value       text NOT NULL,
  label       text NOT NULL,
  color_text  text,
  color_bg    text,
  color_dot   text,
  ordem       integer,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        text NOT NULL,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.lead_segments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        text NOT NULL,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome             text NOT NULL,
  whatsapp         text NOT NULL,
  foto_url         text,
  origem_id        uuid REFERENCES public.lead_sources(id),
  segmento_id      uuid REFERENCES public.lead_segments(id),
  status           text,
  tags             text[],
  observacao       text,
  responsavel_id   uuid REFERENCES public.profiles(id),
  proximo_followup timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  organization_id  uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo_atividade   text NOT NULL,
  descricao        text,
  data_agendada    date NOT NULL,
  hora_agendada    time without time zone NOT NULL,
  status_atividade text,
  criado_por       uuid REFERENCES public.profiles(id),
  concluido_em     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  organization_id  uuid REFERENCES public.organizations(id)
);

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id        uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo    text NOT NULL,
  alterado_por   uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id)
);


-- =========================================
-- PARTE 2: FUNÇÕES
-- =========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT tipo_usuario = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE((SELECT status = 'ativo' FROM public.profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo_usuario, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'atendente',
    'inativo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    INSERT INTO public.organizations (nome)
    VALUES (NEW.nome)
    RETURNING id INTO new_org_id;
    NEW.organization_id := new_org_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fill_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.lead_statuses (value, label, color_text, color_bg, color_dot, ordem, ativo, organization_id)
  VALUES
    ('novo_lead',          'Novo lead',           '#475569','#f1f5f9','#94a3b8', 1, true, NEW.id),
    ('em_atendimento',     'Em atendimento',      '#1d4ed8','#eff6ff','#3b82f6', 2, true, NEW.id),
    ('aguardando_retorno', 'Aguardando retorno',  '#b45309','#fffbeb','#f59e0b', 3, true, NEW.id),
    ('proposta_enviada',   'Proposta enviada',    '#6d28d9','#f5f3ff','#8b5cf6', 4, true, NEW.id),
    ('followup_agendado',  'Follow-up agendado',  '#c2410c','#fff7ed','#f97316', 5, true, NEW.id),
    ('fechado',            'Fechado',             '#065f46','#ecfdf5','#10b981', 6, true, NEW.id),
    ('perdido',            'Perdido',             '#dc2626','#fef2f2','#f87171', 7, true, NEW.id);

  INSERT INTO public.lead_sources (nome, ativo, organization_id)
  VALUES
    ('WhatsApp',           true, NEW.id),
    ('Instagram',          true, NEW.id),
    ('Facebook',           true, NEW.id),
    ('Google / Site',      true, NEW.id),
    ('Indicação',          true, NEW.id),
    ('LinkedIn',           true, NEW.id),
    ('TikTok',             true, NEW.id),
    ('E-mail',             true, NEW.id),
    ('Ligação / Telefone', true, NEW.id),
    ('Evento / Feira',     true, NEW.id);

  INSERT INTO public.lead_segments (nome, ativo, organization_id)
  VALUES
    ('Pessoa Física',      true, NEW.id),
    ('Pequena Empresa',    true, NEW.id),
    ('Média Empresa',      true, NEW.id),
    ('Grande Empresa',     true, NEW.id),
    ('E-commerce',         true, NEW.id),
    ('Serviços',           true, NEW.id),
    ('Varejo',             true, NEW.id),
    ('Saúde',              true, NEW.id),
    ('Educação',           true, NEW.id),
    ('Construção Civil',   true, NEW.id),
    ('Tecnologia',         true, NEW.id),
    ('Alimentação',        true, NEW.id),
    ('Beleza e Estética',  true, NEW.id),
    ('Imobiliário',        true, NEW.id);

  RETURN NEW;
END;
$$;


-- =========================================
-- PARTE 3: TRIGGERS
-- =========================================

-- updated_at automático
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_activities_updated_at ON public.lead_activities;
CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Novo usuário auth → cria profile automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Novo profile sem org → cria organização automaticamente
DROP TRIGGER IF EXISTS tr_profile_auto_org ON public.profiles;
CREATE TRIGGER tr_profile_auto_org
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_org();

-- Nova organização → semeia statuses, origens e segmentos padrão
DROP TRIGGER IF EXISTS tr_seed_statuses ON public.organizations;
CREATE TRIGGER tr_seed_statuses
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_statuses();

-- fill_org_id para statuses, sources e segments
DROP TRIGGER IF EXISTS tr_fill_org_id ON public.lead_statuses;
CREATE TRIGGER tr_fill_org_id
  BEFORE INSERT ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION fill_org_id();

DROP TRIGGER IF EXISTS tr_fill_org_id ON public.lead_sources;
CREATE TRIGGER tr_fill_org_id
  BEFORE INSERT ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION fill_org_id();

DROP TRIGGER IF EXISTS tr_fill_org_id ON public.lead_segments;
CREATE TRIGGER tr_fill_org_id
  BEFORE INSERT ON public.lead_segments
  FOR EACH ROW EXECUTE FUNCTION fill_org_id();


-- =========================================
-- PARTE 4: ROW LEVEL SECURITY
-- =========================================

ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_segments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

-- organizations
DROP POLICY IF EXISTS "Admin pode inserir org"          ON public.organizations;
DROP POLICY IF EXISTS "Ver própria org"                 ON public.organizations;
DROP POLICY IF EXISTS "Admin pode atualizar própria org" ON public.organizations;

CREATE POLICY "Admin pode inserir org"
  ON public.organizations FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Ver própria org"
  ON public.organizations FOR SELECT TO public
  USING (id = auth_user_org_id());

CREATE POLICY "Admin pode atualizar própria org"
  ON public.organizations FOR UPDATE TO public
  USING (id = auth_user_org_id());

-- profiles
DROP POLICY IF EXISTS "Le proprio perfil ou admin ve todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil"     ON public.profiles;

CREATE POLICY "Le proprio perfil ou admin ve todos"
  ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR is_admin());

CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.profiles FOR UPDATE TO public
  USING (
    (id = auth.uid()) OR
    (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tipo_usuario = 'admin'))
  );

-- leads
DROP POLICY IF EXISTS "Usuário acessa próprios leads" ON public.leads;

CREATE POLICY "Usuário acessa próprios leads"
  ON public.leads FOR ALL TO public
  USING ((responsavel_id = auth.uid()) AND is_active())
  WITH CHECK ((responsavel_id = auth.uid()) AND is_active());

-- lead_statuses
DROP POLICY IF EXISTS "Org lê seus statuses"     ON public.lead_statuses;
DROP POLICY IF EXISTS "Org gerencia seus statuses" ON public.lead_statuses;

CREATE POLICY "Org lê seus statuses"
  ON public.lead_statuses FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org gerencia seus statuses"
  ON public.lead_statuses FOR ALL TO authenticated
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- lead_sources
DROP POLICY IF EXISTS "Org acessa próprias origens" ON public.lead_sources;

CREATE POLICY "Org acessa próprias origens"
  ON public.lead_sources FOR ALL TO public
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- lead_segments
DROP POLICY IF EXISTS "Org acessa próprios segmentos" ON public.lead_segments;

CREATE POLICY "Org acessa próprios segmentos"
  ON public.lead_segments FOR ALL TO public
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- lead_activities
DROP POLICY IF EXISTS "Usuário acessa próprias atividades" ON public.lead_activities;

CREATE POLICY "Usuário acessa próprias atividades"
  ON public.lead_activities FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activities.lead_id
      AND leads.responsavel_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activities.lead_id
      AND leads.responsavel_id = auth.uid()
  ));

-- lead_status_history
DROP POLICY IF EXISTS "Usuário acessa próprio histórico" ON public.lead_status_history;

CREATE POLICY "Usuário acessa próprio histórico"
  ON public.lead_status_history FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_status_history.lead_id
      AND leads.responsavel_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_status_history.lead_id
      AND leads.responsavel_id = auth.uid()
  ));


-- =========================================
-- PARTE 5: REALTIME
-- =========================================

-- Habilita Realtime para a tabela de statuses (usada pelo CRM e extensão)
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_statuses;
