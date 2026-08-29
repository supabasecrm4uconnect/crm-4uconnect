-- ============================================================
-- CRM 4U Connect — Script 7: Sistema de logs da extensão
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Rode no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- ============================================================

-- 1) Tabela de logs da extensão Chrome
CREATE TABLE IF NOT EXISTS public.extension_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel            text        NOT NULL CHECK (nivel IN ('ERROR', 'WARN', 'INFO')),
  modulo           text        NOT NULL,
  acao             text        NOT NULL,
  mensagem         text        NOT NULL,
  erro_tecnico     text,
  contexto         jsonb,
  versao_extensao  text,
  navegador        text,
  url              text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 2) RLS
ALTER TABLE public.extension_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'extension_logs'
      AND policyname = 'usuarios inserem apenas seus logs'
  ) THEN
    CREATE POLICY "usuarios inserem apenas seus logs"
      ON public.extension_logs FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'extension_logs'
      AND policyname = 'usuarios leem apenas seus logs'
  ) THEN
    CREATE POLICY "usuarios leem apenas seus logs"
      ON public.extension_logs FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_extension_logs_user_id    ON public.extension_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_logs_nivel      ON public.extension_logs(nivel);
CREATE INDEX IF NOT EXISTS idx_extension_logs_created_at ON public.extension_logs(created_at DESC);

-- 4) Coluna debug_mode no perfil do usuário
-- Usada pela página /diagnostico para ativar logs DEBUG na extensão.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS debug_mode boolean NOT NULL DEFAULT false;

-- ============================================================
-- OPCIONAL — pg_cron (requer plano Pro do Supabase)
-- Limpeza automática de logs INFO com mais de 30 dias.
-- Executar manualmente se o plano suportar:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'limpar-logs-info',
--   '0 3 * * *',
--   $cron$
--     DELETE FROM public.extension_logs
--     WHERE nivel = 'INFO'
--       AND created_at < now() - INTERVAL '30 days';
--   $cron$
-- );
-- ============================================================
