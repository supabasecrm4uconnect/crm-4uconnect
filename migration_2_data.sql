-- ============================================================
-- CRM 4U Connect — Script 2: Dados Completos
-- Projeto destino: cimehhzkwgiwgfnkeauo
-- Execute este script APÓS o migration_1_schema.sql
--
-- IMPORTANTE: Este script usa SET session_replication_role = replica
-- para desativar triggers e FK checks durante a inserção.
-- Os triggers voltam ao normal no final com SET = DEFAULT.
--
-- Após executar: use "Forgot Password" no CRM para redefinir
-- a senha de leoclecio@outlook.com e lsystem.mobile@gmail.com
-- ============================================================


-- Desativa triggers e FK checks temporariamente
SET session_replication_role = replica;


-- =========================================
-- AUTH USERS (preserva os UUIDs originais)
-- Senha inválida propositalmente → use "Esqueci minha senha" no CRM
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
    'leoclecio@outlook.com',
    crypt('MIGRATED_RESET_REQUIRED_' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Leoclecio"}',
    '2026-06-10 23:33:50+00', now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '0b42f8f2-f617-4080-b2c9-0e4ee193be7f',
    'authenticated', 'authenticated',
    'lsystem.mobile@gmail.com',
    crypt('MIGRATED_RESET_REQUIRED_' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"lsystem.mobile"}',
    '2026-06-13 02:06:48+00', now(),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- ORGANIZATIONS
-- =========================================

INSERT INTO public.organizations (id, nome, created_at) VALUES
  ('d269393e-084a-4c8d-b1ce-d241d6c448cd', '4U Connect',    '2026-06-12 16:33:41.077195+00'),
  ('390f805b-a4d9-4c75-8fb7-9fa3fb32286d', 'lsystem.mobile','2026-06-13 02:06:48.974761+00')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- PROFILES
-- =========================================

INSERT INTO public.profiles (id, nome, email, tipo_usuario, status, created_at, updated_at, organization_id) VALUES
  ('b12f228c-28a7-4cf4-aeb4-ff6f3746ed96', 'Leoclecio',     'leoclecio@outlook.com',    'admin',     'ativo',  '2026-06-10 23:33:50.231158+00', '2026-06-12 16:33:41.077195+00', 'd269393e-084a-4c8d-b1ce-d241d6c448cd'),
  ('0b42f8f2-f617-4080-b2c9-0e4ee193be7f', 'lsystem.mobile','lsystem.mobile@gmail.com', 'atendente', 'ativo',  '2026-06-13 02:06:48.974761+00', '2026-06-13 03:04:04.601824+00', '390f805b-a4d9-4c75-8fb7-9fa3fb32286d')
ON CONFLICT (id) DO NOTHING;


-- =========================================
-- LEAD STATUSES
-- (org d269393e = 4U Connect / leoclecio)
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

-- (org 390f805b = lsystem.mobile)
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
-- (org d269393e = 4U Connect)
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

-- (org 390f805b = lsystem.mobile)
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
-- (org d269393e = 4U Connect)
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

-- (org 390f805b = lsystem.mobile)
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
-- LEADS (3 leads)
-- =========================================

INSERT INTO public.leads (id, nome, whatsapp, foto_url, origem_id, segmento_id, status, tags, observacao, responsavel_id, proximo_followup, created_at, updated_at, organization_id) VALUES
(
  '5931d7f3-21be-4242-ae5f-4160d98d7bcf',
  'Leo Ambrosio',
  '5515992568868',
  'data:image/jpeg;base64,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',
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
  'Carina (CDB Consultoria)',
  '5515981810220',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/7QCEUGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAGgcAigAYkZCTUQwYTAwMGFhNTAxMDAwMDY1MDIwMDAwODUwMzAwMDBmZTAzMDAwMDc2MDQwMDAwNGEwNTAwMDA3ZDA3MDAwMGE2MDcwMDAwM2YwODAwMDA5ZTA4MDAwMDhmMGIwMDAwAP/bAIQABQYGCwgLCwsLCw0LCwsNDg4NDQ4ODw0ODg4NDxAQEBEREBAQEA8TEhMPEBETFBQTERMWFhYTFhUVFhkWGRYWEgEFBQUKBwoICQkICwgKCAsKCgkJCgoMCQoJCgkMDQsKCwsKCw0MCwsICwsMDAwNDQwMDQoLCg0MDQ0MExQTExOc/8IAEQgAYABgAwEiAAIRAQMRAf/EAHAAAAIDAQEBAAAAAAAAAAAAAAMEAgUGBwEAEAABAwEGAgkDBAMAAAAAAAABAAIRAwQQEiExQVFhBRMgIjJxgaGxFJHwFULB4SMw0REAAgEDAgYCAwAAAAAAAAAAAREAITFBUWFxgZGhsfDB8RDR4f/aAAwDAQACAAMAAAABVYzRxs6b2ojCW/Ny/RnQ1XpQzWFKUfvvVyhjLh7j0isrKvjiQXTM30H1QkJxiH6I1/PmFCy8lilTBVvCrWFfPxmWNF6HsxsKwerbvOWhZX6fXZ64A9nmRwUsrKgfnEkk+gwGQbnuWYqMYG4C9EelyjcZ9HzfQ1qa2wNhqAmhnDaLn0Tt1SpXFCfLzmCz+VtSqbnyjNTXetfrbJxOo5x1/iz0L1TLbsB8SNtf4GpucG4qf//aAAgBAQABBQIBRdhTak3TdPY+vCHSDULWEbcAv1QKzdICoUT2RqCE18oOCAxKyWFtJFTC1QRcEQuohdQqVJVLOrHQlAhRNxUkIQsCnLIqSE5ybazTDba5UqweK1QMH1ypWpr1VtEL6pyBWFYnBVDC6ouRDqa6Pqd63TiNSF1ypVMaoxiDkKiLwBWqYjRaXLU2Sk1rK3cbWOMsCDsJmUWrCqjMTbFSa5CtSYXdSVRZItlokOik1rA5PaVQqKrZQnUi1BMZjTVaCIo2kgOeEaaomCRLnU2m5zU6xB7adl6s1aZKqlzxTBRZkJUZgOK+mqLEsSoZqrSRauk4mngc2tSLbgVZ6oYnVwRWlNVm0laDpKpiNCtgTLSCqgALclKBX//aAAgBAwABPwEPbxRhVKI1aZ5djqijTMBVDGXY4Iz+FOA3aFagKcxny81SLnftWENExKa6FBeYCND7qpZXB2Yy48liwEyIGyxh2iNMHkqTs/lOcPX89F1hc0eXxkntDwRHoV9K/Zv2Up57xhVXlwVOoCOCnNC0xkv/2gAIAQIAAT8BLHcFmgTuOx1qDhJTjdKCabo5qiMZAOXNPpNG8INRCxYRJQrcstk106IMxAYTJ3RYW6ptUjmqunwqYxfmadRwOIIg8PPNNJbvHMI2qMjBnioVMd0SujQKVUOictDx2VppOY8ky6STJ3n+Vsn0d1//2gAIAQEABj8Cv5je/TteD3Xh914fdeD3Xg91hiJ/0lZ7rZA6u+O1/d5uE7G/S7NaX7TfDYE6rYqR68lJMfytD9wo0PNZX8+K1lFxU3emaB2i7Rc1n/U8+V8ocFAzUKGok/bivCB5C6exkv8AJshHdCktjFo7SVlxKLRtumyO8RopE81xUFZBaXcx7hd45bfkLFJI2CI87y3jmgZgDsDDlxUzmpZ4vlOL9sgETt/27X0XBZZrNsdiZXkmEfuYJTQNB8o5S3siLjdmmcQI+zjdmjGnY//aAAgBAQEBPyFeIIAxCJRtUAXEBnXp0hH4DDAhEU1jHraa8IIz9cJ7f8QNv98IBE2wt9Y9oz1+ZSJlIHzCAAbIYg686Q6nbEAf6loxGXUdUDj8plWFyCmFV+zC0KUyU0hJgq1tCbkg7j9UlegB4IelIw1UKVYiyQF/EqK2RA7AfC/e0CNCHzp+5oAPjCdSB6OAxSkNggbxgTUdYRFQtKiDaJ9iDNyGKgfyG3CAE8Kwcsp0IHkKW1qzJfMu3LalsPMCGivSlRKPeIJXhgwBonwp9w4yBygCIh2CwXgzMAyBTOSrCMkrkubgIYkRb6O8G4ug0ByIKAZs3aKkEIcaiJDHD5HMvOSYYGocfBQERAgFa7y3prEKcI4KB1AksnfThCAo0OZgFvMpgIDJPtQYjoYWiUQQb2gDAkIQFCxI6FasCoaBRLGr0glFwJbBf1VjN6AQ5GXgtzkfEKpDV2bEwZRFaL7g2gdbNr9IXSItDRSBfqxL4QGHeURcjBbscRjpL08TRYjjVaCmY01S0t0D/I9F/KBfMeWa7mCNKoBorQPAhyT0pLn1Fx+AGkLAOG966LTSXAIchBBUMgbf1CrogbFF1pLRpJrvh5hSxbwcHbjCE3KzaSphBJBwZlB8wRCsIGCacUcwGrCVIFbh7rC1UOogHp4izgiqSLlczKhcaQjnK8HWqbnP4hUYq1hKjcyskdvuGmjQJBhqIwsXV6RWyzovoR9G1+cBJCMiOI8IpEpuCMTn/9oADAMBAQIBAwEAABCAZiR9FfSJFkmCpPSbvBaWyIh9H3jWKj8//2gAIAQMBAT8QKxjRUgg7QVpslccNfMPGCOF05+tCnir1UfuI4S/uIqia3y+BC2075+IVs0CNHFpnhNWjankxi1A1knTSEoxAI0H03jwACNT+4avYupjRbbF5cMZRXfS0FQTloqhhRhgMwYICrNUONfCPoqk9OEqoel5VZgBbQIKztDOJIjwIonW+0wcxQLH8huNLMMFA4z//2gAIAQIBAT8QAzm0FzT+8EP4AL8CEUot5uHP8KhrKQTZKH3dAv5jpUVFiVSzh8lOHGSigpcjCI8oljrNrD8qTsI2OFYVBEBCIGkbwGYwfJlqISqf0c3dCa4ZvZHGP//aAAgBAQEBPxBBfpPbhB6O+ihNbgppQiNuUFjRqNWcqRN2enaM03QGX7iYlFP3pPZ0gq34/URGCac9/EHsG5YEVshTkbiBf5CvBwIBnZqqTjVBBVdh73hrAXrMEDDUPtcQdPR1BlNY0mjXECAAK5u7wBXQDKqaTcLDRsMTRp6Pq/UdlEqnJGlrkYl9RxQqY1CvWgEsBth19MOLO434Sity+gwlYRdvjkFgCUZD4abw4MAcY1WoJj1WGe5k0Omuk3wB7PkjIksUgRLo5dqz4eVPHeGyQ1py0cDAM43ETNPpou8YJFT0LwxLKKc4ziZAXHKAmpWzKUki0K9ljKL3FVussHRxncrwyQgckkBV0FhwfmaLQhekvHs3ncEcfRmJNgoeI+UCJYL6fMOEUJ6u8KlWAoN6AdUDLXY1empgPm4egUJ3Frq/UMNnKLzJH7LiBpNBNqieZfflM7D6Q4xqoEusDZ6wzao/1u4DWfz+6RAR2vCIwCtC4wFxa8lCt4jhaFksifZrBpatyfiWAgKnKCUCRWMC9qZy8fYZitbiBBl2yOcA2AAlsdfxrl4tIdNYdtgPFqfE1m5YEm5LrMcIhbnAPEUDyYnCsHqDXWtpxdkC2HkJsmYSovkM05SniIIIcQNNIVmuRqQVkXVbjnK+S4QEqmGdDlfgBfXgBX75dodiNVTLOkqiESUbQvQthAuuEOP9SmLorDum1HTntMkoegwOigkVNKX4hiaPVgd7PCFGVEBqCQ0f1CRMIF2ihFO7lbBBCVzq5mp4X0bszDTtEAUHgEblQCKoamWtWjvB6oIyAmP7LMsojWDoxmyEdr8RAEBmz4ovtBnUzKQgRKJ+V16SiGxzSVaUipCx3BxAWMIpnMQ7cfhmlBFJfZkcMGH9VhBrDW4hRQP5B6Q4Aud48AQNQwwgnDOsOrgOQF+EaFiE3ftuECzS/mHlD6QIi1K3R7ysKMocDdsZZOCCaHeDauZ2BwdxDrkorZRVBmFpUM//2Q==',
  '51c248f0-fdd4-4027-b83f-b76a206f1f78',
  '8671b8c2-6677-45af-b66f-99a64ae121a8',
  'em_atendimento',
  ARRAY['Cliente 4U']::text[],
  NULL,
  'b12f228c-28a7-4cf4-aeb4-ff6f3746ed96',
  NULL,
  '2026-06-12 15:56:34.235812+00',
  '2026-06-13 03:06:36.057185+00',
  'd269393e-084a-4c8d-b1ce-d241d6c448cd'
),
(
  '288e12cd-a46d-4b54-b485-8d1907096ca1',
  'S S Teixeira Energia Solar',
  '556295018385',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/7QCEUGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAGgcAigAYkZCTUQwYTAwMGFiMzAxMDAwMDVkMDIwMDAwNjAwMzAwMDAxNjA0MDAwMGQwMDQwMDAwMDQwNzAwMDBhOTA5MDAwMGQyMDkwMDAwNzQwYTAwMDBlMDBhMDAwMDUzMGQwMDAwAP/bAIQABQYGCwgLCwsLCw0LCwsNDg4NDQ4ODw0ODg4NDxAQEBEREBAQEA8TEhMPEBETFBQTERMWFhYTFhUVFhkWGRYWEgEFBQUKBwoICQkICwgKCAsKCgkJCgoMCQoJCgkMDQsKCwsKCw0MCwsICwsMDAwNDQwMDQoLCg0MDQ0MExQTExOc/8IAEQgAYABgAwEiAAIRAQMRAf/EAH4AAAEFAQEBAAAAAAAAAAAAAAACAwQFBgEHCBAAAQIEAgYHBQUJAQAAAAAAAQIRAAMSIQQxECJBUWFxBRMUIDKBoUJSgtHwM5HB4fEVIyQwNEBicpKxEQEAAgIBAwMEAgMBAAAAAAABESEAMUFRYXEQgZEgobHwwdEw4fFA/9oADAMBAAIAAwAAAAH2EBHQAAAA8VwyufUZ4l7SnrgAAAJRW5SHL9CMyToeI01HbQp2F9Vy2jeZ1ADrAFIELz+vTYwZ2zhR4snG2FMJWz9G/M+ofj+5DL0OUIXBDNrVDWmpzWglMSfMktPafMKaVqmH9rucnrKW47T3EOO/U2MOZHfrZCetr7GkpWnklDZyylQpsuMAON57miO8y0jQgUzV8Bm5F4AAc7//2gAIAQEAAQUC/ssf0xMK+2TIwXTS5RSoKHceKtOAmy5CZ05Eo9KgLjo3+n7mIUUhGMpV+0UCJfSEuapEr+Hn9XNHSQAldGpZHcxs+iKIoqPYpdEt6x2ZUJmGYsBu5jMV2dHaAqBNSYQgYYSpZlRjMSqeulCUlVUYbpGZIhCwsaDCVqRhlqKkLP7rGGcAIA0JNuhZtUrRNQpcDALSJmDxJibhsS+JxVKQoRUIeMB0d1qcDgezq0YhZTC5hCUupAJdWIcGYBBMsQlQCkz6hLmVjQtBMBATEumWKUx1equTYy79XHVCJUvq+4cEDCMHSU9HhIOCcLw1UvsescE8tOEaZ/O//9oACAEDAAE/AdL9xGGdBmFQSBvLOWducVDfCCQG4BonIu+9n+vLTNWqZZi2wX/ERLlUDnmeUSpoW7Madqi36x2xNTF+Cj9WG7uKSmagpKqfr1HKFAiq3pGGwpnOMsi5sISmkAG7WcXiSQFAlmvny5G/lnE2YhtUhwpxq5hz4rNuyLEbIMyUWJa1GwjYmrIXu+flA6mz53fxNw/PizQ8otl7PvWtfJnuwiY1Rp8Ozl56GhoaG0f/2gAIAQIAAT8B00w2leKaYJYQpRN7B2Ds/KKTuhQBL8S8SlWbnpky0y72q2n9DEyb1h5ZRMklGbirYn6zjsaqXDcU/W3f3EFUpYITVf684SQabxicUJLHPMMLwtQUSRZ73tnE9JKSEu9ss8+YtvuLRKlLq1gWKGOtkWHh1n35hwb1QJc0OADcL2g3dVOZtanLzg9fdnazeB+P5cHe8ATg+ftH2bkm2btZz5RKqpTX4mvz8tFRiow8Po//2gAIAQEABj8C/slIlaqU2cZn5CPtF/8ASvnFM+pSdh9ofMQCLg3He820sqylKU9idrBz5QHQpR/xRVCJyfD4TsY8Yk/6DunP8IuVHewKmjKZ/wAGDLDpW1qg0SyVFJGtnxPzuYoK72Lg5QBvUnO+2DuKrbsgC3xP3aUh5hH3Df8AL5R9m/x+I/LfFARrK4uOZ/xEdWlY60GoKcVdYNv5bo6qfbq6uQJuPKMgG2azngHb8YlImHUSUjgB3XZycgxP3tsh1BSirNTK/Rz9wEACWXNm1h8I57TATWnrlllMzgMSwHp6wnErMtrqsNYlaQG5vnFZYWyA9CdsVGYL7EjW9coYZbhsG2MypPum/wBxzEBQyUHHcklGbS/ZqtyjDFXiMyW9m2HZA3q4jxFW5t8BKktLQ7fETf8ADulPuK9Df56bLo5AE+sAJxMwAWFk/KE/xCV0kKFSGuOUAmWCKnPVzCAfhVte8MZS72ugt55xnGeglVQvyhZeyglrvk+lOYTtIhOsSm7qGcWXf3oXrlkEQrMWexGUCpLuMy26Pskuz5JgsLUO1gIegw+mym9YZMwCnPLbwgJqF+OZiYTMBSrPK3rBFYZtwy3xrLDANubjnA/eCtuBccoqrDFNMJRWHTdvygh3v3JjlxMIJDbiOPCEGsmirPbUqqGCi7pLkP4X9LxSVm6UJOVwgk+rwJdWTaxF7ZbrwFVe6TYOSgML/wDsCWVmkHYAOW/beOsqJPp4Wfn/AD//2gAIAQEBAT8h/wDEyCpgTGws3ZqPM4uzd72LAItPyR+TpOMnDENI2P0oN1x84B5/sPV4zSkS8QIeT3w0U2TwPIVlzFDKKBoDY7MMXT/Jf0uQcC4bu+smVETtaTcww/w51VB7HW4xm3tFiqi2+Y6ZEi3SPMivXqGDBDoSCTBO8X341i1sGSlry219sTqzTaEIVCNPpMQIsKZ+hYldOXsc1jodXIm7lb5faFmNeRmibi9s5aOzHCWHkjDfnhTJaIAJ2MmyXo7PxEaBl2/Ggl3BTk3jKZ73XPdKXp2wAAQFAUB9AWVYrHWBYbfgvHboNyj0goURoHXEUBxHNpEifyO+FQBq0IDpgoEm2VuSTL88SBxOuIIIIKUT3Hkx2DIhDaffoqSOph7YQIDQ0eRavK2+KECj2+nes6WnbHdkidRs9dXw/jDsmM2uCafnjN3yWXZba8ZVTRZDKpZS9rJxeKJQ4Miqk8IMJK63jkPGR736DBXLbmYPj/dHqZD9So+8PjC7aBKAUccrEDB7ES+eaIM+sDJB0EX85I1akWNWCh2nthgECEXX5zsPkxLQz4vI5XQA1NMpOQ8kgMmxmjqR67pIeadMSRBhdOPHfORFqHfp1isHLzpDJya5yDApuDLnydMOMSUmTtGt5uCsiKHxvtjg1BBE6nfFgQ1EoDM8tQYUYi0TuerY1RESDPbCZpILLc3Krow3kTEgZLg7NRg5QQxAuLoR3wO1jYMdZnkNzGFrI5QCrblgu8cxC0ifvjdoCUEQ1uY3/WKHZMFjvP75GoFJURP0RvyugJwhpob3kPo4Ep2ES+Jh6xOKaIQQdETdkFQ2OoBUZDEuQJOBpoyVJapHVU0dRMhObDMsIcweAddSzLOlEpAMHSlaNhgA4OxLMKuKb7x/n//aAAwDAQECAQMBAAAQpBFVz9BwRFepHQ+O+BXxoKhcUOF67ABTzDzp/9oACAEDAQE/EPVxPrJzCGkUK+Ey5JQHNJV5M5F1aHdn9efRYyKo9hDzaGWdfoexOeXJoNG0h7ObBBoG4qXn8Av0fSrFI+3T7FsXEyV5cPHbIISNjUSbh69HGRCMkgxyMEz4w0ULXS0GkJaZBBTIGQ+gXMhPg0RMYiiahBYJEcLPpxyB4FPPUgnRronOQlSyodugSbtcN3Mnn4dVav0jkfoP/9oACAECAQE/EPU7sYf36oXALeLF/KIMitR9EQ4E19V6daaQAevmg6gwdckieIylh1J064BSHQSPDG8CpMKBdiooSMgc/FXC/wCQ7kMH/QyhtXXj9EDz3OI0H9UT+IDHQRBx8ui919ATyfp//9oACAEBAQE/EPrjt/jRTu6YR0HE/Ae4ZwKpEfcdtYnr8TBI6ETgOyM/SSKApbqoD3aymoytUlKHWvQxeh0WBz3l5MFcFkCSJYFu85t2FJN/0KWPM2G55A9hj6aDwrdIN/AMSG0pl6YPTXkMhRTGWTudbrm0JV2nykE95kApG3P1ys+6nn7PM8PzWcNVteBycD5Z6s1LwedS8bNOfpmGdsNjaanHdmfuQ2NH0Xz9pAYyvb+6QjP6hrF8PUez/YFwf4tSErEAOCUfOz77AyBMcAANAFAGvoYT5GjxAG37jFMp7hgpXxbRMKniPuVm78Wbqy5L9zFxgvBgHGbnDEf53Sin35ThT3rZX+y29hgU82H5TA06GGztVoxn2Gzhr1/XdWSJCO6hIcZEFHyWYWX8k6EL7fgjPZQJ5mAP7hmZvIc2AWnj8/vTIC4yNgm7YvD85bp+z7Bjz6BTd3GdEfO+cdaMxvB2DJN6Il2NJ5zSwj9nfDDpvwfwEOj7XBP1vvlAE9X8M6++9eYeesZEZNIV1XyTnHn0YgrBB95MGRLeE2V1/wAMPOrzI6+hZiZ94AyBehgQwWyA6GDk2yIStnyxa+sh/ATF22fvwP6R4UaLPL+sluK3ZBYCDeTqXJCmyyn1oKFEUNpLIrP+EFF5aXxkgrixQZPAayopDJ912GJkbZUeBb7iZZAHwoydGcNKjniUrpwqd0R4GBm/ni3n+wnd57MfhIL1Gt/b6G5JB0s38hRoZvIG3ptDckmDV9JBgaWIoAMnnexfgYHOSeMHcDsojmCe2HsA4aIbSEWkMXd+ABgSfaAZEzIAKDBsk7UulP8AN//Z',
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
-- VERIFICAÇÃO FINAL
-- Execute para confirmar a migração
-- =========================================

-- SELECT 'organizations' AS tabela, COUNT(*) FROM public.organizations
-- UNION ALL SELECT 'profiles',      COUNT(*) FROM public.profiles
-- UNION ALL SELECT 'lead_statuses', COUNT(*) FROM public.lead_statuses
-- UNION ALL SELECT 'lead_sources',  COUNT(*) FROM public.lead_sources
-- UNION ALL SELECT 'lead_segments', COUNT(*) FROM public.lead_segments
-- UNION ALL SELECT 'leads',         COUNT(*) FROM public.leads;
-- Esperado: 2 / 2 / 14 / 20 / 22 / 3
