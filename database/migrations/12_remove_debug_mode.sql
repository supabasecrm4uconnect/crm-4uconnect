-- ============================================================
-- CRM 4U Connect — Script 12: Remove coluna debug_mode
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Idempotente (pode rodar mais de uma vez sem erro)
-- ============================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS debug_mode;

NOTIFY pgrst, 'reload schema';
