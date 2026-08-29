-- Remove permissao global indevida e reafirma o isolamento de leads por organizacao.
-- Seguro para reexecucao: nao altera registros de leads.

BEGIN;

DROP POLICY IF EXISTS "Acesso aos leads" ON public.leads;
DROP POLICY IF EXISTS "Membros da organização acessam leads" ON public.leads;

CREATE POLICY "Membros da organização acessam leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth_user_org_id()
    AND is_active()
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
