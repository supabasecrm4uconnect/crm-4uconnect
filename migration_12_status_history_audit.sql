-- Auditoria confiável de status para relatórios de fechamento.
-- Segura para produção: não altera, remove ou preenche nenhuma linha existente.
-- Após aplicada, cada criação/mudança de status registra um único evento no histórico.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_lead_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Marca o INSERT interno para o gatilho de proteção abaixo.
  PERFORM set_config('app.lead_status_history_source', 'trigger', true);

  IF TG_OP = 'INSERT' THEN
    IF NULLIF(btrim(NEW.status), '') IS NOT NULL THEN
      INSERT INTO public.lead_status_history (
        lead_id,
        status_anterior,
        status_novo,
        alterado_por,
        organization_id
      ) VALUES (
        NEW.id,
        NULL,
        NEW.status,
        auth.uid(),
        NEW.organization_id
      );
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
    AND NULLIF(btrim(NEW.status), '') IS NOT NULL THEN
    INSERT INTO public.lead_status_history (
      lead_id,
      status_anterior,
      status_novo,
      alterado_por,
      organization_id
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NEW.organization_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Extensões antigas ainda enviam um INSERT manual logo após atualizar o lead.
-- O status já terá sido auditado pelo gatilho acima; ignorar esse segundo INSERT
-- preserva uma única linha de histórico e não gera erro no cliente legado.
CREATE OR REPLACE FUNCTION public.allow_automatic_lead_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF current_setting('app.lead_status_history_source', true) = 'trigger' THEN
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_allow_automatic_lead_status_history ON public.lead_status_history;

CREATE TRIGGER trg_allow_automatic_lead_status_history
  BEFORE INSERT ON public.lead_status_history
  FOR EACH ROW EXECUTE FUNCTION public.allow_automatic_lead_status_history();

DROP TRIGGER IF EXISTS trg_leads_status_history ON public.leads;

CREATE TRIGGER trg_leads_status_history
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.record_lead_status_history();

REVOKE ALL ON FUNCTION public.record_lead_status_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allow_automatic_lead_status_history() FROM PUBLIC;

COMMIT;
