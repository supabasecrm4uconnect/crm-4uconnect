-- ============================================================
-- CRM 4U Connect — Script 6: Corrige notas (lead_notes)
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Rode no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- ------------------------------------------------------------
-- Diagnóstico (pelos erros reais):
--   1º) PGRST204 "Could not find the 'nota' column ..."  → faltava a coluna `nota`.
--   2º) 23502 "null value in column 'conteudo' ... not-null" → a tabela de
--       produção tem uma coluna LEGADA `conteudo` NOT NULL (criada por uma
--       versão antiga, antes do migration_3 — o CREATE TABLE IF NOT EXISTS
--       não alterou a tabela já existente).
--
-- Correção NÃO-DESTRUTIVA (o banco é compartilhado com outro sistema — não
-- dropamos/renomeamos colunas): garante `nota`, traz o texto de `conteudo`
-- para `nota`, e remove o NOT NULL de `conteudo` para o app (que só preenche
-- `nota`) conseguir inserir. `conteudo` é mantida (nullable).
-- ============================================================

-- (Opcional) ver colunas atuais:
-- SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='lead_notes' ORDER BY ordinal_position;

-- 1) Garante a coluna usada pelo app
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS nota text;

-- 2) Se existir a coluna legada `conteudo`: backfill p/ `nota` e remove o NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead_notes' AND column_name = 'conteudo'
  ) THEN
    -- Preserva o texto das notas existentes (que estava em `conteudo`)
    UPDATE public.lead_notes
       SET nota = conteudo
     WHERE (nota IS NULL OR nota = '') AND conteudo IS NOT NULL;

    -- Permite inserts que preenchem só `nota` (o app não conhece `conteudo`)
    ALTER TABLE public.lead_notes ALTER COLUMN conteudo DROP NOT NULL;
  END IF;
END $$;

-- 3) Evita `nota` NULL em linhas antigas
UPDATE public.lead_notes SET nota = COALESCE(nota, '') WHERE nota IS NULL;

-- 4) Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='lead_notes' ORDER BY ordinal_position;
-- → `nota` presente; `conteudo` (se existir) deve estar is_nullable = YES.
-- Depois: adicionar uma nota no CRM deve funcionar.
--
-- (Opcional, FUTURO) Se confirmar que `conteudo` NÃO é usada por nenhum outro
-- sistema neste banco compartilhado, dá para removê-la:
--   ALTER TABLE public.lead_notes DROP COLUMN conteudo;
--   NOTIFY pgrst, 'reload schema';
