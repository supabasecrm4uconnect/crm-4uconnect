-- Estrutura reutilizavel para registrar recuperacoes de titularidade de leads.
-- Operacoes pontuais de recuperacao pertencem a database/operations/ e nunca
-- devem fazer parte da sequencia automatica de migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_ownership_recovery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  previous_organization_id uuid REFERENCES public.organizations(id),
  previous_responsavel_id uuid REFERENCES public.profiles(id),
  recovered_responsavel_id uuid NOT NULL REFERENCES public.profiles(id),
  evidence text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  moved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, lead_id)
);

ALTER TABLE public.lead_ownership_recovery_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da organização leem auditoria de recuperação"
  ON public.lead_ownership_recovery_audit;
DROP POLICY IF EXISTS "Organization members read lead ownership recovery audit"
  ON public.lead_ownership_recovery_audit;

CREATE POLICY "Organization members read lead ownership recovery audit"
  ON public.lead_ownership_recovery_audit
  FOR SELECT
  TO authenticated
  USING (organization_id = auth_user_org_id());

NOTIFY pgrst, 'reload schema';

COMMIT;
