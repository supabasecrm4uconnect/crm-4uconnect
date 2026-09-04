-- ============================================================================
-- Migration 21: Deduplicação segura de status, origens e segmentos
--
-- Preserva todos os leads: antes de excluir uma configuração repetida, aponta
-- os leads para o registro canônico (o mais antigo da mesma organização).
-- Ao fim, índices únicos impedem novas cópias equivalentes.
-- ============================================================================

BEGIN;

-- Evita concorrência com uma criação/edição de configuração durante a limpeza.
SELECT pg_advisory_xact_lock(hashtext('crm4u_safe_catalog_deduplication_v1'));

-- Status: o lead guarda o value em texto; normaliza os leads para o value
-- canônico antes de apagar as cópias de configuração.
WITH ranked AS (
  SELECT
    id,
    organization_id,
    value,
    lower(btrim(value)) AS normalized_value,
    first_value(value) OVER catalog_window AS canonical_value,
    row_number() OVER catalog_window AS position
  FROM public.lead_statuses
  WINDOW catalog_window AS (
    PARTITION BY organization_id, lower(btrim(value))
    ORDER BY created_at ASC NULLS LAST, id ASC
  )
), remap AS (
  SELECT organization_id, normalized_value, canonical_value
  FROM ranked
  WHERE position > 1
  GROUP BY organization_id, normalized_value, canonical_value
)
UPDATE public.leads AS lead
SET status = remap.canonical_value
FROM remap
WHERE lead.organization_id IS NOT DISTINCT FROM remap.organization_id
  AND lower(btrim(lead.status)) = remap.normalized_value
  AND lead.status IS DISTINCT FROM remap.canonical_value;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organization_id, lower(btrim(value))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS position
  FROM public.lead_statuses
)
DELETE FROM public.lead_statuses AS duplicate
USING ranked
WHERE duplicate.id = ranked.id
  AND ranked.position > 1;

-- Origens: redireciona as FKs dos leads e só então apaga a cópia.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER catalog_window AS canonical_id,
    row_number() OVER catalog_window AS position
  FROM public.lead_sources
  WINDOW catalog_window AS (
    PARTITION BY organization_id, lower(btrim(nome))
    ORDER BY created_at ASC NULLS LAST, id ASC
  )
), remap AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE position > 1
)
UPDATE public.leads AS lead
SET origem_id = remap.canonical_id
FROM remap
WHERE lead.origem_id = remap.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organization_id, lower(btrim(nome))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS position
  FROM public.lead_sources
)
DELETE FROM public.lead_sources AS duplicate
USING ranked
WHERE duplicate.id = ranked.id
  AND ranked.position > 1;

-- Segmentos: mesma estratégia, preservando cada vínculo de lead.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER catalog_window AS canonical_id,
    row_number() OVER catalog_window AS position
  FROM public.lead_segments
  WINDOW catalog_window AS (
    PARTITION BY organization_id, lower(btrim(nome))
    ORDER BY created_at ASC NULLS LAST, id ASC
  )
), remap AS (
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE position > 1
)
UPDATE public.leads AS lead
SET segmento_id = remap.canonical_id
FROM remap
WHERE lead.segmento_id = remap.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organization_id, lower(btrim(nome))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS position
  FROM public.lead_segments
)
DELETE FROM public.lead_segments AS duplicate
USING ranked
WHERE duplicate.id = ranked.id
  AND ranked.position > 1;

-- Impede reincidência dentro da mesma organização sem afetar outros tenants.
CREATE UNIQUE INDEX IF NOT EXISTS lead_statuses_org_normalized_value_uidx
  ON public.lead_statuses (organization_id, lower(btrim(value)))
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lead_sources_org_normalized_name_uidx
  ON public.lead_sources (organization_id, lower(btrim(nome)))
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lead_segments_org_normalized_name_uidx
  ON public.lead_segments (organization_id, lower(btrim(nome)))
  WHERE organization_id IS NOT NULL;

COMMIT;
