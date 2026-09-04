-- Transfere a titularidade dos 106 leads sem autoria registrada da conta
-- comercial para a conta Julia / Costuras Finas. O critério reproduz a
-- auditoria original: não há autor no histórico de status nem nas atividades.
-- A migration é idempotente: após a primeira execução, não restam candidatos.

BEGIN;

DO $$
DECLARE
  commercial_profile_id uuid;
  commercial_organization_id uuid;
  target_profile_id uuid;
  target_organization_id uuid;
  candidate_count integer;
BEGIN
  SELECT id, organization_id
    INTO commercial_profile_id, commercial_organization_id
  FROM public.profiles
  WHERE lower(email) = lower('comercial@4uconnect.com.br');

  SELECT id, organization_id
    INTO target_profile_id, target_organization_id
  FROM public.profiles
  WHERE lower(email) = lower('julia@gmail.com')
    AND status = 'ativo';

  IF commercial_profile_id IS NULL OR commercial_organization_id IS NULL THEN
    RAISE EXCEPTION 'Perfil comercial de origem não encontrado.';
  END IF;

  IF target_profile_id IS NULL OR target_organization_id IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo de destino julia@gmail.com não encontrado.';
  END IF;

  SELECT count(*)
    INTO candidate_count
  FROM public.leads l
  WHERE l.organization_id = commercial_organization_id
    AND l.responsavel_id = commercial_profile_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.lead_status_history h
      WHERE h.lead_id = l.id
        AND h.alterado_por IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.lead_activities a
      WHERE a.lead_id = l.id
        AND a.criado_por IS NOT NULL
    );

  IF candidate_count NOT IN (0, 106) THEN
    RAISE EXCEPTION
      'Pré-validação falhou: esperados 106 leads sem autoria, encontrados %.',
      candidate_count;
  END IF;
END;
$$;

-- Mantém a timeline visível ao novo tenant. Não existem notas nem atividades
-- nesses leads; apenas registros de status sem autor são realocados.
UPDATE public.lead_status_history h
SET organization_id = target.organization_id
FROM public.profiles commercial
CROSS JOIN public.profiles target
CROSS JOIN public.leads l
WHERE lower(commercial.email) = lower('comercial@4uconnect.com.br')
  AND lower(target.email) = lower('julia@gmail.com')
  AND target.status = 'ativo'
  AND l.id = h.lead_id
  AND l.organization_id = commercial.organization_id
  AND l.responsavel_id = commercial.id
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_status_history authored_status
    WHERE authored_status.lead_id = l.id
      AND authored_status.alterado_por IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_activities authored_activity
    WHERE authored_activity.lead_id = l.id
      AND authored_activity.criado_por IS NOT NULL
  )
  AND h.organization_id IS DISTINCT FROM target.organization_id;

-- A transferência de organização não deve falsificar a data operacional do lead.
ALTER TABLE public.leads DISABLE TRIGGER trg_leads_updated_at;

UPDATE public.leads l
SET organization_id = target.organization_id,
    responsavel_id = target.id
FROM public.profiles commercial
CROSS JOIN public.profiles target
WHERE lower(commercial.email) = lower('comercial@4uconnect.com.br')
  AND lower(target.email) = lower('julia@gmail.com')
  AND target.status = 'ativo'
  AND l.organization_id = commercial.organization_id
  AND l.responsavel_id = commercial.id
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_status_history authored_status
    WHERE authored_status.lead_id = l.id
      AND authored_status.alterado_por IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_activities authored_activity
    WHERE authored_activity.lead_id = l.id
      AND authored_activity.criado_por IS NOT NULL
  );

ALTER TABLE public.leads ENABLE TRIGGER trg_leads_updated_at;

NOTIFY pgrst, 'reload schema';

COMMIT;
