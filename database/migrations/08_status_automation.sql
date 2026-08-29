-- Automação de tarefas ao mover lead entre colunas do Pipeline.
-- Idempotente — pode ser rodada mais de uma vez sem erro.

ALTER TABLE public.lead_statuses
  ADD COLUMN IF NOT EXISTS auto_task_enabled   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_task_tipo      text,
  ADD COLUMN IF NOT EXISTS auto_task_dias      integer,
  ADD COLUMN IF NOT EXISTS auto_task_descricao text;
