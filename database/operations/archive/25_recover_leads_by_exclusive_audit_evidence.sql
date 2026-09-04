-- Recupera leads atribuídos indevidamente à organização comercial.
-- Critério conservador: somente leads com autoria exclusiva no histórico de
-- status ou nas atividades são movidos. Nenhum lead sem evidência é alterado.

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

DROP POLICY IF EXISTS "Membros da organização leem auditoria de recuperação" ON public.lead_ownership_recovery_audit;
CREATE POLICY "Membros da organização leem auditoria de recuperação"
  ON public.lead_ownership_recovery_audit
  FOR SELECT
  TO authenticated
  USING (organization_id = auth_user_org_id());

DO $$
DECLARE
  recovery_batch constant uuid := 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11';
  existing_audit_count integer;
  candidate_count integer;
  leoc_count integer;
  lucas_count integer;
  katia_count integer;
BEGIN
  SELECT count(*) INTO existing_audit_count
  FROM public.lead_ownership_recovery_audit
  WHERE batch_id = recovery_batch;

  IF existing_audit_count NOT IN (0, 220) THEN
    RAISE EXCEPTION 'Auditoria de recuperação inconsistente: % registros.', existing_audit_count;
  END IF;

  IF existing_audit_count = 0 THEN
    WITH evidences AS (
      SELECT lead_id, alterado_por AS profile_id
      FROM public.lead_status_history
      WHERE alterado_por IS NOT NULL
      UNION
      SELECT lead_id, criado_por AS profile_id
      FROM public.lead_activities
      WHERE criado_por IS NOT NULL
    ), evidence_per_lead AS (
      SELECT lead_id, count(*) AS profile_count
      FROM evidences
      GROUP BY lead_id
    ), candidates AS (
      SELECT l.id, target.id AS target_profile_id, target.organization_id AS target_org_id
      FROM public.leads l
      JOIN evidences e ON e.lead_id = l.id
      JOIN evidence_per_lead ep ON ep.lead_id = l.id AND ep.profile_count = 1
      JOIN public.profiles target ON target.id = e.profile_id
      JOIN public.profiles commercial ON commercial.email = 'comercial@4uconnect.com.br'
      WHERE target.email IN (
        'leoclecio@outlook.com',
        'comercial@immovicontabilidade.com.br',
        'comercial@contabilizandodigital.com.br'
      )
        AND l.organization_id = commercial.organization_id
        AND l.responsavel_id = commercial.id
    )
    SELECT
      count(*),
      count(*) FILTER (WHERE target_profile_id = (SELECT id FROM public.profiles WHERE email = 'leoclecio@outlook.com')),
      count(*) FILTER (WHERE target_profile_id = (SELECT id FROM public.profiles WHERE email = 'comercial@immovicontabilidade.com.br')),
      count(*) FILTER (WHERE target_profile_id = (SELECT id FROM public.profiles WHERE email = 'comercial@contabilizandodigital.com.br'))
    INTO candidate_count, leoc_count, lucas_count, katia_count
    FROM candidates;

    IF candidate_count <> 220 OR leoc_count <> 41 OR lucas_count <> 176 OR katia_count <> 3 THEN
      RAISE EXCEPTION 'Pré-validação falhou: total %, Leoclecio %, Lucas %, Kátia %.', candidate_count, leoc_count, lucas_count, katia_count;
    END IF;

    INSERT INTO public.lead_ownership_recovery_audit (
      batch_id, lead_id, organization_id, previous_organization_id,
      previous_responsavel_id, recovered_responsavel_id, evidence, snapshot
    )
    WITH evidences AS (
      SELECT lead_id, alterado_por AS profile_id
      FROM public.lead_status_history
      WHERE alterado_por IS NOT NULL
      UNION
      SELECT lead_id, criado_por AS profile_id
      FROM public.lead_activities
      WHERE criado_por IS NOT NULL
    ), evidence_per_lead AS (
      SELECT lead_id, count(*) AS profile_count
      FROM evidences
      GROUP BY lead_id
    )
    SELECT
      recovery_batch,
      l.id,
      target.organization_id,
      l.organization_id,
      l.responsavel_id,
      target.id,
      'autoria_exclusiva_em_historico_ou_atividade',
      jsonb_build_object(
        'status', l.status,
        'origem_id', l.origem_id,
        'segmento_id', l.segmento_id,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      )
    FROM public.leads l
    JOIN evidences e ON e.lead_id = l.id
    JOIN evidence_per_lead ep ON ep.lead_id = l.id AND ep.profile_count = 1
    JOIN public.profiles target ON target.id = e.profile_id
    JOIN public.profiles commercial ON commercial.email = 'comercial@4uconnect.com.br'
    WHERE target.email IN (
      'leoclecio@outlook.com',
      'comercial@immovicontabilidade.com.br',
      'comercial@contabilizandodigital.com.br'
    )
      AND l.organization_id = commercial.organization_id
      AND l.responsavel_id = commercial.id;
  END IF;
END;
$$;

