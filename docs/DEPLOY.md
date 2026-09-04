# Deploy — CRM 4U Connect

## Domínios de produção

- Principal: `https://connect-crm.vercel.app`
- Alias legado compatível: `https://crm-4uconnect.vercel.app`

## Sincronização da extensão Chrome

Ao alterar um domínio do CRM, atualizar no mesmo release:

1. `crm-extension/manifest.json`: `host_permissions` e `content_scripts.matches`.
2. `crm-extension/background.js`: `ALLOWED_SESSION_ORIGINS`.
3. `crm-extension/content.js`: `CRM_URL`.

Nunca autorizar `https://*.vercel.app` e nunca usar uma chave `service_role` na extensão.

## Validação da ponte de sessão

1. Recarregar a extensão em `chrome://extensions`.
2. Recarregar a aba do CRM e confirmar que o usuário está autenticado.
3. Recarregar o WhatsApp Web.
4. Confirmar que a sidebar deixa de mostrar **Acesso necessário** em até três segundos.
5. Criar um lead de teste e validar o CRM e o contato nativo antes da publicação.
