# Memória viva — CRM 4U Connect

Última atualização: **04/09/2026**

## Estado atual

- O `crm-web` possui uma alteração pendente de deploy para passar a usar
  `public/favicon.png`; nenhuma regra funcional do aplicativo foi modificada.
- A próxima versão pública da extensão é 1.0.2, sucessora da 1.0.1 atualmente publicada; ela ainda não foi enviada à Chrome Web Store pelo Codex.
- A branch local `release/chrome-store-v1.0.2` contém a candidata consolidada e sua documentação; a criação de contato foi validada em campo.
- Os números 1.0.3 a 1.0.12 registrados abaixo identificam checkpoints internos
  usados durante o desenvolvimento. Eles nunca foram publicados e todas essas
  alterações foram consolidadas na candidata pública 1.0.2.

## Gotcha: salvamento de contatos no WhatsApp Web

- O DOM atual abre `[data-testid="chat-info-drawer"]` e apresenta, para números não salvos, um botão de texto exato `Adicionar` sem `aria-label`.
- O lápis dentro de `[data-testid="notes-section"]` edita apenas notas. Ele não pode ser tratado como o botão de edição do contato, pois isso termina em `Timeout aguardando cadastro de contato`.
- A versão local 1.0.2 reconhece o novo botão somente dentro do painel de contato e exclui o lápis de notas.
- A sidebar deve permanecer aberta e acima do drawer nativo durante o cadastro, ocultando a automação. A abertura manual pelo botão lateral continua disponível.

## Gotcha: ruído no console do WhatsApp Web

- Após o carregamento da extensão v1.0.2, o console confirmou `logger.js carregado`, `Content script carregado` e `Sidebar injetado no DOM`, sem exceções originadas por arquivos do Connect CRM.
- Avisos de `PerformanceObserver`, CSP do `pdf-viewer`, CORS para `dit.whatsapp.net`, `ErrorUtils` e arquivos com nomes hash pertencem ao próprio WhatsApp Web e não indicam falha da extensão.
- O botão **Erros** de `chrome://extensions` pode manter ocorrências históricas. Para atribuir um erro à extensão, conferir a mensagem completa e se a origem é `chrome-extension://.../logger.js` ou `content.js`, não apenas uma linha destacada no visualizador.

## Gotcha: domínio e ponte de sessão

- O CRM é acessado atualmente por `connect-crm.vercel.app`, mas a extensão 1.0.2 injetava `session-bridge.js` somente no alias antigo `crm-4uconnect.vercel.app`.
- A consequência era a tela **Acesso necessário** no WhatsApp mesmo com o usuário autenticado no CRM Web.
- A versão 1.0.3 aceita os dois aliases no `manifest.json` e no `background.js`; links abertos pela extensão usam `connect-crm.vercel.app` como domínio principal.

## Progresso visual do salvamento

- A versão 1.0.5 exibe um overlay único com o texto **Salvando lead...** desde o clique até o término da automação de contato no WhatsApp.
- O overlay cobre toda a sidebar, bloqueia também o botão lateral e não revela etapas internas da automação.
- O visual replica os tokens dos modais do CRM Web: fundo `slate-950/40` com blur, cartão branco `rounded-xl`, borda `slate-200`, sombra `shadow-xl`, cabeçalho `slate-50/60` e indicador `emerald`.
- Ao concluir, a tela existente do lead retorna com a confirmação de sucesso; em falha de gravação no CRM, o overlay fecha antes da mensagem de erro.

## Consistência visual dos controles da extensão

- A versão 1.0.6 substitui os `select` visíveis por listboxes próprios no cadastro,
  edição e follow-up, usando os mesmos tokens do `CustomSelect` do CRM Web.
- A data do follow-up usa calendário próprio com navegação mensal, destaque do dia
  atual, seleção esmeralda e ações **Limpar** e **Hoje**, seguindo
  `CustomDatePicker` e `CustomCalendar` do CRM Web.
- As abas **Dados**, **Atividades** e **Follow-ups** seguem o padrão sublinhado do
  drawer de leads do CRM.
- Os valores permanecem espelhados em controles ocultos com os IDs anteriores;
  assim, validação, estado e payloads de salvamento não mudaram.
