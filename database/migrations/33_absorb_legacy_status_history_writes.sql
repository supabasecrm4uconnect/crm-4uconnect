-- Compatibilidade com extensões antigas que, após salvar/atualizar um lead,
-- repetem manualmente o histórico já criado pelos triggers da migration 26.
-- O POST duplicado vira no-op; qualquer escrita manual nova continua proibida.
-- Seguro para reexecução: função, trigger e policy são recriados.

BEGIN;

CREATE OR REPLACE FUNCTION public.absorb_legacy_status_history_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  caller_org_id uuid;
  parent_org_id uuid;
BEGIN
  -- O histórico legítimo nasce dentro de log_lead_status_history(), acionado
  -- por um trigger de leads. Nesse caso a profundidade é maior que 1 e a linha
  -- deve ser persistida normalmente.
  IF pg_trigger_depth() > 1 OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_org_id := public.auth_user_org_id();

  SELECT l.organization_id
    INTO parent_org_id
  FROM public.leads l
  WHERE l.id = NEW.lead_id;

  IF caller_org_id IS NULL
     OR parent_org_id IS NULL
     OR parent_org_id IS DISTINCT FROM caller_org_id
     OR NOT public.is_active() THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Histórico não pertence à organização autenticada.';
  END IF;

  NEW.organization_id := parent_org_id;

  -- A extensão antiga envia a mesma transição logo depois de o trigger de
  -- leads tê-la gravado. Retornar NULL cancela somente esta linha duplicada;
  -- o PostgREST conclui o POST sem erro e a interface segue para o sucesso.
  IF EXISTS (
    SELECT 1
    FROM public.lead_status_history h
    WHERE h.lead_id = NEW.lead_id
      AND h.organization_id = parent_org_id
      AND h.status_anterior IS NOT DISTINCT FROM NEW.status_anterior
      AND h.status_novo IS NOT DISTINCT FROM NEW.status_novo
  ) THEN
    RETURN NULL;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'Histórico de status é gerado exclusivamente pelos triggers de leads.';
END;
$$;

REVOKE ALL ON FUNCTION public.absorb_legacy_status_history_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.absorb_legacy_status_history_insert() FROM anon;
REVOKE ALL ON FUNCTION public.absorb_legacy_status_history_insert() FROM authenticated;

DROP TRIGGER IF EXISTS trg_absorb_legacy_status_history_insert ON public.lead_status_history;
CREATE TRIGGER trg_absorb_legacy_status_history_insert
  BEFORE INSERT ON public.lead_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.absorb_legacy_status_history_insert();

-- A policy permite que o POST alcance o trigger acima. O trigger só aceita a
-- linha automática aninhada ou absorve uma transição idêntica já existente;
-- qualquer tentativa de criar histórico novo gera 42501.
DROP POLICY IF EXISTS "Compatibilidade de histórico para clientes legados"
  ON public.lead_status_history;
CREATE POLICY "Compatibilidade de histórico para clientes legados"
  ON public.lead_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = public.auth_user_org_id()
    AND public.is_active()
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
