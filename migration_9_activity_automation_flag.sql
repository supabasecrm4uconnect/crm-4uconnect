-- Marca atividades criadas pela automação do Pipeline (coluna -> tarefa automática),
-- para permitir checar duplicidade sem bloquear tarefas criadas manualmente.
-- Idempotente — pode ser rodada mais de uma vez sem erro.

ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS criado_automaticamente boolean DEFAULT false;
