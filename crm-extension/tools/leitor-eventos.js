/**
 * CRM 4U Connect — Utilitário de Inspeção de Eventos DOM (WhatsApp Web)
 *
 * USO:
 * 1. Abra o WhatsApp Web no navegador (Google Chrome).
 * 2. Abra o DevTools (F12) e vá para a aba Console.
 * 3. Cole o código deste arquivo e pressione Enter.
 * 4. Ao clicar nos elementos da interface do WhatsApp, o console exibirá:
 *    - A tag HTML clicada
 *    - O texto interno e atributos
 *    - A árvore de elementos ancestrais (até 5 níveis)
 *    - As React Keys (__reactFiber...) para apoiar a navegação na árvore de componentes.
 */

(function() {
  console.clear();
  console.log(
    '%c[CRM 4U - Capturador de Eventos Ativo]',
    'background:#8b5cf6;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:14px;'
  );
  console.log(
    'Instruções: Interaja na tela (clique na lista de conversas, nos botões ou campos). O console imprimirá os detalhes de cada clique.'
  );

  document.addEventListener('click', function(event) {
    const el = event.target;
    console.log(
      '\n%c--- Clique Detectado ---',
      'background:#10b981;color:white;padding:2px 6px;border-radius:3px;font-weight:bold;'
    );

    // Detalhes do elemento clicado
    console.log(`Tag Clicada: <${el.tagName.toLowerCase()}>`);
    console.log(`Texto Interno: "${(el.textContent || '').trim().substring(0, 60)}"`);

    const attrs = {};
    for (let attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }
    console.log('Atributos:', attrs);

    // Sobe os níveis de ancestrais para ver o botão/container completo
    let parent = el.parentElement;
    let level = 1;
    console.log('Ancestrais do Elemento Clicado:');
    while (parent && parent !== document.body && level <= 5) {
      const pAttrs = {};
      for (let attr of parent.attributes) {
        pAttrs[attr.name] = attr.value;
      }

      const reactKeys = Object.keys(parent).filter(k => k.startsWith('__react'));

      console.log(`  Nível ${level} -> <${parent.tagName.toLowerCase()}> class="${parent.className}" data-testid="${parent.getAttribute('data-testid') || ''}"`);
      if (Object.keys(pAttrs).length > 0) {
        console.log(`     Atributos:`, pAttrs);
      }
      if (reactKeys.length > 0) {
        console.log(`     React Keys:`, reactKeys);
      }

      parent = parent.parentElement;
      level++;
    }
  }, true); // Captura o clique no início da propagação
})();
