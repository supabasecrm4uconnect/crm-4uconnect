-- ====================================================================
-- Script: Exclusão Definitiva de Contas de Teste
-- E-mails: bruno@gmail.com, teste@gmail.com, lsystem.mobile@gmail.com
-- ====================================================================

DO $$
DECLARE
  target_emails text[] := ARRAY[
    'bruno@gmail.com',
    'teste@gmail.com',
    'lsystem.mobile@gmail.com'
  ];
  usr_id uuid;
  org_id uuid;
  em text;
BEGIN
  FOREACH em IN ARRAY target_emails LOOP
    -- 1. Localiza o ID do usuário no auth.users ou profiles
    SELECT id INTO usr_id FROM auth.users WHERE lower(email) = lower(em);

    IF usr_id IS NULL THEN
      SELECT id INTO usr_id FROM public.profiles WHERE lower(email) = lower(em);
    END IF;

    IF usr_id IS NOT NULL THEN
      -- Pega a organization_id se o usuário era o único membro
      SELECT organization_id INTO org_id FROM public.profiles WHERE id = usr_id;

      -- 2. Limpa referências em leads e histórico
      UPDATE public.leads SET responsavel_id = NULL WHERE responsavel_id = usr_id;

      -- Limpa notas (criado_por)
      DELETE FROM public.lead_notes WHERE criado_por = usr_id;

      -- Limpa atividades (criado_por)
      DELETE FROM public.lead_activities WHERE criado_por = usr_id;

      -- Limpa histórico de status (alterado_por)
      UPDATE public.lead_status_history SET alterado_por = NULL WHERE alterado_por = usr_id;

      -- 3. Deleta do schema public (profiles)
      DELETE FROM public.profiles WHERE id = usr_id;

      -- 4. Deleta do schema auth (auth.users) - Remove autenticação, tokens e logins
      DELETE FROM auth.users WHERE id = usr_id;

      -- 5. Se a organização ficou sem nenhum membro e é uma organização de teste criada para esse usuário, limpa a organização
      IF org_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE organization_id = org_id) THEN
          DELETE FROM public.lead_notes WHERE organization_id = org_id;
          DELETE FROM public.lead_activities WHERE organization_id = org_id;
          DELETE FROM public.lead_status_history WHERE organization_id = org_id;
          DELETE FROM public.leads WHERE organization_id = org_id;
          DELETE FROM public.lead_sources WHERE organization_id = org_id;
          DELETE FROM public.lead_segments WHERE organization_id = org_id;
          DELETE FROM public.lead_statuses WHERE organization_id = org_id;
          DELETE FROM public.organizations WHERE id = org_id;
        END IF;
      END IF;

      RAISE NOTICE 'Conta excluída com sucesso: % (ID: %)', em, usr_id;
    ELSE
      RAISE NOTICE 'Conta não encontrada (já excluída): %', em;
    END IF;
  END LOOP;
END $$;
