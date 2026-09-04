-- Garante que todo status de lead tenha histórico na mesma transação.
-- Evita que falhas de frontend ou RLS deixem o status atual divergente da timeline.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_lead_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NOT NULL THEN
      INSERT INTO public.lead_status_history (
        lead_id, status_anterior, status_novo, alterado_por, organization_id
      ) VALUES (
        NEW.id, NULL, NEW.status, auth.uid(), NEW.organization_id
      );
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_status_history (
      lead_id, status_anterior, status_novo, alterado_por, organization_id
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(), NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_lead_status_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_lead_status_history() FROM anon;
REVOKE ALL ON FUNCTION public.log_lead_status_history() FROM authenticated;

DROP TRIGGER IF EXISTS trg_log_initial_lead_status ON public.leads;
CREATE TRIGGER trg_log_initial_lead_status
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_status_history();

DROP TRIGGER IF EXISTS trg_log_lead_status_change ON public.leads;
CREATE TRIGGER trg_log_lead_status_change
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_status_history();

-- O histórico passa a ser criado somente pelos triggers; a aplicação conserva
-- leitura, atualização de autoria para manutenção e exclusão em cascata.
DROP POLICY IF EXISTS "Membros da organização acessam histórico" ON public.lead_status_history;
DROP POLICY IF EXISTS "Membros da organização leem histórico" ON public.lead_status_history;
DROP POLICY IF EXISTS "Membros da organização atualizam histórico" ON public.lead_status_history;
DROP POLICY IF EXISTS "Membros da organização removem histórico" ON public.lead_status_history;

CREATE POLICY "Membros da organização leem histórico"
  ON public.lead_status_history FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id() AND is_active());

CREATE POLICY "Membros da organização atualizam histórico"
  ON public.lead_status_history FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id() AND is_active())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = auth_user_org_id() AND is_active());

CREATE POLICY "Membros da organização removem histórico"
  ON public.lead_status_history FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = auth_user_org_id() AND is_active());

-- Repara as alterações sem timeline do lote recuperado. Cada linha é criada
-- apenas quando o status atual diverge do último evento, tornando a operação
-- segura para reexecução.
DO $$
BEGIN
  WITH recovered AS (
    SELECT lead_id
    FROM public.lead_ownership_recovery_audit
    WHERE batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
      AND recovered_responsavel_id = (
        SELECT id FROM public.profiles WHERE email = 'leoclecio@outlook.com'
      )
  ), last_history AS (
    SELECT DISTINCT ON (h.lead_id) h.lead_id, h.status_novo
    FROM public.lead_status_history h
    JOIN recovered r ON r.lead_id = h.lead_id
    ORDER BY h.lead_id, h.created_at DESC
  )
  INSERT INTO public.lead_status_history (
    lead_id, status_anterior, status_novo, alterado_por, organization_id, created_at
  )
  SELECT l.id, h.status_novo, l.status, l.responsavel_id, l.organization_id, l.updated_at
  FROM recovered r
  JOIN public.leads l ON l.id = r.lead_id
  JOIN last_history h ON h.lead_id = l.id
  WHERE l.status IS DISTINCT FROM h.status_novo;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
