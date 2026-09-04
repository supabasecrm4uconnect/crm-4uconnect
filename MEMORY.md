# Memória viva — CRM 4U Connect

Última atualização: **04/09/2026**

## Estado atual

- O `crm-web` de produção permanece inalterado por esta correção.
- A extensão publicada continua na versão 1.0.0.
- A branch local `fix/whatsapp-contact-save-v1.0.1` contém a correção da extensão e sua documentação; a criação de contato foi validada em campo e o ajuste visual final da versão 1.0.2 aguarda reteste.

## Gotcha: salvamento de contatos no WhatsApp Web

- O DOM atual abre `[data-testid="chat-info-drawer"]` e apresenta, para números não salvos, um botão de texto exato `Adicionar` sem `aria-label`.
- O lápis dentro de `[data-testid="notes-section"]` edita apenas notas. Ele não pode ser tratado como o botão de edição do contato, pois isso termina em `Timeout aguardando cadastro de contato`.
- A versão local 1.0.2 reconhece o novo botão somente dentro do painel de contato e exclui o lápis de notas.
- A sidebar deve permanecer aberta e acima do drawer nativo durante o cadastro, ocultando a automação. A abertura manual pelo botão lateral continua disponível.

## Gotcha: ruído no console do WhatsApp Web

- Após o carregamento da extensão v1.0.2, o console confirmou `logger.js carregado`, `Content script carregado` e `Sidebar injetado no DOM`, sem exceções originadas por arquivos do Connect CRM.
- Avisos de `PerformanceObserver`, CSP do `pdf-viewer`, CORS para `dit.whatsapp.net`, `ErrorUtils` e arquivos com nomes hash pertencem ao próprio WhatsApp Web e não indicam falha da extensão.
- O botão **Erros** de `chrome://extensions` pode manter ocorrências históricas. Para atribuir um erro à extensão, conferir a mensagem completa e se a origem é `chrome-extension://.../logger.js` ou `content.js`, não apenas uma linha destacada no visualizador.

## Próximo passo

- [ ] Recarregar a extensão local, confirmar que o contato continua sendo criado e que o drawer nativo fica coberto antes de publicar a versão 1.0.2.
