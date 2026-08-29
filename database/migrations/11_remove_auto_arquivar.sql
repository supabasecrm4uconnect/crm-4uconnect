-- Remove a função de arquivamento automático (cron diário + RPC arquivar_leads_inativos()),
-- removida do produto — arquivamento de leads volta a ser sempre manual.
-- Idempotente — pode ser rodada mais de uma vez sem erro.

DROP FUNCTION IF EXISTS public.arquivar_leads_inativos();

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS auto_arquivar_dias;
