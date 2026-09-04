# Decisões de arquitetura e design

## ADR-001 — Sidebar sobre o drawer nativo do WhatsApp

- **Data:** 04/09/2026
- **Status:** Aceita

### Contexto

Ao salvar um lead, a extensão abre e preenche o formulário nativo de contato do
WhatsApp Web. Recolher automaticamente a sidebar expõe essa automação ao usuário
e causa uma mudança visual desnecessária durante o salvamento.

### Decisão

A sidebar do Connect CRM permanece aberta, com a camada visual máxima do Chrome,
acima dos drawers nativos do WhatsApp. O recolhimento passa a ser exclusivamente
manual pelo botão lateral.

### Consequências

- A automação de cadastro fica visualmente coberta pela extensão.
- O fluxo funcional e os seletores do formulário nativo permanecem inalterados.
- Para acessar um drawer do WhatsApp enquanto a sidebar estiver aberta, o usuário
  deve recolher o CRM manualmente.
