-- Dashboard v2: motivo de perda por lead (captura ao mover/marcar como Perdido).
-- Idempotente — pode ser rodada mais de uma vez sem erro.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS motivo_perda text;
