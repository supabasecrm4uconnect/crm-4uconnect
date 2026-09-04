-- Exclusao definitiva, auditada e restrita das contas Julia / Costuras Finas
-- e Conta Teste. Este script nao usa apenas o e-mail como criterio: os UUIDs
-- imutaveis de usuarios e organizacoes precisam coincidir com a auditoria de
-- producao realizada em 04/09/2026.
--
-- A operacao inteira ocorre em um unico DO atomico. Qualquer divergencia nas
-- travas de seguranca levanta uma excecao e desfaz todas as exclusoes.

DO $migration$
DECLARE
  julia_user_id constant uuid := '2ea70db6-f385-47c7-ab65-c1e399bd0e42';
  teste_user_id constant uuid := '500a51c6-2767-4be1-86ee-a321b3797359';
  julia_org_id constant uuid := '489464f4-f828-448c-aa57-7bda92801936';
  teste_org_id constant uuid := 'a3cada67-2f69-47e1-a025-bd87316b50d0';
  target_user_ids constant uuid[] := ARRAY[julia_user_id, teste_user_id];
  target_org_ids constant uuid[] := ARRAY[julia_org_id, teste_org_id];

  other_leads_before bigint;
  other_profiles_before bigint;
  other_organizations_before bigint;
  other_activities_before bigint;
  other_notes_before bigint;
  other_history_before bigint;
  other_audit_before bigint;
  other_logs_before bigint;

  deleted_leads bigint;
  deleted_profiles bigint;
  deleted_organizations bigint;
  deleted_users bigint;