- Gotcha: o popup de `select` e `input type="date"` nativos não pode ser
  uniformizado integralmente por CSS entre navegador e sistema operacional.
- A versão 1.0.7 corrige o empilhamento: o campo inteiro do listbox/date picker é
  elevado enquanto estiver aberto, evitando que labels e inputs seguintes cubram
  o menu. O calendário também passa a replicar a estrutura do CRM Web com grades
  separadas para cabeçalho semanal e 42 dias, inclusive espaçamentos e tamanhos.
- A versão 1.0.8 substitui também o seletor nativo de horário pelo mesmo padrão do
  `CustomTimePicker`: colunas de hora/minuto, ação **Agora**, atalhos rápidos e
  botão **Confirmar**.
- Os itens de origem, segmento e tipo de atividade exibem ícones. Cada tipo de
  atividade usa um ícone contextual; os status continuam identificados pelos
  pontos coloridos adotados no CRM.
- A versão 1.0.9 impede que opções de listboxes longos encolham dentro do menu:
  após 240px, a lista usa scroll vertical verde, como no CRM Web.
- A versão 1.0.10 marca menus com mais de cinco opções como roláveis desde a
  abertura (`overflow-y: scroll`), reserva o espaço da barra e mantém trilho e
  indicador visíveis; isso torna explícito que há mais itens abaixo. As colunas
  de hora e minuto seguem a mesma regra.

## Título sincronizado com o CRM Web

- A extensão 1.0.7 recebe do `session-bridge.js` o `document.title` definido pelo
  `BrandingContext` e o usa diretamente em seu cabeçalho.
- A divergência observada (`Connect CRM — Leoclecio` no CRM e outra empresa na
  extensão) ocorria porque `organizations?limit=1` pode retornar qualquer cliente
  para um superadministrador.
- O fallback agora consulta o `organization_id` do perfil autenticado antes de
  buscar `nome_exibicao`/`nome`, seguindo o mesmo fluxo do CRM Web.

## Formulário contextual e validações locais

- A versão 1.0.11 oculta **Salvar alterações** em leads existentes até que nome,
  status, origem, segmento, valor, observação ou tags realmente mudem; desfazer
  todas as mudanças volta a ocultar o botão.
- A comparação normaliza espaços, IDs nulos, ordem das tags e valores monetários,
  evitando falso positivo para representações equivalentes do mesmo dado.
- Valor aceita somente dígitos e separadores monetários válidos, remove conteúdo
  inválido colado, limita a parte inteira a seis dígitos e a decimal a duas casas
  antes de reutilizar o payload numérico já existente. O máximo digitável é
  `999999,99`.
- Observação limita novas entradas a 500 caracteres e mostra contador. Conteúdo
  antigo acima desse limite não é truncado automaticamente durante a leitura.
- Alterar o nome mantém o overlay **Salvando lead...** visível durante a gravação
  no CRM e a sincronização nativa no WhatsApp. Se só o WhatsApp falhar, a mensagem
  informa que o CRM foi salvo e que apenas a sincronização do nome não concluiu.
- As abas **Dados**, **Follow-up** e **Avisos** dividem toda a largura disponível e
  mantêm ícones e textos centralizados.
- Nenhuma mudança desta versão altera schema, tabelas, colunas, tipos ou RLS.

## Favicon compartilhado

- O CRM Web referencia `/favicon.svg`: um círculo `#10B981` sobre fundo
  transparente. O `apple-touch-icon` usa o PNG equivalente.
- `crm-web/public/favicon.png` e `crm-extension/favicon.png` são versões 128×128
  idênticas do círculo, com diâmetro de 120 pixels e margem transparente de 4 pixels.
- O build de produção do CRM Web concluiu com sucesso após a troca.

## Próximo passo

- [x] Validar localmente o botão condicional, Valor, limite da Observação, tabs e
  alteração de nome da versão pública candidata 1.0.2.
- [x] Unificar o favicon do site e da extensão e recriar o pacote 1.0.2.
- [ ] Enviar `crm-extension/dist/connect-crm-1.0.2.zip` na aba **Pacote** do item
  Connect CRM no Chrome Web Store Developer Dashboard e submeter para análise.
