-- ============================================================
-- CRM 4U Connect — Script 3: Correções de Segurança (PRÉ-PRODUÇÃO)
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Rode DEPOIS do migration_1_schema.sql e migration_2_data.sql.
-- Totalmente idempotente (pode rodar mais de uma vez sem risco).
-- ============================================================


-- ============================================================
-- FIX 1 [CRÍTICO] — Escalonamento de privilégio em profiles
-- ------------------------------------------------------------
-- Problema: a policy de UPDATE em profiles permitia que QUALQUER
-- usuário atualizasse a própria linha (id = auth.uid()) SEM
-- restrição de colunas. Ou seja, uma atendente podia fazer:
--   PATCH /rest/v1/profiles?id=eq.<seu_id>
--   { "tipo_usuario": "admin", "status": "ativo" }
-- e (a) se auto-liberar, furando o portão de aprovação, e
-- (b) se auto-promover a admin — passando a LER e EDITAR perfis
-- de TODAS as contas (e-mails/nomes de todos os usuários).
--
-- Correção: trigger que bloqueia alteração de `tipo_usuario` e
-- `status` por quem não é admin. Contexto de serviço (SQL Editor /
-- service_role, onde auth.uid() é NULL) continua liberado para
-- permitir promover o primeiro admin manualmente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (NEW.tipo_usuario IS DISTINCT FROM OLD.tipo_usuario)
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    -- auth.uid() IS NULL  → contexto de serviço (SQL Editor/service_role): permitido (bootstrap)
    -- is_admin()          → admin autenticado: permitido
    -- caso contrário      → bloqueia (atendente comum tentando se promover/liberar)
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar tipo_usuario ou status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_privileges ON public.profiles;
CREATE TRIGGER tr_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- Restringe a policy de UPDATE ao papel `authenticated` (anon não precisa)
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON public.profiles;
CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING ( (id = auth.uid()) OR public.is_admin() )
  WITH CHECK ( (id = auth.uid()) OR public.is_admin() );


-- ============================================================
-- FIX 2 [MÉDIO] — Tabela lead_notes ausente no schema
-- ------------------------------------------------------------
-- O front-end (aba "Notas" do LeadDrawer) lê e grava em
-- public.lead_notes, mas a tabela não existe no migration_1.
-- Sem ela, a funcionalidade de notas falha silenciosamente.
-- Criamos a tabela com RLS no MESMO modelo de isolamento dos
-- leads (só o responsável pelo lead acessa as notas dele).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  nota        text NOT NULL,
  criado_por  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário acessa próprias notas" ON public.lead_notes;
CREATE POLICY "Usuário acessa próprias notas"
  ON public.lead_notes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_notes.lead_id
      AND leads.responsavel_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_notes.lead_id
      AND leads.responsavel_id = auth.uid()
  ));


-- ============================================================
-- FIX 3 [BAIXO] — Restringe escrita anônima em organizations
-- ------------------------------------------------------------
-- A policy de INSERT estava como TO public WITH CHECK (true),
-- permitindo que um cliente ANÔNIMO (anon key) inserisse linhas
-- em organizations (poluição de dados). A criação de org legítima
-- acontece via trigger handle_new_profile_org (SECURITY DEFINER),
-- que ignora RLS — então restringir para `authenticated` não
-- quebra o cadastro.
-- ============================================================

DROP POLICY IF EXISTS "Admin pode inserir org" ON public.organizations;
CREATE POLICY "Admin pode inserir org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================
-- FIX 4 [MÉDIO/ESTABILIDADE] — Realtime das tabelas do CRM
-- ------------------------------------------------------------
-- O front-end assina mudanças em tempo real (badges "ao vivo",
-- pipeline, follow-ups) em leads, lead_activities,
-- lead_status_history e lead_notes. O migration_1 só adicionou
-- lead_statuses à publicação supabase_realtime — sem isto, as
-- atualizações ao vivo não chegam. RLS continua aplicada ao
-- realtime (cada usuário só recebe o que pode ler).
-- ============================================================

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY['leads','lead_activities','lead_status_history','lead_notes'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- VERIFICAÇÃO (opcional) — rode para conferir o resultado
-- ============================================================
-- SELECT tablename, policyname, cmd, roles
--   FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
-- SELECT tablename FROM pg_publication_tables
--   WHERE pubname='supabase_realtime' AND schemaname='public' ORDER BY tablename;
