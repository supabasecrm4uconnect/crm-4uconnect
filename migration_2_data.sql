-- ============================================================
-- CRM 4U Connect — Script 2: Seed FICTÍCIO (dev / ambiente novo)
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Execute APÓS o migration_1_schema.sql.
--
-- ⚠️ DADOS FICTÍCIOS — este arquivo NÃO contém dados reais (privacidade).
--    A produção já foi populada separadamente; NÃO re-execute em produção.
--    Use apenas para subir um ambiente novo / desenvolvimento.
--
-- Usa SET session_replication_role = replica para desativar triggers e FK
-- checks durante a inserção (volta ao normal no final com SET = DEFAULT).
-- Após executar: use "Esqueci minha senha" para definir a senha dos usuários.
-- ============================================================


-- Desativa triggers e FK checks temporariamente
SET session_replication_role = replica;


-- =========================================
-- AUTH USERS (senha inválida de propósito → use "Esqueci minha senha")
-- =========================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'b12f228c-28a7-4cf4-aeb4-ff6f3746ed96',
    'authenticated', 'authenticated',
    'admin@example.com',
    crypt('MIGRATED_RESET_REQUIRED_' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Exemplo"}',
    '2026-06-10 23:33:50+00', now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '0b42f8f2-f617-4080-b2c9-0e4ee193be7f',
    'authenticated', 'authenticated',
    'atendente@example.com',
    crypt('MIGRATED_RESET_REQUIRED_' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Atendente Exemplo"}',
    '2026-06-13 02:06:48+00', now(),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- ORGANIZATIONS
-- =========================================

INSERT INTO public.organizations (id, nome, created_at) VALUES
  ('d269393e-084a-4c8d-b1ce-d241d6c448cd', 'Empresa Exemplo',   '2026-06-12 16:33:41.077195+00'),
  ('390f805b-a4d9-4c75-8fb7-9fa3fb32286d', 'Empresa Exemplo 2', '2026-06-13 02:06:48.974761+00')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- PROFILES
-- =========================================

INSERT INTO public.profiles (id, nome, email, tipo_usuario, status, created_at, updated_at, organization_id) VALUES
  ('b12f228c-28a7-4cf4-aeb4-ff6f3746ed96', 'Admin Exemplo',     'admin@example.com',     'admin',     'ativo',  '2026-06-10 23:33:50.231158+00', '2026-06-12 16:33:41.077195+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('0b42f8f2-f617-4080-b2c9-0e4ee193be7f', 'Atendente Exemplo', 'atendente@example.com', 'atendente', 'ativo',  '2026-06-13 02:06:48.974761+00', '2026-06-13 03:04:04.601824+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- LEAD STATUSES
-- (org d269393e = Empresa Exemplo)
-- =========================================

INSERT INTO public.lead_statuses (id, value, label, color_text, color_bg, color_dot, ordem, ativo, created_at, organization_id) VALUES
  ('55207b67-2679-4be0-a72d-8345df9862ed', 'novo_lead',          'Novo lead',           '#475569','#f1f5f9','#94a3b8', 1, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('67ad6842-77bc-43f8-94f2-d15850ed509a', 'em_atendimento',     'Em atendimento',      '#1d4ed8','#eff6ff','#3b82f6', 2, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('6e02bf8e-4bd9-46e1-b5b0-b8768b239bee', 'aguardando_retorno', 'Aguardando retorno',  '#b45309','#fffbeb','#f59e0b', 3, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('466044df-3c17-489e-91d7-61c8ab37b027', 'proposta_enviada',   'Proposta enviada',    '#6d28d9','#f5f3ff','#8b5cf6', 4, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('f23a0f2d-78c5-4f07-83b5-163f4c9b6e0e', 'followup_agendado', 'Follow-up agendado',  '#c2410c','#fff7ed','#f97316', 5, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('27f26900-847c-4176-b6a3-00daefc81f7a', 'fechado',            'Fechado',             '#065f46','#ecfdf5','#10b981', 6, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('2db48767-c38f-4f0a-8046-5ff72aa5e4fb', 'perdido',            'Perdido',             '#dc2626','#fef2f2','#f87171', 7, true, '2026-06-13 01:32:09.734962+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd')
ON CONFLICT (id) DO NOTHING;

-- (org 390f805b = Empresa Exemplo 2)
INSERT INTO public.lead_statuses (id, value, label, color_text, color_bg, color_dot, ordem, ativo, created_at, organization_id) VALUES
  ('f6bcab12-7116-4896-be05-c17a83b28d10', 'novo_lead',          'Novo lead',           '#475569','#f1f5f9','#94a3b8', 1, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('7410193a-d1f8-4268-9697-bbe8c6578ef7', 'em_atendimento',     'Em atendimento',      '#1d4ed8','#eff6ff','#3b82f6', 2, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('9646d91b-7a57-45f6-862e-f7616a6f018c', 'aguardando_retorno', 'Aguardando retorno',  '#b45309','#fffbeb','#f59e0b', 3, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('1def04e2-58a3-46f3-9440-3fc37f460d04', 'proposta_enviada',   'Proposta enviada',    '#6d28d9','#f5f3ff','#8b5cf6', 4, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('2494db60-4eb1-43cf-825c-7ae6d7abff7f', 'followup_agendado',  'Follow-up agendado',  '#c2410c','#fff7ed','#f97316', 5, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('5671ca79-587c-4019-8649-f6688d6c05a5', 'fechado',            'Fechado',             '#065f46','#ecfdf5','#10b981', 6, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('e10e51c3-ea90-471b-8f8d-b2dab68c59ad', 'perdido',            'Perdido',             '#dc2626','#fef2f2','#f87171', 7, true, '2026-06-13 02:06:48.974761+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- LEAD SOURCES (origens)
-- (org d269393e = Empresa Exemplo)
-- =========================================

INSERT INTO public.lead_sources (id, nome, ativo, created_at, organization_id) VALUES
  ('7a3a0657-4481-4e10-97c9-406f16162176', 'Facebook',           true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('3b449471-0a13-4385-893c-13eea3b6e33b', 'WhatsApp direto',    true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('d8a0c64c-f9ff-4aee-bf88-376496bd8d65', 'Outro',              true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('06bfe95e-dfe2-43f0-84f4-66b22d231fe8', 'Instagram',          true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('f1d7c434-6cfb-4a9d-a33a-e7d72778d9ce', 'Indicação',          true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('da647e7f-17f9-4ae6-8933-4579c08beea8', 'Site',               true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('51c248f0-fdd4-4027-b83f-b76a206f1f78', 'Cliente antigo',     true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('d6c894bd-3a86-4e0c-bc76-cdcad7afe9e0', 'Google',             true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('270bde3f-6371-4a5f-8a89-a8454287f932', 'Tráfego pago',       true, '2026-06-10 16:42:13.0105+00',   'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('614938bb-15d4-42f7-9672-5d29a4b75b67', 'Anúncio',            true, '2026-06-12 13:37:10.976761+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd')
ON CONFLICT (id) DO NOTHING;

-- (org 390f805b = Empresa Exemplo 2)
INSERT INTO public.lead_sources (id, nome, ativo, created_at, organization_id) VALUES
  ('0dd8ef3a-12f0-4307-a5e1-66bad0b91585', 'WhatsApp',           true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('4a2d403d-0626-458c-924c-12634058b246', 'Instagram',          true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('5b6ddf10-4c72-43d6-a7e1-5b273e1c1a7d', 'Facebook',          true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('29c39789-fba2-4537-b849-4c8bf707b36f', 'Google / Site',     true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('64888a95-7d0e-4a6e-a5fc-bb7b7d61e9bf', 'Indicação',         true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('3f104a00-3370-47ee-9505-11a644442523', 'LinkedIn',           true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('9abc7470-328c-4403-9f6e-01a0f67b1b4f', 'TikTok',            true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('d6934079-3d45-4b71-8ea0-8b25340d0822', 'E-mail',            true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('67d4a5b6-54a8-4916-8520-e1eaae1485b7', 'Ligação / Telefone',true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('3b67b2b5-31c2-4ec8-8ad7-9098df4925d8', 'Evento / Feira',    true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- LEAD SEGMENTS (segmentos)
-- (org d269393e = Empresa Exemplo)
-- =========================================

INSERT INTO public.lead_segments (id, nome, ativo, created_at, organization_id) VALUES
  ('b8b99d61-5de6-4a11-a81c-fe62b2ef0c2b', 'Contabilidade',  true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('1cf1079e-6fbd-4e3c-bee9-4cfb2f9fd147', 'Estética',       true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('1d7d057a-bb03-4f2e-9f96-9c4e543a1a3c', 'Alimentação',    true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('e4f37b9a-77d2-49de-933a-2bae23575f7f', 'Energia solar',  true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('dcc60eec-96bd-46c4-ac83-45417fe616e8', 'Imobiliária',    true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('8671b8c2-6677-45af-b66f-99a64ae121a8', 'Outro',          true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('5549b581-61c4-4034-b9df-289fad03f868', 'Saúde',          true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('03532ae5-0f55-4a5e-a3ea-0cce30cc381f', 'Petshop',        true, '2026-06-10 16:42:13.0105+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd')
ON CONFLICT (id) DO NOTHING;

-- (org 390f805b = Empresa Exemplo 2)
INSERT INTO public.lead_segments (id, nome, ativo, created_at, organization_id) VALUES
  ('de80b0c2-5d85-4e48-9184-c312c9cb6721', 'Pessoa Física',    true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('fb541bf2-2f88-4dc7-8898-ebf4e9de68bb', 'Pequena Empresa',  true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('e0115b5e-e77c-470c-857a-b8cab73b6765', 'Média Empresa',    true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('a98ba5ba-8a90-4f21-97e9-19288a8b7300', 'Grande Empresa',   true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('7a0c8b8e-6483-4125-b7be-f08bd12c6fd9', 'E-commerce',       true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('8b446761-7abb-4f65-87c4-bec2bf46338b', 'Serviços',         true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('5f4bae7f-1a91-4231-bfd6-7f74f33639ec', 'Varejo',           true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('68854fa4-f044-4f9b-ab42-aa99e37b1bcd', 'Saúde',            true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('bf9882be-0f0a-4502-ac4a-9f861dee53af', 'Educação',         true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('8677666e-c177-44f2-b38f-763ffa7bd96a', 'Construção Civil', true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('0df4426f-adc3-41ab-8c34-027efaa05763', 'Tecnologia',       true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('c0ab7465-61f5-4bf0-a62f-cac4a36942ed', 'Alimentação',      true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('e7dd3230-dda6-47df-a791-6e82e25d6ba3', 'Beleza e Estética',true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'),
  ('8cbea0db-3d4f-49f0-ab49-43520d411278', 'Imobiliário',      true, '2026-06-13 02:57:35.184681+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- LEADS (3 leads fictícios — sem fotos)
-- =========================================

INSERT INTO public.leads (id, nome, whatsapp, foto_url, origem_id, segmento_id, status, tags, observacao, responsavel_id, proximo_followup, created_at, updated_at, organization_id) VALUES
(
  '5931d7f3-21be-4242-ae5f-4160d98d7bcf',
  'Lead Exemplo 1',
  '5511999990001',
  NULL,
  '614938bb-15d4-42f7-9672-5d29a4b75b67',
  'dcc60eec-96bd-46c4-ac83-45417fe616e8',
  'em_atendimento',
  ARRAY[]::text[],
  NULL,
  'b12f228c-28a7-4cf4-aeb4-ff6f3746ed96',
  NULL,
  '2026-06-12 15:39:48.87021+00',
  '2026-06-13 03:06:39.864856+00',
  'd269393e-084a-4c8d-b1ce-d241d6c448cd'
),
(
  'b188eb0c-e364-4a13-ad60-0af85766250d',
  'Lead Exemplo 2',
  '5511999990002',
  NULL,
  '51c248f0-fdd4-4027-b83f-b76a206f1f78',
  '8671b8c2-6677-45af-b66f-99a64ae121a8',
  'em_atendimento',
  ARRAY['Exemplo']::text[],
  NULL,
  'b12f228c-28a7-4cf4-aeb4-ff6f3746ed96',
  NULL,
  '2026-06-12 15:56:34.235812+00',
  '2026-06-13 03:06:36.057185+00',
  'd269393e-084a-4c8d-b1ce-d241d6c448cd'
),
(
  '288e12cd-a46d-4b54-b485-8d1907096ca1',
  'Lead Exemplo 3',
  '5511999990003',
  NULL,
  NULL,
  NULL,
  'novo_lead',
  ARRAY[]::text[],
  NULL,
  '0b42f8f2-f617-4080-b2c9-0e4ee193be7f',
  NULL,
  '2026-06-13 02:22:12.567391+00',
  '2026-06-13 03:04:20.94645+00',
  '390f805b-a4d9-4c75-8fb7-9fa3fb32286d'
)
ON CONFLICT (id) DO NOTHING;


-- Reativa triggers e FK checks
SET session_replication_role = DEFAULT;


-- =========================================
-- VERIFICAÇÃO FINAL (opcional)
-- =========================================
-- SELECT 'organizations' AS tabela, COUNT(*) FROM public.organizations
-- UNION ALL SELECT 'profiles',      COUNT(*) FROM public.profiles
-- UNION ALL SELECT 'lead_statuses', COUNT(*) FROM public.lead_statuses
-- UNION ALL SELECT 'lead_sources',  COUNT(*) FROM public.lead_sources
-- UNION ALL SELECT 'lead_segments', COUNT(*) FROM public.lead_segments
-- UNION ALL SELECT 'leads',         COUNT(*) FROM public.leads;
-- Esperado: 2 / 2 / 14 / 20 / 22 / 3
