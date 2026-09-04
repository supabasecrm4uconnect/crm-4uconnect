-- ============================================================
-- Migration 13: Adicionar Departamento na tabela Profiles
-- ============================================================

-- Adiciona a coluna departamento se ainda não existir
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS departamento text DEFAULT 'comercial';

-- Atualiza registros existentes sem departamento
UPDATE public.profiles
SET departamento = 'comercial'
WHERE departamento IS NULL;

-- Garante restrição check idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_departamento_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_departamento_check
    CHECK (departamento IN ('comercial', 'atendimento', 'sdr', 'financeiro', 'gestao'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.departamento IS 'Departamento de atuação do colaborador: comercial, atendimento, sdr, financeiro, gestao';
