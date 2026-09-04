# Memória viva — CRM 4U Connect

Última atualização: **04/09/2026**

## Estado atual

- O `crm-web` de produção permanece inalterado por esta correção.
- A extensão publicada continua na versão 1.0.0.
- A branch local `fix/whatsapp-contact-save-v1.0.1` contém somente a correção da extensão e sua documentação; publicação e teste de campo estão pendentes.

## Gotcha: salvamento de contatos no WhatsApp Web

- O DOM atual abre `[data-testid="chat-info-drawer"]` e apresenta, para números não salvos, um botão de texto exato `Adicionar` sem `aria-label`.
- O lápis dentro de `[data-testid="notes-section"]` edita apenas notas. Ele não pode ser tratado como o botão de edição do contato, pois isso termina em `Timeout aguardando cadastro de contato`.
- A versão local 1.0.1 reconhece o novo botão somente dentro do painel de contato, exclui o lápis de notas e mantém a sidebar recolhida enquanto um painel nativo visível estiver aberto.

## Próximo passo

- [ ] Desabilitar temporariamente a extensão publicada, carregar `crm-extension/` sem compactação e validar a criação de um contato novo no WhatsApp antes de publicar a versão 1.0.1.