-- Replica somente as configurações necessárias que ainda não existem no tenant
-- de destino. As configurações existentes nunca são sobrescritas.
WITH required_statuses AS (
  SELECT DISTINCT a.organization_id, source_status.value, source_status.label,
    source_status.color_text, source_status.color_bg, source_status.color_dot,
    source_status.ordem, source_status.ativo
  FROM public.lead_ownership_recovery_audit a
  JOIN public.leads l ON l.id = a.lead_id
  JOIN public.profiles commercial ON commercial.email = 'comercial@4uconnect.com.br'
  JOIN public.lead_statuses source_status
    ON source_status.organization_id = commercial.organization_id
   AND lower(btrim(source_status.value)) = lower(btrim(l.status))
  WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
)
INSERT INTO public.lead_statuses (organization_id, value, label, color_text, color_bg, color_dot, ordem, ativo)
SELECT rs.organization_id, rs.value, rs.label, rs.color_text, rs.color_bg, rs.color_dot, rs.ordem, rs.ativo
FROM required_statuses rs
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_statuses target_status
  WHERE target_status.organization_id = rs.organization_id
    AND lower(btrim(target_status.value)) = lower(btrim(rs.value))
);

WITH required_sources AS (
  SELECT DISTINCT a.organization_id, source_source.nome, source_source.ativo
  FROM public.lead_ownership_recovery_audit a
  JOIN public.leads l ON l.id = a.lead_id
  JOIN public.lead_sources source_source ON source_source.id = l.origem_id
  WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
)
INSERT INTO public.lead_sources (organization_id, nome, ativo)
SELECT rs.organization_id, rs.nome, rs.ativo
FROM required_sources rs
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_sources target_source
  WHERE target_source.organization_id = rs.organization_id
    AND lower(btrim(target_source.nome)) = lower(btrim(rs.nome))
);

WITH required_segments AS (
  SELECT DISTINCT a.organization_id, source_segment.nome, source_segment.ativo
  FROM public.lead_ownership_recovery_audit a
  JOIN public.leads l ON l.id = a.lead_id
  JOIN public.lead_segments source_segment ON source_segment.id = l.segmento_id
  WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
)
INSERT INTO public.lead_segments (organization_id, nome, ativo)
SELECT rs.organization_id, rs.nome, rs.ativo
FROM required_segments rs
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_segments target_segment
  WHERE target_segment.organization_id = rs.organization_id
    AND lower(btrim(target_segment.nome)) = lower(btrim(rs.nome))
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lead_ownership_recovery_audit a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
      AND l.status IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_statuses target_status
        WHERE target_status.organization_id = a.organization_id
          AND lower(btrim(target_status.value)) = lower(btrim(l.status))
      )
  ) THEN
    RAISE EXCEPTION 'Status sem configuração correspondente no tenant de destino.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lead_ownership_recovery_audit a
    JOIN public.leads l ON l.id = a.lead_id
    JOIN public.lead_sources source_source ON source_source.id = l.origem_id
    WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_sources target_source
        WHERE target_source.organization_id = a.organization_id
          AND lower(btrim(target_source.nome)) = lower(btrim(source_source.nome))
      )
  ) THEN
    RAISE EXCEPTION 'Origem sem configuração correspondente no tenant de destino.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lead_ownership_recovery_audit a
    JOIN public.leads l ON l.id = a.lead_id
    JOIN public.lead_segments source_segment ON source_segment.id = l.segmento_id
    WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_segments target_segment
        WHERE target_segment.organization_id = a.organization_id
          AND lower(btrim(target_segment.nome)) = lower(btrim(source_segment.nome))
      )
  ) THEN
    RAISE EXCEPTION 'Segmento sem configuração correspondente no tenant de destino.';
  END IF;
END;
$$;

-- Impede uma alteração de organização de mascarar a data original de criação
-- ou atualização do lead/atividade.
ALTER TABLE public.leads DISABLE TRIGGER trg_leads_updated_at;
ALTER TABLE public.lead_activities DISABLE TRIGGER trg_activities_updated_at;

UPDATE public.leads l
SET organization_id = a.organization_id,
    responsavel_id = a.recovered_responsavel_id,
    origem_id = COALESCE((
      SELECT target_source.id
      FROM public.lead_sources source_source
      JOIN public.lead_sources target_source
        ON target_source.organization_id = a.organization_id
       AND lower(btrim(target_source.nome)) = lower(btrim(source_source.nome))
      WHERE source_source.id = l.origem_id
      LIMIT 1
    ), l.origem_id),
    segmento_id = COALESCE((
      SELECT target_segment.id
      FROM public.lead_segments source_segment
      JOIN public.lead_segments target_segment
        ON target_segment.organization_id = a.organization_id
       AND lower(btrim(target_segment.nome)) = lower(btrim(source_segment.nome))
      WHERE source_segment.id = l.segmento_id
      LIMIT 1
    ), l.segmento_id)
FROM public.lead_ownership_recovery_audit a
WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
  AND l.id = a.lead_id
  AND l.organization_id = a.previous_organization_id;

UPDATE public.lead_activities activity
SET organization_id = a.organization_id
FROM public.lead_ownership_recovery_audit a
WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
  AND activity.lead_id = a.lead_id
  AND activity.organization_id IS DISTINCT FROM a.organization_id;

UPDATE public.lead_notes note
SET organization_id = a.organization_id
FROM public.lead_ownership_recovery_audit a
WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
  AND note.lead_id = a.lead_id
  AND note.organization_id IS DISTINCT FROM a.organization_id;

UPDATE public.lead_status_history history
SET organization_id = a.organization_id
FROM public.lead_ownership_recovery_audit a
WHERE a.batch_id = 'a4f2c95d-36e9-48c4-9ab8-1794fc2c3c11'
  AND history.lead_id = a.lead_id
  AND history.organization_id IS DISTINCT FROM a.organization_id;

ALTER TABLE public.lead_activities ENABLE TRIGGER trg_activities_updated_at;
ALTER TABLE public.leads ENABLE TRIGGER trg_leads_updated_at;

NOTIFY pgrst, 'reload schema';

COMMIT;
