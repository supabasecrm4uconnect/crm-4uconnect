/**
 * ============================================================
 *  WA DOM INSPECTOR — Leitor de Eventos Completo
 *  Uso: Cole no console do WhatsApp Web e clique nos elementos
 *  Autor: gerado para extensão WhatsApp Web + CRM
 * ============================================================
 */

(function () {
  // Evita múltiplas instâncias
  if (window.__WA_INSPECTOR_ACTIVE__) {
    console.warn('[WA Inspector] Já está ativo. Recarregue a página para reiniciar.');
    return;
  }
  window.__WA_INSPECTOR_ACTIVE__ = true;

  // ─── CONFIG ────────────────────────────────────────────────
  const CONFIG = {
    parentLevels: 4,        // quantos níveis de pai capturar
    childrenLimit: 5,       // máx filhos diretos a listar
    showPanel: true,        // painel flutuante na tela
    highlightColor: '#25D366',
  };

  // ─── UTILIDADES ────────────────────────────────────────────

  /** Gera XPath absoluto */
  function getAbsoluteXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    while (el && el.nodeType === 1) {
      let index = 1;
      let sib = el.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.nodeName === el.nodeName) index++;
        sib = sib.previousSibling;
      }
      parts.unshift(`${el.nodeName.toLowerCase()}[${index}]`);
      el = el.parentNode;
    }
    return '/' + parts.join('/');
  }

  /** Gera XPath relativo (mais legível, usa atributos estáveis) */
  function getSmartXPath(el) {
    const stable = ['data-testid', 'aria-label', 'id', 'name', 'role', 'placeholder'];
    for (const attr of stable) {
      const val = el.getAttribute(attr);
      if (val) return `//${el.tagName.toLowerCase()}[@${attr}="${val}"]`;
    }
    // fallback: texto interno curto
    const text = el.textContent?.trim().slice(0, 40);
    if (text) return `//${el.tagName.toLowerCase()}[normalize-space(text())="${text}"]`;
    return getAbsoluteXPath(el);
  }

  /** Gera seletores CSS em múltiplas estratégias */
  function getCSSSelectors(el) {
    const selectors = [];

    if (el.id) selectors.push({ strategy: 'id', selector: `#${CSS.escape(el.id)}`, stability: '⭐⭐⭐' });

    const testid = el.getAttribute('data-testid');
    if (testid) selectors.push({ strategy: 'data-testid', selector: `[data-testid="${testid}"]`, stability: '⭐⭐⭐' });

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) selectors.push({ strategy: 'aria-label', selector: `[aria-label="${ariaLabel}"]`, stability: '⭐⭐' });

    const role = el.getAttribute('role');
    if (role) selectors.push({ strategy: 'role', selector: `${el.tagName.toLowerCase()}[role="${role}"]`, stability: '⭐⭐' });

    const name = el.getAttribute('name');
    if (name) selectors.push({ strategy: 'name', selector: `[name="${name}"]`, stability: '⭐⭐' });

    // classe estável (sem prefixos de hash gerado)
    const stableClasses = [...el.classList].filter(c => !/^[a-z0-9]{6,}$/.test(c) && c.length < 40);
    if (stableClasses.length > 0) {
      selectors.push({
        strategy: 'class (estável)',
        selector: stableClasses.map(c => `.${CSS.escape(c)}`).join(''),
        stability: '⭐',
      });
    }

    // nth-child como último recurso
    const parent = el.parentElement;
    if (parent) {
      const index = [...parent.children].indexOf(el) + 1;
      selectors.push({
        strategy: 'nth-child (frágil)',
        selector: `${el.tagName.toLowerCase()}:nth-child(${index})`,
        stability: '⚠️',
      });
    }

    return selectors;
  }

  /** Lê props do React Fiber se disponível */
  function getReactProps(el) {
    const key = Object.keys(el).find(
      k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!key) return null;

    try {
      const fiber = el[key];
      const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
      const props = propsKey ? el[propsKey] : null;

      return {
        hasReact: true,
        eventHandlers: props
          ? Object.keys(props).filter(k => k.startsWith('on'))
          : [],
        propsKeys: props ? Object.keys(props) : [],
      };
    } catch {
      return { hasReact: true, error: 'Não foi possível ler as props' };
    }
  }

  /** Captura hierarquia de pais */
  function getParentChain(el, levels) {
    const chain = [];
    let current = el.parentElement;
    for (let i = 0; i < levels && current; i++) {
      chain.push({
        tag: current.tagName.toLowerCase(),
        id: current.id || null,
        testid: current.getAttribute('data-testid') || null,
        ariaLabel: current.getAttribute('aria-label') || null,
        classes: [...current.classList].filter(c => c.length < 40).slice(0, 5),
      });
      current = current.parentElement;
    }
    return chain;
  }

  /** Captura filhos diretos resumidos */
  function getChildrenSummary(el, limit) {
    return [...el.children].slice(0, limit).map(child => ({
      tag: child.tagName.toLowerCase(),
      testid: child.getAttribute('data-testid') || null,
      ariaLabel: child.getAttribute('aria-label') || null,
      text: child.textContent?.trim().slice(0, 60) || null,
    }));
  }

  /** Coleta TODOS os atributos do elemento */
  function getAllAttributes(el) {
    const attrs = {};
    for (const attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /** Detecta contexto da tela atual do WhatsApp */
  function detectWAContext() {
    const contexts = [
      { name: 'Chat aberto', test: () => !!document.querySelector('[data-testid="conversation-panel-wrapper"]') },
      { name: 'Lista de conversas', test: () => !!document.querySelector('[data-testid="chat-list"]') },
      { name: 'Info do contato', test: () => !!document.querySelector('[data-testid="contact-info-drawer"]') },
      { name: 'Editor de contato', test: () => !!document.querySelector('[data-testid="contact-editor"]') },
      { name: 'Modal aberto', test: () => !!document.querySelector('[data-animate-modal-body="true"]') },
      { name: 'Menu de contexto', test: () => !!document.querySelector('[data-testid="menu-bar"]') },
    ];
    return contexts.filter(c => c.test()).map(c => c.name).join(' + ') || 'Contexto não identificado';
  }

  /** Gera bloco markdown para base de conhecimento */
  function generateMarkdown(data) {
    const d = new Date();
    const timestamp = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
    const waVersion = document.querySelector('meta[name="version"]')?.content || 'desconhecida';

    let md = `\n${'='.repeat(60)}\n`;
    md += `## Elemento: \`${data.tagName}\`\n`;
    md += `- **Coletado em:** ${timestamp}\n`;
    md += `- **Versão WA Web:** ${waVersion}\n`;
    md += `- **Contexto da tela:** ${data.waContext}\n\n`;

    md += `### Atributos Principais\n`;
    md += `| Atributo | Valor |\n|---|---|\n`;
    const mainAttrs = ['id', 'data-testid', 'aria-label', 'role', 'type', 'name', 'placeholder', 'title', 'value', 'href', 'contenteditable', 'tabindex', 'disabled'];
    mainAttrs.forEach(a => {
      if (data.allAttributes[a] !== undefined) {
        md += `| \`${a}\` | \`${data.allAttributes[a]}\` |\n`;
      }
    });

    md += `\n### Seletores CSS (por estabilidade)\n`;
    data.cssSelectors.forEach(s => {
      md += `- ${s.stability} **${s.strategy}:** \`${s.selector}\`\n`;
    });

    md += `\n### XPath\n`;
    md += `- **Relativo (preferido):** \`${data.xpathSmart}\`\n`;
    md += `- **Absoluto (fallback):** \`${data.xpathAbsolute}\`\n`;

    md += `\n### Conteúdo\n`;
    md += `- **Text content:** \`${data.textContent}\`\n`;
    md += `- **Inner HTML (resumido):** \`${data.innerHTML}\`\n`;

    if (data.reactProps) {
      md += `\n### React\n`;
      md += `- **Event handlers:** ${data.reactProps.eventHandlers?.join(', ') || 'nenhum'}\n`;
      md += `- **Props keys:** ${data.reactProps.propsKeys?.slice(0, 10).join(', ') || 'nenhuma'}\n`;
    }

    md += `\n### Hierarquia de Pais\n`;
    data.parentChain.forEach((p, i) => {
      const ident = '  '.repeat(i);
      md += `${ident}- \`${p.tag}\``;
      if (p.testid) md += ` [data-testid="${p.testid}"]`;
      if (p.ariaLabel) md += ` [aria-label="${p.ariaLabel}"]`;
      if (p.id) md += ` #${p.id}`;
      md += `\n`;
    });

    md += `\n### Filhos Diretos\n`;
    data.children.forEach(c => {
      md += `- \`${c.tag}\``;
      if (c.testid) md += ` [data-testid="${c.testid}"]`;
      if (c.text) md += ` → "${c.text}"`;
      md += `\n`;
    });

    md += `\n### Todos os Atributos\n\`\`\`json\n${JSON.stringify(data.allAttributes, null, 2)}\n\`\`\`\n`;
    md += `\n### Observações\n`;
    md += `- Funciona? [ ] Sim [ ] Não [ ] Às vezes\n`;
    md += `- Estabilidade: [ ] Alta [ ] Média [ ] Frágil\n`;
    md += `- Notas: _escreva aqui_\n`;
    md += `${'='.repeat(60)}\n`;

    return md;
  }

  // ─── PAINEL VISUAL ──────────────────────────────────────────

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = '__wa_inspector_panel__';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      max-height: 520px;
      background: #111b21;
      color: #e9edef;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border: 2px solid #25D366;
      border-radius: 12px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    panel.innerHTML = `
      <div id="__wa_inspector_header__" style="padding:10px 14px;background:#202c33;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none;">
        <span style="color:#25D366;font-weight:bold;font-size:13px;">🔍 WA Inspector</span>
        <div style="display:flex;gap:8px;">
          <button id="__wa_copy__" style="background:#25D366;color:#111;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;">📋 Copiar MD</button>
          <button id="__wa_close__" style="background:#f15c6d;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">✕</button>
        </div>
      </div>
      <div id="__wa_inspector_content__" style="padding:12px;overflow-y:auto;flex:1;line-height:1.6;">
        <div style="color:#8696a0;text-align:center;margin-top:40px;">
          Clique em qualquer elemento do WhatsApp<br>para inspecionar
        </div>
      </div>
      <div style="padding:8px 14px;background:#202c33;border-radius:0 0 10px 10px;font-size:10px;color:#8696a0;text-align:center;">
        Clique em qualquer elemento para inspecionar • ESC para desativar
      </div>
    `;
    document.body.appendChild(panel);

    // ── Drag to move ──────────────────────────────────────────
    const header = document.getElementById('__wa_inspector_header__');
    let dragging = false, startX, startY, origLeft, origTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      header.style.cursor = 'grabbing';

      const rect = panel.getBoundingClientRect();
      // Converte para top/left fixo caso esteja usando bottom/right
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';

      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;

      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, origLeft + dx)) + 'px';
      panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, origTop + dy)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        header.style.cursor = 'grab';
      }
    });
    // ─────────────────────────────────────────────────────────

    document.getElementById('__wa_close__').onclick = () => deactivate();
    document.getElementById('__wa_copy__').onclick = () => {
      if (window.__wa_last_markdown__) {
        navigator.clipboard.writeText(window.__wa_last_markdown__)
          .then(() => showToast('✅ Markdown copiado!'))
          .catch(() => showToast('❌ Erro ao copiar'));
      } else {
        showToast('⚠️ Nenhum dado coletado ainda');
      }
    };

    return panel;
  }

  function updatePanel(data) {
    const content = document.getElementById('__wa_inspector_content__');
    if (!content) return;

    const sel = data.cssSelectors[0];
    content.innerHTML = `
      <div style="margin-bottom:8px;">
        <span style="color:#25D366;font-weight:bold;">&lt;${data.tagName}&gt;</span>
        <span style="color:#8696a0;font-size:10px;margin-left:6px;">${data.waContext}</span>
      </div>

      ${data.cssSelectors.slice(0, 3).map(s => `
        <div style="margin-bottom:4px;">
          <span style="color:#8696a0;font-size:10px;">${s.stability} ${s.strategy}</span><br>
          <code style="color:#53bdeb;font-size:11px;word-break:break-all;">${s.selector}</code>
        </div>
      `).join('')}

      ${data.reactProps ? `
        <div style="margin-top:8px;padding:6px;background:#202c33;border-radius:6px;">
          <span style="color:#f0bc52;font-size:10px;">⚛️ React handlers:</span><br>
          <code style="color:#8696a0;font-size:10px;">${data.reactProps.eventHandlers?.join(', ') || 'nenhum'}</code>
        </div>
      ` : ''}

      ${data.allAttributes['data-testid'] ? `
        <div style="margin-top:8px;padding:6px;background:#1a2a22;border-radius:6px;">
          <span style="color:#25D366;font-size:10px;">✅ data-testid encontrado!</span><br>
          <code style="color:#e9edef;font-size:11px;">${data.allAttributes['data-testid']}</code>
        </div>
      ` : '<div style="margin-top:8px;padding:6px;background:#2a1a1a;border-radius:6px;color:#f15c6d;font-size:10px;">⚠️ Sem data-testid — seletor frágil</div>'}

      ${data.textContent ? `
        <div style="margin-top:8px;">
          <span style="color:#8696a0;font-size:10px;">Texto:</span><br>
          <span style="color:#e9edef;font-size:11px;">"${data.textContent}"</span>
        </div>
      ` : ''}

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #2a3942;font-size:10px;color:#8696a0;">
        ${data.parentChain.slice(0, 3).map(p =>
          `↑ <code>${p.tag}${p.testid ? `[data-testid="${p.testid}"]` : ''}</code>`
        ).join('<br>')}
      </div>
    `;
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
      position:fixed;top:20px;right:20px;background:#25D366;color:#111;
      padding:10px 18px;border-radius:8px;font-weight:bold;font-size:13px;
      z-index:999999;font-family:monospace;box-shadow:0 4px 16px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ─── HIGHLIGHT ──────────────────────────────────────────────

  let lastHighlighted = null;

  function highlight(el) {
    if (lastHighlighted) {
      lastHighlighted.style.outline = lastHighlighted.__wa_original_outline__ || '';
      lastHighlighted.__wa_original_outline__ = undefined;
    }
    if (el && el !== document.body) {
      el.__wa_original_outline__ = el.style.outline;
      el.style.outline = `2px solid ${CONFIG.highlightColor}`;
      lastHighlighted = el;
    }
  }

  // ─── CORE — coleta todos os dados ───────────────────────────

  function inspect(el) {
    if (!el || el.id === '__wa_inspector_panel__' || el.closest('#__wa_inspector_panel__')) return;

    const allAttributes = getAllAttributes(el);
    const cssSelectors = getCSSSelectors(el);
    const xpathSmart = getSmartXPath(el);
    const xpathAbsolute = getAbsoluteXPath(el);
    const reactProps = getReactProps(el);
    const parentChain = getParentChain(el, CONFIG.parentLevels);
    const children = getChildrenSummary(el, CONFIG.childrenLimit);
    const waContext = detectWAContext();
    const textContent = el.textContent?.trim().slice(0, 100) || '';
    const innerHTML = el.innerHTML?.trim().slice(0, 200) || '';

    const data = {
      tagName: el.tagName.toLowerCase(),
      allAttributes,
      cssSelectors,
      xpathSmart,
      xpathAbsolute,
      reactProps,
      parentChain,
      children,
      waContext,
      textContent,
      innerHTML,
    };

    const markdown = generateMarkdown(data);
    window.__wa_last_markdown__ = (window.__wa_last_markdown__ || '') + markdown;
    window.__wa_last_data__ = data;

    updatePanel(data);
    console.group(`%c[WA Inspector] <${data.tagName}>`, 'color:#25D366;font-weight:bold');
    console.log('%cSeletores CSS', 'color:#53bdeb;font-weight:bold', cssSelectors);
    console.log('%cXPath Relativo', 'color:#53bdeb', xpathSmart);
    console.log('%cReact Props', 'color:#f0bc52', reactProps);
    console.log('%cHierarquia de Pais', 'color:#8696a0', parentChain);
    console.log('%cTodos os Atributos', 'color:#e9edef', allAttributes);
    console.log('%cMarkdown gerado ↓\n', 'color:#25D366;font-style:italic', markdown);
    console.groupEnd();

    return data;
  }

  // ─── LISTENERS ──────────────────────────────────────────────

  function onClick(e) {
    inspect(e.target);
    highlight(e.target);
  }

  function onMouseOver(e) {
    if (e.target && !e.target.closest('#__wa_inspector_panel__')) {
      e.target.title = e.target.getAttribute('data-testid')
        ? `[testid: ${e.target.getAttribute('data-testid')}]`
        : `[${e.target.tagName.toLowerCase()}]`;
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') deactivate();
  }

  // ─── ATIVAR / DESATIVAR ─────────────────────────────────────

  function activate() {
    if (CONFIG.showPanel) createPanel();
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('keydown', onKeyDown);
    showToast('🟢 WA Inspector ativado — clique nos elementos para inspecionar');
    console.log('%c[WA Inspector] Ativado. Clique nos elementos para inspecionar. ESC para sair.', 'color:#25D366;font-size:14px;font-weight:bold');
  }

  function deactivate() {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('keydown', onKeyDown);
    document.getElementById('__wa_inspector_panel__')?.remove();
    if (lastHighlighted) lastHighlighted.style.outline = lastHighlighted.__wa_original_outline__ || '';
    window.__WA_INSPECTOR_ACTIVE__ = false;
    showToast('🔴 WA Inspector desativado');
    console.log('%c[WA Inspector] Desativado.', 'color:#f15c6d;font-weight:bold');

    // Exibe markdown acumulado
    if (window.__wa_last_markdown__) {
      console.log('%c[WA Inspector] Markdown acumulado desta sessão:\n', 'color:#f0bc52;font-weight:bold');
      console.log(window.__wa_last_markdown__);
    }
  }

  // ─── API GLOBAL ──────────────────────────────────────────────
  // Comandos disponíveis no console após ativar:
  //   WAInspector.copy()       → copia todo o markdown coletado
  //   WAInspector.clear()      → limpa o histórico
  //   WAInspector.last()       → retorna o último elemento inspecionado
  //   WAInspector.off()        → desativa o inspector

  window.WAInspector = {
    copy: () => {
      if (window.__wa_last_markdown__) {
        navigator.clipboard.writeText(window.__wa_last_markdown__)
          .then(() => console.log('%c[WA Inspector] ✅ Markdown copiado para área de transferência!', 'color:#25D366'))
          .catch(() => console.error('[WA Inspector] Erro ao copiar. Use window.__wa_last_markdown__ direto.'));
      } else {
        console.warn('[WA Inspector] Nenhum dado coletado ainda.');
      }
    },
    clear: () => {
      window.__wa_last_markdown__ = '';
      window.__wa_last_data__ = null;
      console.log('%c[WA Inspector] Histórico limpo.', 'color:#f0bc52');
    },
    last: () => window.__wa_last_data__,
    off: () => deactivate(),
  };

  activate();
})();
