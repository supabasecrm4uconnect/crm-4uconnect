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

## Atualização da extensão na Chrome Web Store

1. Confirmar que `crm-extension/manifest.json` possui versão superior à publicada.
2. Gerar um ZIP com `manifest.json` na raiz e todos os arquivos usados pela extensão.
   Artefatos locais ficam em `crm-extension/dist/`, que é ignorado pelo Git.
3. Abrir o item **Connect CRM** no Chrome Web Store Developer Dashboard.
4. Na aba **Pacote**, selecionar **Fazer upload de novo pacote** e enviar o ZIP.
5. Conferir a versão detectada e se não foram solicitadas novas permissões.
6. Selecionar **Enviar para análise**. O item atualmente publicado continua ativo
   enquanto a nova versão está em análise.
7. Para controlar o momento da troca, desmarcar a publicação automática no diálogo
   de envio. Após a aprovação, publicar manualmente dentro do prazo apresentado pelo
   painel; caso contrário, manter a opção automática para liberar após a aprovação.
8. Depois da publicação, instalar/atualizar pela loja e repetir a validação da sessão,
   criação e edição de lead no WhatsApp Web.

O ZIP da versão 1.0.2 é `crm-extension/dist/connect-crm-1.0.2.zip`. Ele contém
somente `manifest.json`, scripts, CSS e imagens necessários à extensão.