BEGIN
  -- Idempotencia: depois de uma aplicacao concluida, uma nova execucao nao faz nada.
  IF NOT EXISTS (
       SELECT 1 FROM auth.users
       WHERE id = ANY(target_user_ids)
          OR lower(email) IN ('julia@gmail.com', 'teste@gmail.com')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = ANY(target_user_ids)
          OR lower(email) IN ('julia@gmail.com', 'teste@gmail.com')
          OR organization_id = ANY(target_org_ids)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.organizations WHERE id = ANY(target_org_ids)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.leads WHERE organization_id = ANY(target_org_ids)
     ) THEN
    RAISE NOTICE 'Contas Julia e Teste ja foram removidas; nenhuma alteracao realizada.';
    RETURN;
  END IF;

  -- Congela somente as linhas alvo enquanto a auditoria e a exclusao ocorrem.
  -- As FKs fazem novos registros dependentes aguardarem estes locks; o Storage,
  -- que nao possui FK para auth.users, recebe um lock curto de escrita.
  PERFORM id
  FROM auth.users
  WHERE id = ANY(target_user_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.organizations
  WHERE id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.profiles
  WHERE id = ANY(target_user_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.leads
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_statuses
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_sources
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_segments
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_activities
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_notes
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  PERFORM id
  FROM public.lead_status_history
  WHERE organization_id = ANY(target_org_ids)
  FOR UPDATE;

  LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;

  -- Identidade exata: impede apagar uma conta futura que reutilize o mesmo e-mail.
  IF (SELECT count(*) FROM auth.users
      WHERE lower(email) IN ('julia@gmail.com', 'teste@gmail.com')) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM auth.users
       WHERE id = julia_user_id AND lower(email) = 'julia@gmail.com'
     )
     OR NOT EXISTS (
       SELECT 1 FROM auth.users
       WHERE id = teste_user_id AND lower(email) = 'teste@gmail.com'
     ) THEN
    RAISE EXCEPTION 'Abortado: usuarios Auth nao coincidem exatamente com a auditoria.';
  END IF;

  IF (SELECT count(*) FROM public.profiles WHERE id = ANY(target_user_ids)) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = julia_user_id
         AND lower(email) = 'julia@gmail.com'
         AND organization_id = julia_org_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = teste_user_id
         AND lower(email) = 'teste@gmail.com'
         AND organization_id = teste_org_id
     ) THEN
    RAISE EXCEPTION 'Abortado: perfis ou organizacoes nao coincidem com a auditoria.';
  END IF;

  IF (SELECT count(*) FROM public.organizations WHERE id = ANY(target_org_ids)) <> 2 THEN
    RAISE EXCEPTION 'Abortado: as duas organizacoes auditadas nao foram encontradas.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE organization_id = ANY(target_org_ids)
      AND NOT (id = ANY(target_user_ids))
  ) THEN
    RAISE EXCEPTION 'Abortado: uma organizacao alvo possui outro membro.';
  END IF;

  -- Snapshot exato auditado em producao.
  IF (SELECT count(*) FROM public.leads WHERE organization_id = julia_org_id) <> 106
     OR (SELECT count(*) FROM public.leads WHERE organization_id = teste_org_id) <> 0
     OR EXISTS (
       SELECT 1 FROM public.leads
       WHERE organization_id = julia_org_id
         AND responsavel_id IS DISTINCT FROM julia_user_id
     ) THEN
    RAISE EXCEPTION 'Abortado: a quantidade ou titularidade dos leads mudou desde a auditoria.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leads
    WHERE responsavel_id = ANY(target_user_ids)
      AND (organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids)))
  ) THEN
    RAISE EXCEPTION 'Abortado: usuario alvo possui lead fora das organizacoes alvo.';
  END IF;

  IF (SELECT count(*) FROM public.lead_activities
      WHERE lead_id IN (
        SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
      )) <> 0
     OR (SELECT count(*) FROM public.lead_notes
         WHERE lead_id IN (
           SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
         )) <> 0
     OR (SELECT count(*) FROM public.lead_status_history
         WHERE lead_id IN (
           SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
         )) <> 138
     OR (SELECT count(*) FROM public.lead_ownership_recovery_audit
         WHERE lead_id IN (
           SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
         )) <> 0 THEN
    RAISE EXCEPTION 'Abortado: dependencias dos leads mudaram desde a auditoria.';
  END IF;

  IF (SELECT count(*) FROM public.lead_statuses
      WHERE organization_id = ANY(target_org_ids)) <> 14
     OR (SELECT count(*) FROM public.lead_sources
         WHERE organization_id = ANY(target_org_ids)) <> 20
     OR (SELECT count(*) FROM public.lead_segments
         WHERE organization_id = ANY(target_org_ids)) <> 28 THEN
    RAISE EXCEPTION 'Abortado: catalogos das organizacoes mudaram desde a auditoria.';
  END IF;

  -- Nenhum filho de lead pode atravessar a fronteira de tenant em qualquer direcao.
  IF EXISTS (
    SELECT 1
    FROM public.lead_activities a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE (l.organization_id = ANY(target_org_ids))
          IS DISTINCT FROM (a.organization_id = ANY(target_org_ids))
  )
  OR EXISTS (
    SELECT 1
    FROM public.lead_notes n
    JOIN public.leads l ON l.id = n.lead_id
    WHERE (l.organization_id = ANY(target_org_ids))
          IS DISTINCT FROM (n.organization_id = ANY(target_org_ids))
  )
  OR EXISTS (
    SELECT 1
    FROM public.lead_status_history h
    JOIN public.leads l ON l.id = h.lead_id
    WHERE (l.organization_id = ANY(target_org_ids))
          IS DISTINCT FROM (h.organization_id = ANY(target_org_ids))
  ) THEN
    RAISE EXCEPTION 'Abortado: existe dependencia de lead com tenant divergente.';
  END IF;

  -- Nao tocar em autoria ou auditoria de leads externos.
  IF EXISTS (
    SELECT 1 FROM public.lead_activities
    WHERE criado_por = ANY(target_user_ids)
      AND lead_id NOT IN (
        SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.lead_notes
    WHERE criado_por = ANY(target_user_ids)
      AND lead_id NOT IN (
        SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.lead_status_history
    WHERE alterado_por = ANY(target_user_ids)
      AND lead_id NOT IN (
        SELECT id FROM public.leads WHERE organization_id = ANY(target_org_ids)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.lead_ownership_recovery_audit
    WHERE previous_responsavel_id = ANY(target_user_ids)
       OR recovered_responsavel_id = ANY(target_user_ids)
       OR organization_id = ANY(target_org_ids)
       OR previous_organization_id = ANY(target_org_ids)
  ) THEN
    RAISE EXCEPTION 'Abortado: existe autoria ou auditoria vinculada a dados externos.';
  END IF;

  -- Catalogos alvo nao podem estar sendo usados por leads de outro tenant.
  IF EXISTS (
    SELECT 1 FROM public.leads l
    WHERE (l.organization_id IS NULL OR NOT (l.organization_id = ANY(target_org_ids)))
      AND l.origem_id IN (
        SELECT id FROM public.lead_sources WHERE organization_id = ANY(target_org_ids)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE (l.organization_id IS NULL OR NOT (l.organization_id = ANY(target_org_ids)))
      AND l.segmento_id IN (
        SELECT id FROM public.lead_segments WHERE organization_id = ANY(target_org_ids)
      )
  ) THEN
    RAISE EXCEPTION 'Abortado: catalogo alvo e referenciado por lead externo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM storage.objects WHERE owner_id = ANY(
      ARRAY[julia_user_id::text, teste_user_id::text]
    )
  ) THEN
    RAISE EXCEPTION 'Abortado: usuario alvo possui objetos no Storage; use a Storage API.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.extension_logs WHERE user_id = ANY(target_user_ids)
  ) THEN
    RAISE EXCEPTION 'Abortado: logs da extensao mudaram desde a auditoria.';
  END IF;

  -- Baseline de todos os registros fora do escopo. Deve permanecer identico.
  SELECT count(*) INTO other_leads_before
  FROM public.leads
  WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids));

  SELECT count(*) INTO other_profiles_before
  FROM public.profiles
  WHERE NOT (id = ANY(target_user_ids));

  SELECT count(*) INTO other_organizations_before
  FROM public.organizations
  WHERE NOT (id = ANY(target_org_ids));

  SELECT count(*) INTO other_activities_before
  FROM public.lead_activities
  WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids));

  SELECT count(*) INTO other_notes_before
  FROM public.lead_notes
  WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids));

  SELECT count(*) INTO other_history_before
  FROM public.lead_status_history
  WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids));

  SELECT count(*) INTO other_audit_before
  FROM public.lead_ownership_recovery_audit;

  SELECT count(*) INTO other_logs_before
  FROM public.extension_logs
  WHERE NOT (user_id = ANY(target_user_ids));

  -- Exclusoes limitadas exclusivamente aos UUIDs validados acima.
  DELETE FROM public.leads
  WHERE organization_id = ANY(target_org_ids);
  GET DIAGNOSTICS deleted_leads = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = ANY(target_user_ids);
  GET DIAGNOSTICS deleted_profiles = ROW_COUNT;

  DELETE FROM public.organizations
  WHERE id = ANY(target_org_ids);
  GET DIAGNOSTICS deleted_organizations = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id = ANY(target_user_ids);
  GET DIAGNOSTICS deleted_users = ROW_COUNT;

  IF deleted_leads <> 106
     OR deleted_profiles <> 2
     OR deleted_organizations <> 2
     OR deleted_users <> 2 THEN
    RAISE EXCEPTION
      'Abortado: contagens excluidas inesperadas (leads %, perfis %, orgs %, auth %).',
      deleted_leads, deleted_profiles, deleted_organizations, deleted_users;
  END IF;

  -- Pos-validacao: nada alvo pode sobreviver e nada externo pode diminuir.
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = ANY(target_user_ids)
       OR lower(email) IN ('julia@gmail.com', 'teste@gmail.com')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY(target_user_ids)
       OR lower(email) IN ('julia@gmail.com', 'teste@gmail.com')
       OR organization_id = ANY(target_org_ids)
  )
  OR EXISTS (SELECT 1 FROM public.organizations WHERE id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.leads WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_statuses WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_sources WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_segments WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_activities WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_notes WHERE organization_id = ANY(target_org_ids))
  OR EXISTS (SELECT 1 FROM public.lead_status_history WHERE organization_id = ANY(target_org_ids)) THEN
    RAISE EXCEPTION 'Abortado: a pos-validacao encontrou registros alvo remanescentes.';
  END IF;

  IF other_leads_before <> (
       SELECT count(*) FROM public.leads
       WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids))
     )
     OR other_profiles_before <> (
       SELECT count(*) FROM public.profiles WHERE NOT (id = ANY(target_user_ids))
     )
     OR other_organizations_before <> (
       SELECT count(*) FROM public.organizations WHERE NOT (id = ANY(target_org_ids))
     )
     OR other_activities_before <> (
       SELECT count(*) FROM public.lead_activities
       WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids))
     )
     OR other_notes_before <> (
       SELECT count(*) FROM public.lead_notes
       WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids))
     )
     OR other_history_before <> (
       SELECT count(*) FROM public.lead_status_history
       WHERE organization_id IS NULL OR NOT (organization_id = ANY(target_org_ids))
     )
     OR other_audit_before <> (SELECT count(*) FROM public.lead_ownership_recovery_audit)
     OR other_logs_before <> (
       SELECT count(*) FROM public.extension_logs
       WHERE NOT (user_id = ANY(target_user_ids))
     ) THEN
    RAISE EXCEPTION 'Abortado: a contagem de registros externos foi alterada.';
  END IF;

  RAISE NOTICE
    'Exclusao concluida: 2 contas Auth, 2 perfis, 2 organizacoes, 106 leads e 138 eventos de status removidos; dados externos preservados.';
END;
$migration$;
