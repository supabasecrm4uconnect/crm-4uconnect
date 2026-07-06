(function () {
  'use strict';

  // Guard: não reinjetar se já existe
  if (document.getElementById('crm-4u-root')) return;

  console.log('[Connect CRM] Content script carregado.');
  if (typeof crmLogger !== 'undefined') crmLogger.info('boot_script', 'Extensão For You Connect carregada no WhatsApp Web', {
    modulo: 'content.js',
    contexto: { versao: chrome.runtime.getManifest ? chrome.runtime.getManifest().version : null }
  });

  /* ===== CONFIGURAÇÃO ===== */

  const SUPABASE_URL = 'https://cimehhzkwgiwgfnkeauo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWVoaHprd2dpd2dmbmtlYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Nzk0NTEsImV4cCI6MjA5NzE1NTQ1MX0.lMAp7uK7_H3jRqGksZGVVH72bxyOISIOAefTPAlLxJI';

  // ⚠️ PRODUÇÃO: antes de entregar a extensão à atendente, troque o valor abaixo
  // pelo domínio real do CRM na Vercel. Ex.: 'https://crm.4uconnect.com.br'
  // (sem barra no final). Em desenvolvimento, mantenha 'http://localhost:5173'.
  // Este é o ÚNICO lugar do código que precisa mudar para apontar à produção.
  const CRM_URL = 'https://crm-4uconnect.vercel.app';

  const STORAGE_KEY = 'crm_4u_session';

  /* ===== STATUS CONFIG (dinâmico — carregado do DB) ===== */

  function getStatusCfg(value) {
    if (state && state.statuses) {
      var found = state.statuses.find(function (s) { return s.value === value; });
      if (found) return { label: found.label, color: found.color_text, bg: found.color_bg, dot: found.color_dot };
    }
    return { label: value, color: '#475569', bg: '#f1f5f9', dot: '#94a3b8' };
  }

  const ACTIVITY_TYPES = [
    { value: 'ligar', label: 'Ligar' },
    { value: 'enviar_mensagem', label: 'Enviar mensagem' },
    { value: 'retornar_orcamento', label: 'Retornar orçamento' },
    { value: 'cobrar_resposta', label: 'Cobrar resposta' },
    { value: 'reuniao', label: 'Reunião' },
    { value: 'enviar_proposta', label: 'Enviar proposta' },
    { value: 'pos_venda', label: 'Pós-venda' },
  ];

  /* ===== STORAGE ===== */

  function getSession() {
    return new Promise(function (resolve) {
      chrome.storage.local.get([STORAGE_KEY], function (r) {
        resolve(r[STORAGE_KEY] || null);
      });
    });
  }

  function saveSession(data) {
    return new Promise(function (resolve) {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  function clearSession() {
    return new Promise(function (resolve) {
      chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
  }

  function handleUnauthorized() {
    // Antes de derrubar pro login, verifica se a ponte já trouxe um token novo:
    // o token local pode ter ficado velho enquanto o CRM já renovou o dele. Se
    // houver um token diferente no storage, adota e NÃO desloga (a próxima
    // chamada reusa o token fresco). Só desloga se o storage também não tiver
    // sessão válida ou tiver o mesmo token que acabou de falhar.
    getSession().then(function (session) {
      if (session && session.access_token &&
        (!state.auth || session.access_token !== state.auth.access_token)) {
        console.log('[Connect CRM] 401 com token novo disponível — adotando sem deslogar.');
        state.auth = session;
        return;
      }
      forceLogout();
    });
  }

  function forceLogout() {
    if (typeof crmLogger !== 'undefined') crmLogger.warn('sessao_expirada', 'Token inválido — usuário deslogado da extensão automaticamente', {
      modulo: 'content.js',
      contexto: { url: location.href }
    });
    stopLeadPolling();
    clearSession();
    state.auth = null;
    state.current = { phone: null, name: null, lead: null };
    state.sources = [];
    state.segments = [];
    state.ui.view = 'login';
    state.ui.error = 'Sessão expirada. Faça login novamente.';
    render();
  }

  /* ===== API SUPABASE ===== */

  function doFetch(method, path, body, token) {
    var headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (method !== 'GET') headers['Prefer'] = 'return=representation';

    return fetch(SUPABASE_URL + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (res.status === 204) return null;
      if (res.status === 401) {
        var err = new Error('Sessão expirada');
        err.isUnauthorized = true;
        throw err;
      }
      if (!res.ok) {
        // Qualquer outro erro (400/403/409/500...) vira exceção — evita exibir
        // "salvo" quando o Supabase recusou a operação.
        return res.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error((body && (body.message || body.error)) || ('HTTP ' + res.status));
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    });
  }

  function apiRequest(method, path, body, token) {
    // A sessão vem exclusivamente do CRM (via session-bridge). A extensão não renova
    // tokens por conta própria — quando o token expirar, o usuário deve fazer login no CRM.
    return doFetch(method, path, body, token).catch(function (err) {
      if (err.isUnauthorized) handleUnauthorized();
      throw err;
    });
  }


  function getLeadByPhone(phone, token) {
    // Busca pelas duas variantes do número (com/sem 9º dígito) para não criar duplicados
    var variants = phoneVariants(phone);
    return apiRequest('GET', '/rest/v1/leads?whatsapp=in.(' + variants.join(',') + ')&select=*,lead_sources(id,nome),lead_segments(id,nome)&limit=1', null, token)
      .then(function (data) { return Array.isArray(data) ? data[0] || null : null; });
  }

  function createLead(body, token) {
    return apiRequest('POST', '/rest/v1/leads', body, token)
      .then(function (data) { return Array.isArray(data) ? data[0] : data; });
  }

  function updateLead(id, body, token) {
    return apiRequest('PATCH', '/rest/v1/leads?id=eq.' + id, body, token)
      .then(function (data) { return Array.isArray(data) ? data[0] : data; });
  }

  function insertStatusHistory(body, token) {
    return apiRequest('POST', '/rest/v1/lead_status_history', body, token);
  }

  function createActivity(body, token) {
    return apiRequest('POST', '/rest/v1/lead_activities', body, token);
  }

  function getSources(token) {
    return apiRequest('GET', '/rest/v1/lead_sources?ativo=eq.true&select=id,nome&order=nome', null, token)
      .then(function (d) { return Array.isArray(d) ? d : []; });
  }

  function getSegments(token) {
    return apiRequest('GET', '/rest/v1/lead_segments?ativo=eq.true&select=id,nome&order=nome', null, token)
      .then(function (d) { return Array.isArray(d) ? d : []; });
  }

  function getStatuses(token) {
    return apiRequest('GET', '/rest/v1/lead_statuses?ativo=eq.true&select=*&order=ordem', null, token)
      .then(function (d) { return Array.isArray(d) ? d : []; });
  }

  function getOrg(token) {
    // A RLS "Ver própria org" retorna apenas a organização do usuário logado
    return apiRequest('GET', '/rest/v1/organizations?select=nome,nome_exibicao&limit=1', null, token)
      .then(function (d) { return Array.isArray(d) && d.length ? d[0] : null; });
  }

  function loadLeadsCache(token) {
    return apiRequest('GET', '/rest/v1/leads?select=id,nome,whatsapp,status&order=updated_at.desc&limit=2000', null, token)
      .then(function (data) {
        if (!Array.isArray(data)) return;
        leadsCache = {};
        data.forEach(function (lead) {
          if (!lead.whatsapp) return;
          // Indexa sob TODAS as variantes do número (com/sem 9º dígito)
          phoneVariants(lead.whatsapp).forEach(function (v) { leadsCache[v] = lead; });
        });
        console.log('[Connect CRM] Cache de leads: ' + Object.keys(leadsCache).length + ' leads.');
      }).catch(function (err) { if (err && err.isUnauthorized) handleUnauthorized(); });
  }

  function syncRecentLeads(token) {
    var thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    return apiRequest('GET', '/rest/v1/leads?select=id,nome,whatsapp,status&updated_at=gte.' + thirtySecondsAgo, null, token)
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) return;
        var changed = false;
        data.forEach(function (lead) {
          if (!lead.whatsapp) return;
          phoneVariants(lead.whatsapp).forEach(function (v) {
            if (!leadsCache[v] || leadsCache[v].status !== lead.status || leadsCache[v].nome !== lead.nome) {
              leadsCache[v] = lead;
              changed = true;
            }
          });
        });
        if (changed) injectListBadges();
      }).catch(function (err) { if (err && err.isUnauthorized) handleUnauthorized(); });
  }

  /* ===== HELPERS ===== */

  function normalizePhone(input) {
    var d = String(input || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length >= 12) return d;
    if (d.startsWith('0')) return '55' + d.slice(1);
    return '55' + d;
  }

  // Celulares BR existem com e sem o 9º dígito (ex: 554299981280 ≡ 5542999981280).
  // WhatsApp e CRM podem armazenar formas diferentes do MESMO número — todo
  // indexamento e busca de telefone deve considerar as duas variantes.
  function phoneVariants(input) {
    var d = normalizePhone(input);
    var variants = [d];
    if (d.startsWith('55')) {
      var local = d.slice(2); // DDD + número
      if (local.length === 11 && local.charAt(2) === '9') {
        variants.push('55' + local.slice(0, 2) + local.slice(3)); // sem o 9
      } else if (local.length === 10 && local.charAt(2) >= '6') {
        // celulares começam com 6-9; fixos (2-5) nunca ganharam o 9º dígito
        variants.push('55' + local.slice(0, 2) + '9' + local.slice(2)); // com o 9
      }
    }
    return variants;
  }

  // Busca um lead no cache testando todas as variantes do número
  function cacheLookupByPhone(phone) {
    var variants = phoneVariants(phone);
    for (var i = 0; i < variants.length; i++) {
      if (leadsCache[variants[i]]) return leadsCache[variants[i]];
    }
    return null;
  }

  // Normaliza nomes para comparação: colapsa espaços múltiplos e ignora caixa.
  // (Leads podem ter espaços duplos digitados; WhatsApp exibe o nome normalizado.)
  function normalizeName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function formatPhone(number) {
    var d = number.replace(/\D/g, '');
    var local = d.startsWith('55') ? d.slice(2) : d;
    if (local.length === 11) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 7) + '-' + local.slice(7);
    if (local.length === 10) return '(' + local.slice(0, 2) + ') ' + local.slice(2, 6) + '-' + local.slice(6);
    return number;
  }

  function getInitials(name) {
    return (name || '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  var AVATAR_COLORS = [
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#ede9fe', color: '#7c3aed' },
    { bg: '#d1fae5', color: '#065f46' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#fce7f3', color: '#9d174d' },
    { bg: '#cffafe', color: '#0e7490' },
  ];

  function getAvatarColor(name) {
    var sum = (name || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function avatarHtml(name, photo) {
    if (photo && (photo.startsWith('data:image') || photo.startsWith('https'))) {
      return '<img src="' + escapeHtml(photo) + '" ' +
        'style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" ' +
        'alt="" onerror="this.replaceWith(document.createTextNode(\'' + escapeHtml(getInitials(name || '?')) + '\'))">';
    }
    var ac = getAvatarColor(name || '?');
    return '<div class="crm-avatar" style="background:' + ac.bg + ';color:' + ac.color + '">' + escapeHtml(getInitials(name || '?')) + '</div>';
  }

  function statusBadgeHtml(status) {
    var cfg = getStatusCfg(status);
    return '<span class="crm-badge" style="background:' + cfg.bg + ';color:' + cfg.color + '">' +
      '<span class="crm-badge-dot" style="background:' + cfg.dot + '"></span>' +
      escapeHtml(cfg.label) + '</span>';
  }

  function statusOptions(selected) {
    var list = state.statuses.length
      ? state.statuses.map(function (s) { return { value: s.value, label: s.label }; })
      : [{ value: 'novo_lead', label: 'Novo lead' }];
    return list.map(function (s) {
      return '<option value="' + s.value + '"' + (s.value === selected ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    }).join('');
  }

  function sourceOptions(sources, selected) {
    var opts = (sources || []).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + escapeHtml(s.nome) + '</option>';
    }).join('');
    return '<option value="">Selecionar</option>' + opts;
  }

  function segmentOptions(segments, selected) {
    var opts = (segments || []).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + escapeHtml(s.nome) + '</option>';
    }).join('');
    return '<option value="">Selecionar</option>' + opts;
  }

  function activityTypeOptions(selected) {
    return ACTIVITY_TYPES.map(function (t) {
      return '<option value="' + t.value + '"' + (t.value === selected ? ' selected' : '') + '>' + escapeHtml(t.label) + '</option>';
    }).join('');
  }

  // Ícones (SVG inline, estilo lucide) para colocar dentro dos campos
  function svgIcon(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var ICON = {
    user: svgIcon('<circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/>'),
    phone: svgIcon('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    flag: svgIcon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
    globe: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    tag: svgIcon('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
    dollar: svgIcon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    file: svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    list: svgIcon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
    calendar: svgIcon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    clock: svgIcon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    mail: svgIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>'),
    lock: svgIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  };

  // Monta um .crm-field com ícone dentro do controle (input/select/textarea).
  // `top=true` alinha o ícone ao topo (para textarea).
  function fieldIcon(label, icon, controlHtml, top) {
    return '<div class="crm-field"><label class="crm-label">' + label + '</label>'
      + '<div class="crm-input-wrap' + (top ? ' crm-wrap-top' : '') + '">' + icon + controlHtml + '</div></div>';
  }

  // Conteúdo interno do container de tags (chips + input) — reusado no render
  // completo e no renderTagsOnly (atualização no lugar, sem reconstruir o painel)
  function tagsInnerHtml(tags) {
    var chips = (tags || []).map(function (tag) {
      return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#f1f5f9;color:#475569;border-radius:999px;font-size:11px;font-weight:500">' +
        escapeHtml(tag) +
        '<button type="button" data-remove-tag="' + escapeHtml(tag) + '" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;line-height:1;color:#94a3b8;font-size:14px;display:flex;align-items:center">\xd7</button>' +
        '</span>';
    }).join('');
    return chips +
      '<input id="crm-tag-input" type="text" placeholder="' + ((tags && tags.length) ? '' : 'Adicionar tag...') + '" style="border:none;outline:none;font-size:12px;color:#0f172a;background:transparent;min-width:80px;flex:1;padding:1px 2px;font-family:inherit" />';
  }

  function tagsFieldHtml(tags) {
    return '<div class="crm-field">' +
      '<label class="crm-label">Tags</label>' +
      '<div class="crm-input-wrap crm-wrap-top">' + ICON.tag +
      '<div id="crm-tags-container" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:6px 8px 6px 30px;border:1px solid #e2e8f0;border-radius:8px;min-height:36px;background:#fff;cursor:text" onclick="document.getElementById(\'crm-tag-input\')&&document.getElementById(\'crm-tag-input\').focus()">' +
      tagsInnerHtml(tags) +
      '</div>' +
      '</div>' +
      '<p style="font-size:10px;color:#94a3b8;margin:3px 0 0">Enter ou vírgula para adicionar</p>' +
      '</div>';
  }

  /* ===== AGUARDA ELEMENTO NO DOM ===== */

  function waitForElement(selector, timeoutMs) {
    return new Promise(function (resolve) {
      var el = document.querySelector(selector);
      if (el) { resolve(el); return; }

      var timer = setTimeout(function () {
        obs.disconnect();
        console.warn('[Connect CRM] Timeout aguardando:', selector);
        resolve(null);
      }, timeoutMs || 15000);

      var obs = new MutationObserver(function () {
        var found = document.querySelector(selector);
        if (found) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(found);
        }
      });

      var target = document.body || document.documentElement;
      obs.observe(target, { childList: true, subtree: true });
    });
  }

  /* ===== COMUNICAÇÃO COM O MUNDO DA PÁGINA ===== */
  // Content scripts rodam em "isolated world": propriedades expando definidas pela página
  // em elementos DOM (__reactFiber*, etc.) NÃO são visíveis aqui.
  // Solução: inject.js corre no mundo da página, lê o fiber e responde via postMessage.

  var pageScriptPromise = null;

  function ensurePageScript() {
    if (pageScriptPromise) return pageScriptPromise;
    pageScriptPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = function () {
        console.log('[Connect CRM] inject.js pronto no page world.');
        if (typeof crmLogger !== 'undefined') crmLogger.info('boot_inject_js', 'inject.js carregado no page world — leitura de fiber React ativa', { modulo: 'content.js' });
        resolve();
      };
      script.onerror = function () {
        console.warn('[Connect CRM] Falha ao carregar inject.js.');
        pageScriptPromise = null;
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
    return pageScriptPromise;
  }

  function getContactFromPageWorld() {
    return ensurePageScript().then(function () {
      return new Promise(function (resolve) {
        var timer = setTimeout(function () {
          window.removeEventListener('message', handler);
          console.log('[Connect CRM] Page world: timeout.');
          resolve(null);
        }, 2000);

        function handler(e) {
          if (!e.data || e.data.source !== 'crm4u_inject' || e.data.type !== 'PHONE_RESULT') return;
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve({
            phone: e.data.phone || null,
            name: e.data.name || null,
            isGroup: !!e.data.isGroup,
            photo: e.data.photo || null,
          });
        }

        window.addEventListener('message', handler);
        window.postMessage({ source: 'crm4u_cs', type: 'GET_PHONE' }, '*');
      });
    });
  }

  /* ===== FOTO DE PERFIL ===== */

  // Converte a foto do contato em data URI permanente.
  // - data:image → já está pronta (veio do inject.js, possivelmente convertida de blob:)
  // - https://pps.whatsapp.net → URL do CDN do WhatsApp, EXPIRA em semanas; o
  //   background service worker faz o fetch (content script é bloqueado por CORS)
  // - qualquer outra coisa → descarta (nunca persistir URL que expira no banco)
  function resolvePhotoToDataUri(photo) {
    if (!photo) return Promise.resolve(null);
    if (photo.startsWith('data:image')) {
      console.log('[Connect CRM][foto] Já é data URI (' + photo.length + ' chars).');
      return Promise.resolve(photo);
    }
    if (!/^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//.test(photo)) {
      console.log('[Connect CRM][foto] Fonte descartada (formato não suportado):', photo.slice(0, 60));
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_PHOTO', url: photo }, function (resp) {
          if (chrome.runtime.lastError) {
            console.warn('[Connect CRM][foto] Erro no background:', chrome.runtime.lastError.message);
            resolve(null); return;
          }
          if (!resp || !resp.dataUri) {
            console.warn('[Connect CRM][foto] Background não retornou foto. resp:', JSON.stringify(resp).slice(0, 100));
            resolve(null); return;
          }
          // Guarda de tamanho: thumbnails têm ~5-30KB; acima de 150KB algo está errado
          if (resp.dataUri.length > 200000) {
            console.warn('[Connect CRM][foto] Foto muito grande, descartada:', resp.dataUri.length);
            resolve(null); return;
          }
          console.log('[Connect CRM][foto] Convertida para base64 (' + resp.dataUri.length + ' chars).');
          resolve(resp.dataUri);
        });
      } catch (e) {
        console.warn('[Connect CRM][foto] Exceção no sendMessage (página precisa de F5 após recarregar a extensão?):', e.message);
        resolve(null);
      }
    });
  }

  /* ===== BADGES NA LISTA DE CONVERSAS ===== */

  function requestAnnotateChats() {
    return ensurePageScript().then(function () {
      return new Promise(function (resolve) {
        // 400ms é suficiente — inject.js responde em milissegundos quando bem-sucedido
        var timer = setTimeout(function () {
          window.removeEventListener('message', handler);
          resolve();
        }, 400);
        function handler(e) {
          if (!e.data || e.data.source !== 'crm4u_inject' || e.data.type !== 'ANNOTATE_CHATS_DONE') return;
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve();
        }
        window.addEventListener('message', handler);
        window.postMessage({ source: 'crm4u_cs', type: 'ANNOTATE_CHATS' }, '*');
      });
    });
  }

  // Varre todas as linhas visíveis e aplica/atualiza badges.
  // Chamado duas vezes por injectListBadges: uma imediata (nameMap only) e uma após anotação por fiber.
  function scanRows(nameMap) {
    document.querySelectorAll('[data-testid="cell-frame-container"]').forEach(function (row) {
      var titleEl = row.querySelector('[data-testid="cell-frame-title"]');
      if (!titleEl) return;

      var lead = null;

      // Lookup 1: por telefone (anotado via inject.js — contatos não salvos e após re-render do fiber)
      var rawPhone = row.getAttribute('data-crm-phone');
      if (rawPhone) {
        lead = cacheLookupByPhone(rawPhone);
      }

      // Lookup 2: por nome — span[dir="auto"] tem o nome puro sem ícones concatenados (ex: ic-label-filled)
      if (!lead) {
        var nameSpan = titleEl.querySelector('span[dir="auto"]');
        var text = nameSpan
          ? (nameSpan.getAttribute('title') || nameSpan.textContent || '')
          : (titleEl.textContent || '');
        var nameKey = normalizeName(text);
        if (nameKey) lead = nameMap[nameKey] || null;
      }

      var existing = titleEl.querySelector('[data-crm-badge]');
      var existingStatus = existing && existing.getAttribute('data-crm-status');

      if (lead) {
        if (existing && existingStatus === lead.status) return;
        if (existing) existing.remove();
      } else {
        // Só remove se temos certeza (phone anotado mas sem match no cache)
        // Sem phone annotation = fiber falhou = mantém badge existente para não piscar
        if (rawPhone && existing) existing.remove();
        return;
      }

      var cfg = getStatusCfg(lead.status);
      var badge = document.createElement('span');
      badge.setAttribute('data-crm-badge', '1');
      badge.setAttribute('data-crm-status', lead.status);
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 6px;border-radius:999px;font-size:11px;font-weight:600;flex-shrink:0;white-space:nowrap;vertical-align:middle;line-height:1.4;background:' + cfg.bg + ';color:' + cfg.color;

      var dot = document.createElement('span');
      dot.style.cssText = 'width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;background:' + cfg.dot;
      badge.appendChild(dot);
      badge.appendChild(document.createTextNode(cfg.label));

      titleEl.style.display = 'flex';
      titleEl.style.alignItems = 'center';
      titleEl.style.gap = '4px';
      titleEl.style.overflow = 'hidden';
      titleEl.appendChild(badge);
    });
  }

  function injectListBadges() {
    if (!state.auth || Object.keys(leadsCache).length === 0) return;

    var nameMap = {};
    Object.keys(leadsCache).forEach(function (phone) {
      var lead = leadsCache[phone];
      var key = normalizeName(lead.nome);
      if (key) nameMap[key] = lead;
    });

    // Passo 1: scan imediato por nome (sem esperar fiber) — badges aparecem em <10ms
    scanRows(nameMap);

    // Passo 2: anota telefones via fiber walk no page world e refaz o scan (cobre não-salvos)
    requestAnnotateChats().then(function () {
      scanRows(nameMap);
    });
  }

  /* ===== EXTRAÇÃO DE NOME VIA DOM (fallback) ===== */

  function extractNameFromDom() {
    var selectors = [
      '[data-testid="conversation-info-header-chat-title"] span',
      '[data-testid="conversation-info-header"] span[dir]',
      '#main header span[dir="auto"]',
      '#main header h1',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      var text = el && (el.textContent || el.getAttribute('title') || '');
      if (text && text.trim().length > 0) return text.trim();
    }
    return null;
  }

  /* ===== ESTADO GLOBAL ===== */

  var leadsCache = {}; // normalizedPhone → { id, nome, whatsapp, status }

  var state = {
    visible: false,
    auth: null,
    sources: [],
    segments: [],
    statuses: [],
    pendingFollowups: 0,
    avisosList: [],  // lista detalhada de atividades pendentes para a aba Avisos Gerais
    current: { phone: null, name: null, lead: null, photo: null },
    ui: { view: 'loading', saving: false, error: '', success: '', tab: 'dados', animate: false },
    form: { nome: '', status: 'novo_lead', origem_id: '', segmento_id: '', observacao: '', valor: '', tags: [] },
    followupForm: { tipo: 'enviar_mensagem', data: '', hora: '', descricao: '' },
  };

  /* ===== FOLLOW-UP BADGE ===== */

  function todayLocalStr() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function fetchPendingFollowups(token) {
    if (!token) return;
    var today = todayLocalStr();
    // Busca com dados do lead para popular a aba Avisos Gerais
    apiRequest(
      'GET',
      '/rest/v1/lead_activities' +
      '?status_atividade=eq.pendente' +
      '&data_agendada=lte.' + today +
      '&select=id,tipo_atividade,data_agendada,hora_agendada,descricao,leads(id,nome,whatsapp)' +
      '&order=data_agendada.asc,hora_agendada.asc',
      null,
      token
    ).then(function (data) {
      var list = Array.isArray(data) ? data : [];
      var count = list.length;
      state.avisosList = list;
      if (state.pendingFollowups !== count) {
        state.pendingFollowups = count;
        renderFollowupBadge();
      }
      // Re-renderiza a aba Avisos se estiver ativa
      if (state.ui.tab === 'avisos') render();
    }).catch(function (err) { if (err && err.isUnauthorized) handleUnauthorized(); });
  }

  function renderFollowupBadge() {
    var badge = document.getElementById('crm-followup-badge');
    if (!badge) return;
    var count = state.pendingFollowups;
    if (count > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = count > 9 ? '9+' : String(count);
    } else {
      badge.style.display = 'none';
    }
  }

  /* ===== DOM ===== */

  function injectSidebar() {
    var toggle = document.createElement('div');
    toggle.id = 'crm-4u-toggle';
    toggle.title = 'Abrir/fechar CRM';
    toggle.className = 'crm-toggle-hidden';
    toggle.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    toggle.addEventListener('click', toggleSidebar);
    document.body.appendChild(toggle);

    var root = document.createElement('div');
    root.id = 'crm-4u-root';
    root.className = 'crm-hidden';
    root.innerHTML = [
      '<div class="crm-header">',
      '<div class="crm-logo">',
      '<span class="crm-logo-text">Connect CRM</span>',
      '</div>',
      '<div style="display:flex;align-items:center;gap:6px">',
      '<a id="crm-followup-badge" href="' + CRM_URL + '/followups" target="_blank"',
      ' title="Follow-ups pendentes — clique para abrir o CRM"',
      ' style="display:none;align-items:center;justify-content:center;',
      'min-width:18px;height:18px;padding:0 5px;border-radius:999px;',
      'background:#ef4444;color:#fff;font-size:10px;font-weight:700;',
      'line-height:1;text-decoration:none;cursor:pointer;',
      'box-shadow:0 0 0 2px rgba(239,68,68,0.25);',
      'animation:crm-badge-pulse 2s infinite">',
      '</a>',
      '<button class="crm-header-btn" id="crm-refresh-btn" title="Recarregar">',
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>',
      '<path d="M21 3v5h-5"/>',
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>',
      '<path d="M8 16H3v5"/>',
      '</svg>',
      '</button>',
      '</div>',
      '</div>',
      '<div class="crm-content" id="crm-content"></div>',
    ].join('');
    document.body.appendChild(root);

    document.getElementById('crm-refresh-btn').addEventListener('click', function () {
      state.current.phone = null; // force reload
      detectAndLoad();
    });

    console.log('[Connect CRM] Sidebar injetado no DOM.');
    if (typeof crmLogger !== 'undefined') crmLogger.info('boot_sidebar', 'Painel lateral do CRM injetado no DOM do WhatsApp Web', { modulo: 'content.js' });
  }

  function toggleSidebar() {
    var root = document.getElementById('crm-4u-root');
    var toggle = document.getElementById('crm-4u-toggle');
    if (!root || !toggle) return;

    state.visible = !state.visible;
    state.hiddenByWA = false;
    if (state.visible) {
      root.classList.remove('crm-hidden');
      toggle.classList.remove('crm-toggle-hidden'); // move para right:576px (colado ao painel)
      toggle.querySelector('path').setAttribute('d', 'M8 2L4 6L8 10');
      state.ui.animate = true; // anima ao expandir o painel
      render();
    } else {
      root.classList.add('crm-hidden');
      toggle.classList.add('crm-toggle-hidden'); // move para right:0 (aba na borda direita)
      toggle.querySelector('path').setAttribute('d', 'M4 2L8 6L4 10');
    }
  }

  /**
   * Detecta painéis nativos do WhatsApp Web e auto-oculta a sidebar do CRM.
   *
   * Usa setInterval (não MutationObserver) porque o WhatsApp faz centenas de
   * mutações React por segundo, o que fazia o debounce do observer nunca disparar.
   *
   * Seletores confirmados via diagnóstico real:
   *   save-contact-drawer → painel de Adicionar/Salvar Contato (não existe no DOM normal)
   */
  function watchWhatsAppModals() {
    // Seletores que APENAS existem quando um painel nativo está aberto
    var WA_SELECTORS = [
      '[data-testid="drawer-right"]',          // Container genérico do painel direito (cobre qualquer aba direita)
      '[data-testid="save-contact-drawer"]',   // Adicionar/Salvar Contato
      '[data-testid="contact-info-1"]',         // Info do Contato
      '[data-testid="group-info"]',             // Info do Grupo
      '[data-testid="profile-view"]',           // Perfil
      '[data-testid="settings-view"]',          // Configurações
    ].join(', ');


    function isWAPanelOpen() {
      return !!document.querySelector(WA_SELECTORS);
    }

    function hideSidebarForWA() {
      var root = document.getElementById('crm-4u-root');
      var toggle = document.getElementById('crm-4u-toggle');
      if (!root || !toggle || !state.visible) return;

      console.log('[Connect CRM] Painel WA detectado — ocultando sidebar.');
      state.visible = false;
      state.hiddenByWA = true;
      root.classList.add('crm-hidden');
      toggle.classList.add('crm-toggle-hidden');
      toggle.querySelector('path').setAttribute('d', 'M4 2L8 6L4 10');
      toggle.title = 'CRM oculto — clique para restaurar';
      toggle.style.borderLeft = '3px solid #10b981';
    }

    function restoreSidebarAfterWA() {
      var root = document.getElementById('crm-4u-root');
      var toggle = document.getElementById('crm-4u-toggle');
      if (!root || !toggle || !state.hiddenByWA) return;

      console.log('[Connect CRM] Painel WA fechado — restaurando sidebar.');
      state.visible = true;
      state.hiddenByWA = false;
      root.classList.remove('crm-hidden');
      toggle.classList.remove('crm-toggle-hidden');
      toggle.querySelector('path').setAttribute('d', 'M8 2L4 6L8 10');
      toggle.title = 'Abrir/fechar CRM';
      toggle.style.borderLeft = '';
    }

    var panelWasOpen = false;

    setInterval(function () {
      var open = isWAPanelOpen();

      if (open && !panelWasOpen) {
        panelWasOpen = true;
        hideSidebarForWA();
      } else if (!open && panelWasOpen) {
        panelWasOpen = false;
        // Aguarda animação de fechar do WA antes de restaurar
        setTimeout(restoreSidebarAfterWA, 400);
      }
    }, 300);
  }

  function setReactInputValue(input, value) {
    try {
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Lexical/contenteditable: usar Range explícita para garantir seleção correta antes de execCommand.
        // execCommand('selectAll') pode não selecionar o elemento certo se o foco tiver mudado.
        // insertText('') é no-op no Lexical — usar execCommand('delete') com seleção explícita.
        input.focus();
        if (value === '') {
          try {
            var range = document.createRange();
            range.selectNodeContents(input);
            var sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          } catch (rangeErr) {
            document.execCommand('selectAll', false, null);
          }
          document.execCommand('delete', false, null);
        } else {
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, value);
        }
      }
    } catch (err) {
      console.error('[Connect CRM] Erro ao setar valor do input:', err);
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        try {
          input.focus();
          document.execCommand('selectAll', false, null);
          if (value === '') { document.execCommand('delete', false, null); }
          else { document.execCommand('insertText', false, value); }
        } catch (e) { }
      }
    }
  }

  function simulateClick(el) {
    if (!el) return;
    try {
      var events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      events.forEach(function (eventName) {
        var ev;
        if (eventName.indexOf('pointer') === 0) {
          ev = new PointerEvent(eventName, {
            bubbles: true,
            cancelable: true,
            view: window
          });
        } else {
          ev = new MouseEvent(eventName, {
            bubbles: true,
            cancelable: true,
            view: window
          });
        }
        el.dispatchEvent(ev);
      });
    } catch (e) {
      console.error('[Connect CRM] Erro ao simular clique:', e);
      el.click();
    }
  }

  /* ============================================================
   * MOTOR INTELIGENTE — salvar/editar contato no WhatsApp Web
   * (portado/adaptado do lab wa-crm-lab-v5-smart; sem UI/comunidade/
   *  painel próprio/modo discreto/localStorage). Espera por condição
   *  (MutationObserver+timeout), abre add OU editar, preenche o Nome
   *  (nome completo; Sobrenome vazio) sem duplicar, salva e trata popups.
   * ============================================================ */

  function waEsperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function waAguardarCondicao(condicao, opcoes) {
    opcoes = opcoes || {};
    var timeout = opcoes.timeout || 8000;
    var intervalo = opcoes.intervalo || 50;
    var descricao = opcoes.descricao || 'condicao';
    return new Promise(function (resolve, reject) {
      var fim = false, obs = null, ti = null, tt = null;
      function limpar() { fim = true; if (obs) obs.disconnect(); clearInterval(ti); clearTimeout(tt); }
      function checar() {
        if (fim) return;
        var r = null;
        try { r = condicao(); } catch (e) { r = null; }
        if (r) { limpar(); resolve(r); }
      }
      checar();
      if (fim) return;
      obs = new MutationObserver(checar);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'aria-hidden', 'aria-expanded', 'style', 'class', 'data-testid'] });
      ti = setInterval(checar, intervalo);
      tt = setTimeout(function () { limpar(); reject(new Error('Timeout aguardando ' + descricao)); }, timeout);
    });
  }

  function waVisivel(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var st = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
  }

  function waNorm(v) {
    return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function waTexto(el) {
    return String((el && el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || (el && el.innerText) || (el && el.textContent) || '').trim();
  }

  function waBuscarPorTexto(textos, root) {
    root = root || document;
    var alvos = (Array.isArray(textos) ? textos : [textos]).map(waNorm);
    var cands = root.querySelectorAll('button,[role="button"],[role="menuitem"],div[tabindex],span,li');
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (!waVisivel(el)) continue;
      var t = waNorm(el.innerText || el.textContent || '');
      var a = waNorm(el.getAttribute('aria-label') || '');
      var ti = waNorm(el.getAttribute('title') || '');
      for (var j = 0; j < alvos.length; j++) {
        if (t === alvos[j] || a === alvos[j] || ti === alvos[j]) {
          return el.closest('button,[role="button"],[role="menuitem"],div[tabindex],li') || el;
        }
      }
    }
    return null;
  }

  function waConversaSelecionada() {
    return waVisivel(document.querySelector('#main'));
  }

  function waCadastroAberto() {
    var drawer = document.querySelector('[data-testid="save-contact-drawer"]');
    var nome = document.querySelector('[aria-label="Nome"][contenteditable="true"], [aria-label="Name"][contenteditable="true"]');
    return !!((drawer && waVisivel(drawer)) || waVisivel(nome));
  }

  function waMaisOpcoes() {
    return document.querySelector('#main header [aria-label="Mais opções"]') ||
      document.querySelector('#main header [aria-label="More options"]') ||
      document.querySelector('button[aria-label="Mais opções"][data-tab="6"]') ||
      document.querySelector('header [aria-label="Mais opções"]') ||
      document.querySelector('header [aria-label="More options"]');
  }

  function waBtnAdicionar(root) {
    root = root || document;
    var direto = Array.prototype.find.call(
      root.querySelectorAll('[aria-label="Add to contacts"],[aria-label="Adicionar aos contatos"],[aria-label="Adicionar aos contactos"]'),
      waVisivel
    );
    return direto || waBuscarPorTexto(['Add to contacts', 'Adicionar aos contatos', 'Adicionar aos contactos', 'Novo contato', 'New contact'], root);
  }

  function waBtnPersonAdd(root) {
    root = root || document;
    var ic = Array.prototype.find.call(root.querySelectorAll('span, svg title'), function (el) {
      return waNorm(el.textContent || '') === 'ic-person-add';
    });
    if (!ic) return null;
    var btn = ic.closest('button,[role="button"],div[tabindex]') || ic;
    return waVisivel(btn) ? btn : null;
  }

  function waBtnDadosContato(root) {
    root = root || document;
    var direto = Array.prototype.find.call(
      root.querySelectorAll('[aria-label="Dados do contato"],[aria-label="Dados do perfil"],[aria-label="Contact info"],[aria-label="Ver contato"],[aria-label="View contact"]'),
      waVisivel
    );
    return direto || waBuscarPorTexto(['Dados do contato', 'Dados do perfil', 'Contact info', 'Ver contato', 'View contact'], root);
  }

  function waBtnEditar(root) {
    root = root || document;
    var ic = Array.prototype.find.call(
      root.querySelectorAll('[data-icon="pencil-refreshed"],[data-testid="pencil-refreshed"],[aria-label="Editar"],[aria-label="Edit"]'),
      function (el) {
        if (!waVisivel(el)) return false;
        var btn = el.closest('button,[role="button"],div[tabindex]') || el;
        var cont = btn.closest('section,aside,[role="dialog"],div');
        var tc = waNorm((cont && (cont.innerText || cont.textContent)) || '');
        if (tc.indexOf('adicione notas') !== -1 || tc.indexOf('notas sobre') !== -1) return false;
        return true;
      }
    );
    if (ic) return ic.closest('button,[role="button"],div[tabindex]') || ic;
    return waBuscarPorTexto(['Editar', 'Edit'], root);
  }

  // Reaproveita o simulateClick (pointer+mouse). Aqui só um wrapper seguro.
  function waClick(el) { if (el) simulateClick(el); }

  function waAbrirMenuMaisOpcoes() {
    return waAguardarCondicao(waMaisOpcoes, { timeout: 2500, descricao: 'Mais opções' })
      .then(function (btn) {
        waClick(btn);
        return waAguardarCondicao(function () {
          return waBtnAdicionar() || waBtnDadosContato() || document.querySelector('[role="menu"]');
        }, { timeout: 1600, descricao: 'menu de opções' }).catch(function () { return null; });
      });
  }

  // Abre o drawer de cadastro: ADICIONA se não é contato, EDITA se já é.
  function waAbrirDrawer() {
    if (waCadastroAberto()) return Promise.resolve(true);

    var add = waBtnPersonAdd() || waBtnAdicionar();
    var p;
    if (add) {
      waClick(add);
      p = waAguardarCondicao(waCadastroAberto, { timeout: 6000, descricao: 'cadastro de contato' }).then(function () { return true; });
    } else {
      var edit = waBtnEditar();
      if (edit) {
        waClick(edit);
        p = waAguardarCondicao(waCadastroAberto, { timeout: 6000, descricao: 'cadastro de contato' }).then(function () { return true; });
      } else {
        p = Promise.reject(new Error('sem botão visível'));
      }
    }

    // Fallback: abrir pelo menu "Mais opções" → Adicionar OU Dados do contato → Editar
    return p.catch(function () {
      return waAbrirMenuMaisOpcoes().then(function () {
        var addMenu = waBtnAdicionar();
        if (addMenu) {
          waClick(addMenu);
          return waAguardarCondicao(waCadastroAberto, { timeout: 6000, descricao: 'cadastro de contato' }).then(function () { return true; });
        }
        var dados = waBtnDadosContato();
        if (dados) {
          waClick(dados);
          return waAguardarCondicao(waBtnEditar, { timeout: 6000, descricao: 'botão Editar' }).then(function (eb) {
            waClick(eb);
            return waAguardarCondicao(waCadastroAberto, { timeout: 6000, descricao: 'cadastro de contato' }).then(function () { return true; });
          });
        }
        throw new Error('Não encontrei opção de adicionar/editar contato.');
      });
    });
  }

  // Limpeza real de campo contenteditable (Lexical) — evita nome duplicado.
  // Dispara input/change para o editor do WhatsApp (Lexical) atualizar o estado interno.
  // Sem isto, limpar via textContent não "gruda" e o valor antigo volta no save.
  function waDispararInput(el, inputType, data) {
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: inputType || 'insertText', data: data || null }));
    } catch (e) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waLimparCampo(el) {
    if (!el) return Promise.resolve();
    el.focus(); el.click();
    var tentativa = 0;
    function passo() {
      try {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) { }
      return waEsperar(70).then(function () {
        document.execCommand('delete', false, null);
        try {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
        } catch (e) { }
        try { window.getSelection().removeAllRanges(); } catch (e) { }
        waDispararInput(el, 'deleteContentBackward', null);
        return waEsperar(150);
      }).then(function () {
        var vazio = !(el.innerText || el.textContent || '').trim();
        if (!vazio && tentativa++ < 3) return passo();
        return null;
      });
    }
    return waEsperar(120).then(passo).then(function () {
      // Fallback: se ainda tem conteúdo, zera e AVISA o Lexical via input event.
      if ((el.innerText || el.textContent || '').trim()) {
        el.textContent = ''; el.innerHTML = '';
        waDispararInput(el, 'deleteContentBackward', null);
        return waEsperar(180);
      }
    }).then(function () {
      // Garantia final
      el.textContent = ''; el.innerHTML = '';
      waDispararInput(el, 'deleteContentBackward', null);
      return waEsperar(100);
    });
  }

  // Preenche um campo contenteditable com `valor` (ou limpa se vazio).
  function waPreencher(el, valor) {
    if (!el) return Promise.resolve();
    var txt = String(valor || '').trim();
    var pre = Promise.resolve();
    if (document.activeElement && document.activeElement !== el) {
      try { document.activeElement.blur(); } catch (e) { }
      pre = waEsperar(120);
    }
    return pre.then(function () {
      el.focus(); el.click();
      return waEsperar(180);
    }).then(function () {
      return waLimparCampo(el);
    }).then(function () {
      if (!txt) return;
      el.focus(); el.click();
      return waEsperar(80).then(function () {
        document.execCommand('insertText', false, txt);
        return waEsperar(180);
      }).then(function () {
        if ((el.innerText || '').trim() !== txt) {
          // Fallback: o editor não aceitou o insert — força o texto e avisa o Lexical.
          el.textContent = ''; el.innerHTML = '';
          return waEsperar(80).then(function () {
            el.textContent = txt;
            waDispararInput(el, 'insertText', txt);
            return waEsperar(120);
          });
        }
        // Sucesso: dispara o input UMA vez (sem isto antes da checagem, p/ não duplicar).
        waDispararInput(el, 'insertText', txt);
        return waEsperar(60);
      });
    }).then(function () {
      return waEsperar(120);
    }).then(function () { try { el.blur(); } catch (e) { } return waEsperar(100); });
  }

  // Liga o toggle "Sincronizar com celular" via React fiber (mais confiável que click()).
  function waLigarSync(el) {
    var fiberOk = false;
    try {
      var ks = Object.keys(el);
      var fk = null;
      for (var i = 0; i < ks.length; i++) {
        if (ks[i].startsWith('__reactFiber') || ks[i].startsWith('__reactInternalInstance')) { fk = ks[i]; break; }
      }
      if (fk) {
        var nd = el[fk], dpt = 0;
        while (nd && dpt++ < 15) {
          if (nd.memoizedProps && typeof nd.memoizedProps.onChange === 'function') {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set.call(el, true);
            nd.memoizedProps.onChange({ target: el, currentTarget: el, type: 'change', preventDefault: function () { }, stopPropagation: function () { }, nativeEvent: {} });
            fiberOk = true;
            break;
          }
          nd = nd.return;
        }
      }
    } catch (e) { }
    if (!fiberOk) { try { el.click(); } catch (e) { } }
  }

  // Confirma popup ("Continuar"/"Confirmar") se ele aparecer; senão segue.
  function waConfirmarPopup(label) {
    var alvo = waNorm(label);
    var inicio = Date.now();
    function loop() {
      if (Date.now() - inicio > 2500) return Promise.resolve(false);
      var btnDireto = Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
        return waNorm(b.textContent) === alvo;
      });
      if (btnDireto) { waClick(btnDireto); return waEsperar(400).then(function () { return true; }); }
      return waEsperar(120).then(loop);
    }
    return loop();
  }

  function waBotaoSalvar() {
    return waAguardarCondicao(function () {
      return Array.prototype.find.call(
        document.querySelectorAll('[data-testid="save-contact-btn"],[aria-label="Salvar contato"],[aria-label="Save contact"]'),
        waVisivel
      );
    }, { timeout: 5000, descricao: 'botão Salvar' });
  }

  // Ponto de entrada do motor: salva (add) ou atualiza (edit) o contato com o nome dado.
  function waSalvarContatoInteligente(nomeCompleto) {
    if (!waConversaSelecionada()) {
      console.warn('[Connect CRM] Sem conversa aberta — automação de contato ignorada.');
      return Promise.resolve();
    }
    return waAbrirDrawer()
      .then(function () {
        return waAguardarCondicao(function () {
          return document.querySelector('[aria-label="Nome"][contenteditable="true"], [aria-label="Name"][contenteditable="true"]');
        }, { timeout: 6000, descricao: 'campo Nome' });
      })
      .then(function (campoNome) {
        // Separa Nome (1ª palavra) e Sobrenome (resto) — igual ao JS de referência.
        var partes = String(nomeCompleto || '').trim().split(/\s+/);
        var firstName = partes.shift() || '';
        var lastName = partes.join(' ');
        return waPreencher(campoNome, firstName).then(function () { return lastName; });
      })
      .then(function (lastName) {
        // Re-busca o campo Sobrenome (o Lexical pode ter re-renderizado) e preenche/limpa.
        var campoSob = document.querySelector('[aria-label="Sobrenome"][contenteditable="true"], [aria-label="Last name"][contenteditable="true"], [aria-label="Surname"][contenteditable="true"]');
        if (!campoSob) return;
        // Se há sobrenome, preenche; se não, só limpa se houver resíduo.
        if (lastName) return waPreencher(campoSob, lastName);
        if ((campoSob.innerText || campoSob.textContent || '').trim()) return waPreencher(campoSob, '');
      })
      .then(function () {
        var toggle = document.querySelector('#sync-contact-switch') ||
          document.querySelector('input[aria-label="Sincronizar contato com celular"]') ||
          document.querySelector('[role="switch"]');
        if (toggle) {
          var ligado = toggle.checked || toggle.getAttribute('aria-checked') === 'true';
          if (!ligado) { waLigarSync(toggle); return waConfirmarPopup('Continuar'); }
        }
      })
      .then(function () {
        if (document.activeElement) { try { document.activeElement.blur(); } catch (e) { } }
        return waEsperar(300);
      })
      .then(function () { return waBotaoSalvar(); })
      .then(function (btn) {
        waClick(btn);
        return waEsperar(500);
      })
      .then(function () { return waConfirmarPopup('Confirmar'); })
      .then(function () { return waEsperar(400); })
      .then(function () {
        var fechar = document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Fechar"]') ||
          document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Close"]') ||
          document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Voltar"]') ||
          document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Back"]') ||
          document.querySelector('[data-testid="drawer-right"] [aria-label="Fechar"]');
        if (fechar) waClick(fechar);
        console.log('[Connect CRM] Contato salvo/atualizado no WhatsApp:', nomeCompleto);
        if (typeof crmLogger !== 'undefined') crmLogger.info('contato_wa_sincronizado', 'Nome do contato sincronizado com sucesso no WhatsApp', {
          modulo: 'content.js',
          contexto: { nome: String(nomeCompleto || '') }
        });
      })
      .catch(function (err) {
        console.warn('[Connect CRM] Automação de contato falhou:', err && (err.message || err));
        if (typeof crmLogger !== 'undefined') crmLogger.warn('sincronizar_contato_whatsapp', 'Automação de salvar contato no WhatsApp falhou', {
          modulo: 'content.js',
          erro_tecnico: err && (err.stack || err.message || String(err)),
          contexto: { nome: String(nomeCompleto || '') }
        });
      });
  }

  function findAndClickAddContactButton() {
    function matches(str, insideDrawer) {
      if (!str) return false;
      var t = str.toLowerCase().trim();
      var hasAction = t.indexOf('adicionar') !== -1 ||
        t.indexOf('add') !== -1 ||
        t.indexOf('salvar') !== -1 ||
        t.indexOf('save') !== -1 ||
        t.indexOf('criar') !== -1 ||
        t.indexOf('create') !== -1;
      var hasContact = t.indexOf('contato') !== -1 ||
        t.indexOf('contact') !== -1 ||
        t.indexOf('contatos') !== -1 ||
        t.indexOf('contacts') !== -1;

      if (hasAction && hasContact) return true;
      // Se estiver no drawer lateral, aceita termos mais curtos (ex: "Adicionar" ou "Add")
      if (insideDrawer && hasAction && t.length < 20) return true;

      return false;
    }

    // Se o drawer direito estiver aberto, procura primeiro dentro dele
    var searchContainers = [];
    var drawer = document.querySelector('[data-testid="drawer-right"]');
    if (drawer) {
      searchContainers.push({ el: drawer, insideDrawer: true });
    }
    searchContainers.push({ el: document, insideDrawer: false });

    for (var s = 0; s < searchContainers.length; s++) {
      var containerObj = searchContainers[s];
      var container = containerObj.el;
      var insideDrawer = containerObj.insideDrawer;
      var elements = container.querySelectorAll('button, [role="button"], a, span, div');
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var text = el.textContent.trim();

        // Ignorar wrappers gigantes
        if (text.length > 60) continue;

        var aria = el.getAttribute('aria-label') || '';
        var title = el.getAttribute('title') || '';

        if (matches(text, insideDrawer) || matches(aria, insideDrawer) || matches(title, insideDrawer)) {
          var rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            var clickTarget = el;
            var parent = el.parentElement;
            while (parent && parent !== document.body) {
              if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
                clickTarget = parent;
                break;
              }
              parent = parent.parentElement;
            }
            console.log('[Connect CRM] Encontrou botão de adicionar contato:', text || aria || title);
            simulateClick(clickTarget);
            return true;
          }
        }
      }
    }
    return false;
  }

  function triggerWhatsAppAddContactDrawer() {
    return new Promise(function (resolve, reject) {
      // Verifica se já está aberto
      var drawer = document.querySelector('[data-testid="save-contact-drawer"]');
      if (drawer) {
        return resolve(drawer);
      }

      // Tenta achar na tela principal
      if (findAndClickAddContactButton()) {
        var count = 0;
        var interval = setInterval(function () {
          var d = document.querySelector('[data-testid="save-contact-drawer"]');
          if (d) {
            clearInterval(interval);
            resolve(d);
          } else if (count++ > 15) {
            clearInterval(interval);
            reject(new Error("Timeout ao abrir o drawer de contato (botão direto)"));
          }
        }, 200);
        return;
      }

      // Abre a Info do Contato clicando no cabeçalho do chat
      var header = document.querySelector('#main header');
      if (!header) {
        return reject(new Error("Cabeçalho do chat não encontrado"));
      }

      var clickTarget = header.querySelector('[data-testid="conversation-info-container"]') ||
        header.querySelector('[role="button"]') ||
        header.querySelector('img') ||
        header.querySelector('span[dir="auto"]') ||
        header;
      simulateClick(clickTarget);
      console.log('[Connect CRM] Clicou no cabeçalho para abrir Info do Contato');

      // Espera o drawer direito abrir
      var count2 = 0;
      var rightDrawerOpened = false;
      var interval2 = setInterval(function () {
        var rightDrawer = document.querySelector('[data-testid="drawer-right"]');
        if (rightDrawer) {
          rightDrawerOpened = true;
          // Procura o botão no drawer direito
          if (findAndClickAddContactButton()) {
            clearInterval(interval2);
            // Espera abrir o save-contact-drawer
            var count3 = 0;
            var interval3 = setInterval(function () {
              var d = document.querySelector('[data-testid="save-contact-drawer"]');
              if (d) {
                clearInterval(interval3);
                resolve(d);
              } else if (count3++ > 20) {
                clearInterval(interval3);
                reject(new Error("Timeout ao abrir save-contact-drawer pós-clique"));
              }
            }, 200);
          }
        }

        if (count2++ > 30) {
          clearInterval(interval2);
          if (rightDrawerOpened) {
            reject(new Error("Painel de Info abriu, mas o botão de Adicionar Contato não foi encontrado"));
          } else {
            reject(new Error("Painel de Info do Contato não abriu (timeout)"));
          }
        }
      }, 200);
    });
  }

  function automateWhatsAppSaveContact(contactName) {
    console.log('[Connect CRM] Salvar contato no WhatsApp:', contactName);
    return waSalvarContatoInteligente(contactName);
  }

  function fillContactDetails(drawer, _inputs, contactName) {
    var nameParts = contactName.trim().split(/\s+/);
    var firstName = nameParts[0] || '';
    var lastName = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : '';

    // 1. Nome — query por aria-label para não depender da ordem DOM
    var nomeField = drawer.querySelector('[contenteditable="true"][aria-label="Nome"]') ||
      drawer.querySelector('[data-testid="text-input"][aria-label="Nome"]');
    if (nomeField) {
      setReactInputValue(nomeField, firstName);
      console.log('[Connect CRM] Nome preenchido:', firstName);
    } else {
      console.warn('[Connect CRM] Campo Nome não encontrado no drawer.');
    }

    // 2. Sobrenome — re-query após 150 ms para evitar referência obsoleta após re-render do Lexical
    setTimeout(function () {
      var sobrenomeField = drawer.querySelector('[contenteditable="true"][aria-label="Sobrenome"]') ||
        drawer.querySelector('[data-testid="text-input"][aria-label="Sobrenome"]');
      if (sobrenomeField) {
        setReactInputValue(sobrenomeField, lastName);
        console.log('[Connect CRM] Sobrenome preenchido:', lastName !== '' ? lastName : '(limpo)');
        if (lastName === '') {
          // Verifica se execCommand('delete') realmente limpou o campo Lexical
          setTimeout(function () {
            var domContent = (sobrenomeField.innerText || '').replace(/\n/g, '').trim();
            console.log('[Connect CRM] Sobrenome DOM após limpeza:', domContent === '' ? '(vazio ✓)' : '"' + domContent + '" — AINDA TEM CONTEÚDO');
          }, 80);
        }
      }

      // 3. Toggle "Sincronizar contato com celular"
      setTimeout(function () {
        var toggle = drawer.querySelector('#sync-contact-switch') ||
          drawer.querySelector('input[aria-label="Sincronizar contato com celular"]') ||
          drawer.querySelector('input[type="checkbox"]') ||
          drawer.querySelector('[role="switch"]');

        function activateToggle(el) {
          // Abordagem 1: chamar onChange do React diretamente via fiber.
          // Setar el.checked via nativeSetter + change event não funciona porque
          // React tem checked=false em seu estado interno e sobrescreve durante reconciliação.
          var fiberActivated = false;
          try {
            var ks = Object.keys(el);
            var fk = null;
            for (var ki = 0; ki < ks.length; ki++) {
              if (ks[ki].startsWith('__reactFiber') || ks[ki].startsWith('__reactInternalInstance')) {
                fk = ks[ki]; break;
              }
            }
            if (fk) {
              var nd = el[fk];
              var dpt = 0;
              while (nd && dpt++ < 15) {
                if (nd.memoizedProps && typeof nd.memoizedProps.onChange === 'function') {
                  // Set DOM prop antes de chamar onChange para que event.target.checked retorne true
                  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set.call(el, true);
                  nd.memoizedProps.onChange({ target: el, currentTarget: el, type: 'change', preventDefault: function () { }, stopPropagation: function () { }, nativeEvent: {} });
                  fiberActivated = true;
                  break;
                }
                nd = nd.return;
              }
            }
          } catch (ferr) {
            console.warn('[Connect CRM] Fiber toggle falhou:', ferr.message);
          }

          if (!fiberActivated) {
            // Fallback: click() nativo que togglea o checkbox e dispara os eventos
            el.click();
          }
        }

        if (!toggle) {
          console.warn('[Connect CRM] Toggle de sincronização não encontrado no drawer.');
        } else if (toggle.checked) {
          console.log('[Connect CRM] Toggle já ativo.');
        } else {
          console.log('[Connect CRM] Ativando toggle de sincronização...');
          activateToggle(toggle);
          setTimeout(function () {
            // Re-query para pegar o estado atualizado pelo React (não o nosso nativeSetter)
            var freshToggle = drawer.querySelector('#sync-contact-switch') ||
              drawer.querySelector('input[aria-label="Sincronizar contato com celular"]');
            var nowChecked = freshToggle ? freshToggle.checked : toggle.checked;
            console.log('[Connect CRM] Toggle estado após ativação:', nowChecked ? 'ATIVO ✓' : 'AINDA INATIVO — retry');
            if (!nowChecked && freshToggle) {
              activateToggle(freshToggle);
              setTimeout(function () {
                var t2 = drawer.querySelector('#sync-contact-switch') ||
                  drawer.querySelector('input[aria-label="Sincronizar contato com celular"]');
                console.log('[Connect CRM] Toggle estado final:', t2 ? t2.checked : '?');
              }, 200);
            }
          }, 300);
        }

        // 4. Salvar — verifica popup "Continuar" antes de clicar salvar.
        // O toggle pode abrir um popup de confirmação que bloqueia o formulário;
        // tentar salvar enquanto o popup está visível resulta em save silenciosamente ignorado.
        setTimeout(function () {
          function doSaveContact() {
            var saveBtn = drawer.querySelector('[data-testid="save-contact-btn"], [aria-label="Salvar contato"], [aria-label="Save contact"]');
            if (!saveBtn) {
              var btns = drawer.querySelectorAll('button, [role="button"]');
              for (var k = 0; k < btns.length; k++) {
                var tid = btns[k].getAttribute('data-testid') || '';
                var al  = (btns[k].getAttribute('aria-label') || '').toLowerCase();
                if (tid === 'save-contact-btn' || al.indexOf('salvar') !== -1 || al.indexOf('save') !== -1) {
                  saveBtn = btns[k];
                  break;
                }
              }
            }
            if (saveBtn) {
              var saveBtnDisabled = saveBtn.getAttribute('aria-disabled') === 'true' ||
                saveBtn.hasAttribute('disabled');
              console.log('[Connect CRM] Botão salvar encontrado. disabled:', saveBtnDisabled, 'testid:', saveBtn.getAttribute('data-testid') || '');
              if (saveBtnDisabled) {
                console.warn('[Connect CRM] Botão salvar DESATIVADO — WA pode estar com validação pendente (Sobrenome vazio?).');
              }
              simulateClick(saveBtn);
              setTimeout(function () {
                var closeBtn =
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Fechar"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Close"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Voltar"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Back"]') ||
                  document.querySelector('[aria-label="Fechar"][data-tab="2"]') ||
                  document.querySelector('[data-testid="drawer-right"] [aria-label="Fechar"]');
                if (closeBtn) {
                  console.log('[Connect CRM] Fechando drawer de contato automaticamente.');
                  simulateClick(closeBtn);
                }
              }, 1200);
            } else {
              console.warn('[Connect CRM] Botão de salvar do WhatsApp não foi encontrado no drawer.');
            }
          }

          // O toggle abre popup "Continuar" que bloqueia o save — dismiss antes de salvar.
          // Busca o botão "Continuar" diretamente (sem depender do testid do container do popup).
          var allBtns = document.querySelectorAll('button');
          var continuarBtn = null;
          for (var pi = 0; pi < allBtns.length; pi++) {
            if ((allBtns[pi].textContent || '').trim().toLowerCase() === 'continuar') {
              continuarBtn = allBtns[pi]; break;
            }
          }
          if (continuarBtn) {
            console.log('[Connect CRM] Popup de toggle detectado antes de salvar — clicando Continuar.');
            simulateClick(continuarBtn);
            setTimeout(doSaveContact, 400);
          } else {
            doSaveContact();
          }
        }, 400);
      }, 200);
    }, 150);
  }

  // Detecta se o contato já está salvo na agenda do WA (via menu "Mais opções") e
  // roteia para o fluxo correto: editar (já salvo) ou adicionar (não salvo).
  function syncContactNameToWA(newName) {
    // O motor inteligente decide sozinho entre adicionar e editar.
    return waSalvarContatoInteligente(newName);
  }

  // Edita o nome de um contato já salvo na agenda do WhatsApp Web.
  // Fluxo: "Mais opções" (já aberto) → "Dados do contato" → aguarda botão "Editar" → save-contact-drawer → preenche nome → salva.
  function automateWhatsAppEditContact(newName) {
    var dadosBtn = document.querySelector('button[aria-label="Dados do contato"][role="menuitem"]');
    if (!dadosBtn) return;
    simulateClick(dadosBtn);

    // Aguarda direto o botão "Editar" — não depende do testid do painel de informações
    // (varia entre versões do WA: contact-info-1, drawer-right, etc.)
    waitForElement('button[aria-label="Editar"]', 6000).then(function (editBtn) {
      if (!editBtn) return;
      simulateClick(editBtn);

      waitForElement('[data-testid="save-contact-drawer"]', 5000).then(function (saveDrawer) {
        if (!saveDrawer) return;
        var count = 0;
        var poll = setInterval(function () {
          var rawInputs = saveDrawer.querySelectorAll('input, [contenteditable="true"]');
          var visible = [];
          for (var i = 0; i < rawInputs.length; i++) {
            var r = rawInputs[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0) visible.push(rawInputs[i]);
          }
          if (visible.length > 0 || count++ > 15) {
            clearInterval(poll);
            fillContactDetails(saveDrawer, visible, newName);
            // Fallback: se o popup "Continuar" ainda estiver visível após o save
            // (ex: toggle popup demorou mais que 750 ms para aparecer)
            setTimeout(function () {
              var fallbackBtns = document.querySelectorAll('button');
              for (var j = 0; j < fallbackBtns.length; j++) {
                if ((fallbackBtns[j].textContent || '').trim().toLowerCase() === 'continuar') {
                  console.log('[Connect CRM] Popup residual "Continuar" detectado — clicando (fallback).');
                  simulateClick(fallbackBtns[j]); break;
                }
              }
            }, 1600);
          }
        }, 150);
      });
    });
  }

  /* ===== RENDER ===== */

  function render() {
    var content = document.getElementById('crm-content');
    if (!content) return;

    var ui = state.ui;
    var view = ui.view;
    var saving = ui.saving;
    var error = ui.error;
    var success = ui.success;
    var activeTab = ui.tab || 'dados';
    var current = state.current;
    var sources = state.sources;
    var segments = state.segments;
    var form = state.form;
    var followupForm = state.followupForm;
    var html = '';

    if (view === 'loading') {
      html = '<div class="crm-center"><div class="crm-spinner crm-spinner-dark"></div><p>Carregando...</p></div>';
    }

    else if (view === 'login') {
      html = [
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;gap:20px">',
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        '<div style="text-align:center">',
        '<p style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;letter-spacing:-0.02em">Acesso necessário</p>',
        '<p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6">Para usar o CRM no WhatsApp,<br>faça login no painel web primeiro.</p>',
        '</div>',
        '<a href="' + CRM_URL + '/login" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#10b981;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;transition:background 0.15s">',
        'Abrir o CRM',
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        '</a>',
        '<p style="font-size:11px;color:#cbd5e1;margin:0;text-align:center">Após o login, esta tela atualiza automaticamente.</p>',
        '</div>',
      ].join('');
    }

    else if (view === 'group') {
      html = '<div class="crm-center"><p>Este é um grupo.<br>O CRM funciona apenas em conversas individuais.</p></div>';
    }

    else if (view === 'no-contact') {
      html = '<div class="crm-center"><p>Abra uma conversa individual no WhatsApp Web.</p></div>';
    }

    else if (view === 'new-lead') {
      html = [
        '<div class="crm-contact">',
        avatarHtml(current.name || '?', state.current.photo),
        '<div class="crm-contact-info">',
        '<p class="crm-contact-name">' + escapeHtml(current.name || 'Contato') + '</p>',
        '<p class="crm-contact-phone">' + formatPhone(current.phone || '') + '</p>',
        '</div>',
        '</div>',
        '<p style="font-size:12px;color:#10b981;font-weight:500;margin:0 0 12px">✦ Contato não cadastrado — salvar no CRM</p>',
        error ? '<div class="crm-alert crm-alert-error">' + escapeHtml(error) + '</div>' : '',
        success ? '<div class="crm-alert crm-alert-success">' + escapeHtml(success) + '</div>' : '',
        '<form id="crm-save-form">',
        fieldIcon('Nome', ICON.user, '<input class="crm-input crm-has-icon" type="text" id="crm-nome" value="' + escapeHtml(form.nome) + '" placeholder="Nome do contato" required />'),
        fieldIcon('Status', ICON.flag, '<select class="crm-select crm-has-icon" id="crm-status">' + statusOptions(form.status) + '</select>'),
        fieldIcon('Origem', ICON.globe, '<select class="crm-select crm-has-icon" id="crm-origem">' + sourceOptions(sources, form.origem_id) + '</select>'),
        fieldIcon('Segmento', ICON.tag, '<select class="crm-select crm-has-icon" id="crm-segmento">' + segmentOptions(segments, form.segmento_id) + '</select>'),
        fieldIcon('Valor (R$)', ICON.dollar, '<input class="crm-input crm-has-icon" type="text" inputmode="decimal" id="crm-valor" value="' + escapeHtml(form.valor != null ? String(form.valor) : '') + '" placeholder="Ex: 1.500,00" />'),
        tagsFieldHtml(form.tags),
        fieldIcon('Observação', ICON.file, '<textarea class="crm-textarea crm-has-icon" id="crm-obs" placeholder="Informações do atendimento...">' + escapeHtml(form.observacao) + '</textarea>', true),
        '<button id="crm-save-submit" class="crm-btn crm-btn-primary" type="button"' + (saving ? ' disabled' : '') + '>',
        saving ? '<span class="crm-spinner"></span> Salvando...' : 'Salvar no CRM',
        '</button>',
        '</form>',
      ].join('');
    }

    else if (view === 'existing-lead') {
      var lead = current.lead;
      var leadStatus = lead.status || 'novo_lead';

      // --- Tab bar ---
      var avisosCount = state.pendingFollowups;
      var tabBar = [
        '<div class="crm-tabs">',
        '<button class="crm-tab' + (activeTab === 'dados' ? ' crm-tab-active' : '') + '" id="crm-tab-dados">',
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/></svg>',
        ' Dados',
        '</button>',
        '<button class="crm-tab' + (activeTab === 'followup' ? ' crm-tab-active' : '') + '" id="crm-tab-followup">',
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        ' Follow-up',
        '</button>',
        '<button class="crm-tab' + (activeTab === 'avisos' ? ' crm-tab-active' : '') + '" id="crm-tab-avisos" style="position:relative">',
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        ' Avisos',
        avisosCount > 0
          ? '<span style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;line-height:14px;text-align:center;display:inline-block">' + (avisosCount > 9 ? '9+' : avisosCount) + '</span>'
          : '',
        '</button>',
        '</div>',
      ].join('');

      // --- Contact card (shown in both tabs) ---
      var contactCard = [
        '<div class="crm-contact">',
        avatarHtml(lead.nome, lead.foto_url || state.current.photo),
        '<div class="crm-contact-info">',
        '<p class="crm-contact-name">' + escapeHtml(lead.nome) + '</p>',
        '<p class="crm-contact-phone">' + formatPhone(lead.whatsapp) + '</p>',
        '</div>',
        '</div>',
        statusBadgeHtml(leadStatus),
        '<div class="crm-divider"></div>',
      ].join('');

      // --- Tab: Dados ---
      var tabDados = [
        error ? '<div class="crm-alert crm-alert-error">' + escapeHtml(error) + '</div>' : '',
        success ? '<div class="crm-alert crm-alert-success">' + escapeHtml(success) + '</div>' : '',
        '<form id="crm-update-form">',
        fieldIcon('Nome', ICON.user, '<input class="crm-input crm-has-icon" type="text" id="crm-nome" value="' + escapeHtml(form.nome) + '" placeholder="Nome do contato" />'),
        fieldIcon('Status', ICON.flag, '<select class="crm-select crm-has-icon" id="crm-status">' + statusOptions(form.status) + '</select>'),
        fieldIcon('Origem', ICON.globe, '<select class="crm-select crm-has-icon" id="crm-origem">' + sourceOptions(sources, form.origem_id) + '</select>'),
        fieldIcon('Segmento', ICON.tag, '<select class="crm-select crm-has-icon" id="crm-segmento">' + segmentOptions(segments, form.segmento_id) + '</select>'),
        fieldIcon('Valor (R$)', ICON.dollar, '<input class="crm-input crm-has-icon" type="text" inputmode="decimal" id="crm-valor" value="' + escapeHtml(form.valor != null ? String(form.valor) : '') + '" placeholder="Ex: 1.500,00" />'),
        tagsFieldHtml(form.tags),
        fieldIcon('Observação', ICON.file, '<textarea class="crm-textarea crm-has-icon" id="crm-obs" placeholder="Informações do atendimento...">' + escapeHtml(form.observacao) + '</textarea>', true),
        '<button id="crm-update-submit" class="crm-btn crm-btn-primary" type="button"' + (saving ? ' disabled' : '') + '>',
        saving ? '<span class="crm-spinner"></span> Salvando...' : 'Salvar alterações',
        '</button>',
        '</form>',
        '<div style="margin-top:8px">',
        '<a href="' + CRM_URL + '/leads?lead=' + lead.id + '" target="_blank" class="crm-btn crm-btn-ghost" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px">',
        'Abrir no CRM',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        '</a>',
        '</div>',
      ].join('');

      // --- Tab: Follow-up ---
      var tabFollowup = [
        error ? '<div class="crm-alert crm-alert-error">' + escapeHtml(error) + '</div>' : '',
        success ? '<div class="crm-alert crm-alert-success">' + escapeHtml(success) + '</div>' : '',
        '<p style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Agendar novo follow-up</p>',
        '<form id="crm-followup-form">',
        fieldIcon('Tipo', ICON.list, '<select class="crm-select crm-has-icon" id="crm-fu-tipo">' + activityTypeOptions(followupForm.tipo) + '</select>'),
        '<div class="crm-followup-row" style="margin-bottom:10px">',
        '<div class="crm-field" style="margin-bottom:0"><label class="crm-label">Data</label><div class="crm-input-wrap">' + ICON.calendar + '<input class="crm-input crm-has-icon" type="date" id="crm-fu-data" value="' + escapeHtml(followupForm.data) + '" required /></div></div>',
        '<div class="crm-field" style="margin-bottom:0"><label class="crm-label">Hora</label><div class="crm-input-wrap">' + ICON.clock + '<input class="crm-input crm-has-icon" type="time" id="crm-fu-hora" value="' + escapeHtml(followupForm.hora) + '" required /></div></div>',
        '</div>',
        fieldIcon('Descrição', ICON.file, '<input class="crm-input crm-has-icon" type="text" id="crm-fu-desc" value="' + escapeHtml(followupForm.descricao) + '" placeholder="Opcional..." />'),
        '<button id="crm-followup-submit" class="crm-btn crm-btn-primary" type="button"' + (saving ? ' disabled' : '') + '>',
        saving ? '<span class="crm-spinner"></span> Agendando...' : 'Agendar follow-up',
        '</button>',
        '</form>',
        '<div class="crm-divider"></div>',
        '<a href="' + CRM_URL + '/followups" target="_blank" class="crm-btn crm-btn-ghost" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px">',
        'Ver todos os follow-ups',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        '</a>',
      ].join('');

      // --- Tab: Avisos Gerais ---
      var today2 = todayLocalStr();
      var atrasados = state.avisosList.filter(function (a) { return a.data_agendada < today2; });
      var hojeList = state.avisosList.filter(function (a) { return a.data_agendada === today2; });

      function avisosGroup(label, color, items) {
        if (!items.length) return '';
        var rows = items.map(function (a) {
          var leadNome = (a.leads && a.leads.nome) ? a.leads.nome : '—';
          var leadId = a.leads && a.leads.id ? a.leads.id : null;
          var tipo = ACTIVITY_TYPES.find(function (t) { return t.value === a.tipo_atividade; });
          var tipoLabel = tipo ? tipo.label : a.tipo_atividade;
          var hora = a.hora_agendada ? a.hora_agendada.slice(0, 5) : '';
          var dataFmt = a.data_agendada
            ? (function (d) { var p = d.split('-'); return p[2] + '/' + p[1]; })(a.data_agendada)
            : '';
          return [
            '<div class="crm-aviso-item">',
            '<div class="crm-aviso-dot" style="background:' + color + '"></div>',
            '<div class="crm-aviso-body">',
            leadId
              ? '<a href="' + CRM_URL + '/leads?lead=' + leadId + '" target="_blank" class="crm-aviso-nome">' + escapeHtml(leadNome) + '</a>'
              : '<span class="crm-aviso-nome">' + escapeHtml(leadNome) + '</span>',
            '<span class="crm-aviso-tipo">' + escapeHtml(tipoLabel) + '</span>',
            '</div>',
            '<div class="crm-aviso-hora">',
            hora ? '<span>' + hora + '</span>' : '',
            dataFmt ? '<span style="color:#94a3b8;font-size:10px">' + dataFmt + '</span>' : '',
            '</div>',
            '</div>',
          ].join('');
        }).join('');
        return [
          '<div class="crm-aviso-section">',
          '<p class="crm-aviso-section-label" style="color:' + color + '">' + label + '</p>',
          rows,
          '</div>',
        ].join('');
      }

      var tabAvisos = state.avisosList.length === 0
        ? [
          '<div class="crm-center" style="padding-top:40px">',
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1fae5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
          '<p style="color:#10b981;font-size:13px;font-weight:500">Nenhum aviso pendente</p>',
          '<p style="color:#94a3b8;font-size:12px">Todos os follow-ups estão em dia!</p>',
          '</div>',
        ].join('')
        : [
          '<div style="padding-bottom:4px">',
          avisosGroup('Atrasados', '#ef4444', atrasados),
          avisosGroup('Hoje', '#f59e0b', hojeList),
          '</div>',
          '<div class="crm-divider"></div>',
          '<a href="' + CRM_URL + '/followups" target="_blank" class="crm-btn crm-btn-ghost" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px">',
          'Ver no CRM completo',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
          '</a>',
        ].join('');

      if (activeTab === 'dados') html = tabBar + contactCard + tabDados;
      else if (activeTab === 'followup') html = tabBar + contactCard + tabFollowup;
      else html = tabBar + tabAvisos;
    }

    content.innerHTML = html;
    attachEvents();

    // Stagger sequencial — SÓ quando solicitado (abrir/expandir/trocar aba/trocar
    // contato). Em saves/polling/atualizações o flag fica false → sem fade-in repetido.
    if (state.ui.animate) {
      var staggerEls = content.querySelectorAll(
        '.crm-contact, .crm-field, .crm-followup-form, .crm-aviso-item, .crm-btn-group, .crm-center'
      );
      Array.prototype.forEach.call(staggerEls, function (el, i) {
        el.style.animation = 'crm-content-appear 0.22s ease both';
        el.style.animationDelay = (i * 50) + 'ms';
      });
    }
    state.ui.animate = false;

    // Controla visibilidade do painel baseado no estado da conversa
    var rootEl = document.getElementById('crm-4u-root');
    var toggleEl = document.getElementById('crm-4u-toggle');
    if (rootEl && toggleEl) {
      var arrowEl = toggleEl.querySelector('path');
      if (state.visible) {
        rootEl.classList.remove('crm-hidden');
        toggleEl.classList.remove('crm-toggle-hidden'); // right:576px, colado ao painel
        if (arrowEl) arrowEl.setAttribute('d', 'M8 2L4 6L8 10');
      } else {
        rootEl.classList.add('crm-hidden');
        toggleEl.classList.add('crm-toggle-hidden'); // right:0, aba na borda direita
        if (arrowEl) arrowEl.setAttribute('d', 'M4 2L8 6L4 10');
      }
    }
  }

  /* ===== ATTACH EVENTS ===== */

  function attachEvents() {
    var view = state.ui.view;

    if (view === 'new-lead') {
      var saveBtn = document.getElementById('crm-save-submit');
      if (saveBtn) saveBtn.addEventListener('click', handleSaveLead);
      syncFormInputs();
    }

    if (view === 'existing-lead') {
      // Tab switching
      var tabDadosBtn = document.getElementById('crm-tab-dados');
      var tabFuBtn = document.getElementById('crm-tab-followup');
      var tabAvisosBtn = document.getElementById('crm-tab-avisos');
      if (tabDadosBtn) tabDadosBtn.addEventListener('click', function () {
        state.ui.tab = 'dados';
        state.ui.error = '';
        state.ui.success = '';
        state.ui.animate = true; // anima ao trocar de aba
        render();
      });
      if (tabFuBtn) tabFuBtn.addEventListener('click', function () {
        state.ui.tab = 'followup';
        state.ui.error = '';
        state.ui.success = '';
        state.ui.animate = true; // anima ao trocar de aba
        render();
      });
      if (tabAvisosBtn) tabAvisosBtn.addEventListener('click', function () {
        state.ui.tab = 'avisos';
        state.ui.error = '';
        state.ui.success = '';
        state.ui.animate = true; // anima ao trocar de aba
        // Recarrega a lista ao abrir a aba
        if (state.auth) fetchPendingFollowups(state.auth.access_token);
        render();
      });

      // Form handlers
      var updateSubmitBtn = document.getElementById('crm-update-submit');
      if (updateSubmitBtn) updateSubmitBtn.addEventListener('click', handleUpdateLead);

      var fuSubmitBtn = document.getElementById('crm-followup-submit');
      if (fuSubmitBtn) fuSubmitBtn.addEventListener('click', handleSaveFollowup);
      syncFormInputs();
    }
  }

  // Converte "1.500,00", "R$ 2000", "1500.50" em número (ou null)
  function parseValorBR(input) {
    if (input == null || input === '') return null;
    if (typeof input === 'number') return isFinite(input) ? input : null;
    var s = String(input).replace(/[^\d.,-]/g, '').trim();
    if (!s) return null;
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') !== -1) {
      s = s.replace(',', '.');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function syncFormInputs() {
    var inputs = {
      'crm-status': function (v) { state.form.status = v; },
      'crm-origem': function (v) { state.form.origem_id = v; },
      'crm-segmento': function (v) { state.form.segmento_id = v; },
      'crm-obs': function (v) { state.form.observacao = v; },
      'crm-valor': function (v) { state.form.valor = v; },
      'crm-nome': function (v) { state.form.nome = v; },
    };

    Object.keys(inputs).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function (e) { inputs[id](e.target.value); });
        el.addEventListener('change', function (e) { inputs[id](e.target.value); });
      }
    });

    var fuInputs = {
      'crm-fu-tipo': function (v) { state.followupForm.tipo = v; },
      'crm-fu-data': function (v) { state.followupForm.data = v; },
      'crm-fu-hora': function (v) { state.followupForm.hora = v; },
      'crm-fu-desc': function (v) { state.followupForm.descricao = v; },
    };

    Object.keys(fuInputs).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function (e) { fuInputs[id](e.target.value); });
    });

    bindTagInputKeydown();

    var tagsContainer = document.getElementById('crm-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-remove-tag]') : null;
        if (!btn && e.target.getAttribute) btn = e.target.getAttribute('data-remove-tag') ? e.target : null;
        if (btn) {
          var tag = btn.getAttribute('data-remove-tag');
          state.form.tags = state.form.tags.filter(function (t) { return t !== tag; });
          renderTagsOnly();
        }
      });
    }
  }

  // Vincula o keydown do input de tags (add via Enter/vírgula, remove via Backspace).
  // Reusado no bind inicial e no renderTagsOnly (o input é recriado a cada atualização).
  function bindTagInputKeydown() {
    var tagInput = document.getElementById('crm-tag-input');
    if (!tagInput) return;
    tagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        var val = tagInput.value.trim().replace(/,/g, '');
        if (val && state.form.tags.indexOf(val) === -1) {
          state.form.tags = state.form.tags.concat([val]);
          renderTagsOnly();
        } else {
          tagInput.value = '';
        }
      } else if (e.key === 'Backspace' && !tagInput.value && state.form.tags.length > 0) {
        state.form.tags = state.form.tags.slice(0, -1);
        renderTagsOnly();
      }
    });
  }

  // Atualiza SÓ os chips de tags no lugar (sem reconstruir o painel inteiro),
  // preservando o foco do input — evita o "pisca" a cada tag.
  function renderTagsOnly() {
    var container = document.getElementById('crm-tags-container');
    if (!container) { render(); return; }
    container.innerHTML = tagsInnerHtml(state.form.tags || []);
    bindTagInputKeydown();
    var input = document.getElementById('crm-tag-input');
    if (input) input.focus();
  }

  /* ===== HANDLERS ===== */

  function flushTagInput() {
    var tagInput = document.getElementById('crm-tag-input');
    if (tagInput && tagInput.value.trim()) {
      var val = tagInput.value.trim().replace(/,/g, '');
      if (val && state.form.tags.indexOf(val) === -1) {
        state.form.tags = state.form.tags.concat([val]);
      }
      tagInput.value = '';
    }
  }

  function handleSaveLead(e) {
    if (e && e.preventDefault) e.preventDefault();
    flushTagInput();
    state.ui.saving = true;
    state.ui.error = '';
    render();

    var phone = normalizePhone(state.current.phone);
    var nome = state.form.nome;
    var status = state.form.status;
    var origem_id = state.form.origem_id;
    var segmento_id = state.form.segmento_id;
    var observacao = state.form.observacao;
    var token = state.auth.access_token;

    getLeadByPhone(phone, token).then(function (existing) {
      if (existing) {
        state.current.lead = existing;
        state.form = { nome: existing.nome, status: existing.status, origem_id: existing.origem_id || '', segmento_id: existing.segmento_id || '', observacao: existing.observacao || '', valor: existing.valor != null ? String(existing.valor) : '', tags: Array.isArray(existing.tags) ? existing.tags : [] };
        state.ui.view = 'existing-lead';
        state.ui.saving = false;
        state.ui.error = 'Lead já existe — carregado.';
        render();
        return;
      }

      return createLead({
        nome: nome.trim() || state.current.name || 'Contato',
        whatsapp: phone,
        status: status,
        origem_id: origem_id || null,
        segmento_id: segmento_id || null,
        responsavel_id: state.auth.user_id || null,
        observacao: observacao.trim() || null,
        valor: parseValorBR(state.form.valor),
        foto_url: state.current.photo || null,
        tags: state.form.tags || [],
      }, token).then(function (newLead) {
        if (!newLead || newLead.code) {
          state.ui.saving = false;
          state.ui.error = 'Erro ao salvar. Tente novamente.';
          render();
          return;
        }

        return insertStatusHistory({
          lead_id: newLead.id,
          status_anterior: null,
          status_novo: status,
          alterado_por: state.auth.user_id || null,
        }, token).then(function () {
          state.current.lead = newLead;
          state.ui.view = 'existing-lead';
          state.ui.saving = false;
          state.ui.success = 'Lead salvo com sucesso!';
          if (typeof crmLogger !== 'undefined') crmLogger.info('lead_criado', 'Novo lead criado com sucesso no CRM', {
            modulo: 'content.js',
            contexto: { lead_id: newLead.id, status: newLead.status }
          });
          render();

          // Atualiza o cache local (todas as variantes do número) e injeta o badge na lista
          if (newLead.whatsapp) {
            var entry = { id: newLead.id, nome: newLead.nome, whatsapp: newLead.whatsapp, status: newLead.status };
            phoneVariants(newLead.whatsapp).forEach(function (v) { leadsCache[v] = entry; });
          }
          injectListBadges();

          // Automate saving the contact natively in WhatsApp Web
          var leadNome = newLead.nome || state.form.nome || state.current.name || 'Contato';
          automateWhatsAppSaveContact(leadNome);

          setTimeout(function () { state.ui.success = ''; render(); }, 3000);
        });
      });
    }).catch(function (err) {
      console.error('[Connect CRM] Erro ao salvar lead:', err);
      if (typeof crmLogger !== 'undefined') crmLogger.error('salvar_lead', 'Botão salvar falhou — lead não foi criado', {
        modulo: 'content.js',
        erro_tecnico: err && (err.message || String(err)),
        contexto: { phone: state.current.phone, status: err && err.status }
      });
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  function handleUpdateLead(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.current.lead) return;

    flushTagInput();
    state.ui.saving = true;
    state.ui.error = '';
    render();

    var nome = state.form.nome;
    var status = state.form.status;
    var origem_id = state.form.origem_id;
    var segmento_id = state.form.segmento_id;
    var observacao = state.form.observacao;
    var prevStatus = state.current.lead.status;
    var statusChanged = status !== prevStatus;
    var nomeChanged = (nome || '').trim() !== (state.current.lead.nome || '').trim();
    var token = state.auth.access_token;
    var leadId = state.current.lead.id;

    updateLead(leadId, {
      nome: nome.trim() || state.current.lead.nome,
      status: status,
      origem_id: origem_id || null,
      segmento_id: segmento_id || null,
      observacao: observacao.trim() || null,
      valor: parseValorBR(state.form.valor),
      tags: state.form.tags || [],
      foto_url: state.current.photo || state.current.lead.foto_url || null,
    }, token).then(function (updated) {
      var afterHistory = statusChanged
        ? insertStatusHistory({ lead_id: leadId, status_anterior: prevStatus, status_novo: status, alterado_por: state.auth.user_id || null }, token)
        : Promise.resolve();

      return afterHistory.then(function () {
        state.current.lead = Object.assign({}, state.current.lead, updated);
        state.ui.saving = false;
        state.ui.success = 'Alterações salvas!';
        if (typeof crmLogger !== 'undefined') crmLogger.info('lead_atualizado', 'Lead atualizado com sucesso no CRM', {
          modulo: 'content.js',
          contexto: { lead_id: leadId, status_mudou: statusChanged }
        });
        render();

        // Atualiza o cache local (todas as variantes do número) e reinjeta badges na lista
        if (updated && updated.whatsapp) {
          var entry = { id: updated.id, nome: updated.nome, whatsapp: updated.whatsapp, status: updated.status };
          phoneVariants(updated.whatsapp).forEach(function (v) { leadsCache[v] = entry; });
        }
        injectListBadges();

        // Sincroniza nome no WhatsApp Web apenas quando o nome mudou
        if (nomeChanged && document.querySelector('#main')) {
          syncContactNameToWA(updated.nome || nome);
        }

        setTimeout(function () { state.ui.success = ''; render(); }, 3000);
      });
    }).catch(function (err) {
      console.error('[Connect CRM] Erro ao atualizar lead:', err);
      if (typeof crmLogger !== 'undefined') crmLogger.error('atualizar_lead', 'Falha ao atualizar lead existente', {
        modulo: 'content.js',
        erro_tecnico: err && (err.message || String(err)),
        contexto: { lead_id: state.current.lead && state.current.lead.id, status: err && err.status }
      });
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  function handleSaveFollowup(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.current.lead) return;

    var tipo = state.followupForm.tipo;
    var data = state.followupForm.data;
    var hora = state.followupForm.hora;

    if (!data || !hora) {
      state.ui.error = 'Preencha data e hora do follow-up.';
      render();
      return;
    }

    state.ui.saving = true;
    state.ui.error = '';
    render();
    var descricao = state.followupForm.descricao;
    var token = state.auth.access_token;

    createActivity({
      lead_id: state.current.lead.id,
      tipo_atividade: tipo,
      descricao: descricao.trim() || null,
      data_agendada: data,
      hora_agendada: hora,
      status_atividade: 'pendente',
      criado_por: state.auth.user_id || null,
    }, token).then(function () {
      // Usa meio-dia UTC para evitar troca de dia por diferença de fuso horário
      var proximo = data + 'T12:00:00.000Z';
      if (!state.current.lead.proximo_followup || proximo < state.current.lead.proximo_followup) {
        return updateLead(state.current.lead.id, { proximo_followup: proximo }, token);
      }
    }).then(function () {
      state.followupForm = { tipo: 'enviar_mensagem', data: '', hora: '', descricao: '' };
      state.ui.saving = false;
      state.ui.tab = 'followup'; // mantém na aba de follow-up após agendar
      state.ui.success = '✓ Follow-up agendado!';
      render();
      // Atualiza o badge imediatamente (nova atividade pode ser "hoje" ou "atrasada")
      if (state.auth) fetchPendingFollowups(state.auth.access_token);
      setTimeout(function () { state.ui.success = ''; render(); }, 3000);
    }).catch(function (err) {
      console.error('[Connect CRM] Erro ao criar follow-up:', err);
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  /* ===== DETECÇÃO E CARREGAMENTO ===== */

  function applyBranding() {
    var el = document.querySelector('.crm-logo-text');
    if (!el) return;
    var company = (state.orgName || '').trim();
    el.textContent = company ? 'Connect CRM — ' + company : 'Connect CRM';
  }

  function loadMeta() {
    if (!state.auth) return Promise.resolve();
    return Promise.all([
      getSources(state.auth.access_token),
      getSegments(state.auth.access_token),
      getStatuses(state.auth.access_token),
      loadLeadsCache(state.auth.access_token),
      getOrg(state.auth.access_token),
    ]).then(function (results) {
      state.sources = Array.isArray(results[0]) ? results[0] : [];
      state.segments = Array.isArray(results[1]) ? results[1] : [];
      state.statuses = Array.isArray(results[2]) ? results[2] : [];
      var org = results[4];
      if (org) state.orgName = (org.nome_exibicao && org.nome_exibicao.trim()) || org.nome || '';
      applyBranding();
      console.log('[Connect CRM] Meta carregada: ' + state.sources.length + ' origens, ' + state.segments.length + ' segmentos, ' + state.statuses.length + ' statuses.');
      if (typeof crmLogger !== 'undefined') crmLogger.info('meta_carregada', 'Metadados carregados com sucesso', {
        modulo: 'content.js',
        contexto: { origens: state.sources.length, segmentos: state.segments.length, statuses: state.statuses.length }
      });
    }).catch(function (err) {
      if (err && err.isUnauthorized) {
        handleUnauthorized();
      } else {
        if (typeof crmLogger !== 'undefined') crmLogger.error('carregar_meta', 'Falha ao carregar origens/segmentos/statuses da extensão', {
          modulo: 'content.js',
          erro_tecnico: err && (err.message || String(err)),
          contexto: { status: err && err.status }
        });
      }
    });
  }

  /* ===== POLLING TEMPO REAL ===== */

  var pollInterval = null;

  function startLeadPolling() {
    stopLeadPolling();
    pollInterval = setInterval(function () {
      if (!state.auth || !state.current.phone || state.ui.view !== 'existing-lead' || state.ui.saving) return;

      var normalPhone = normalizePhone(state.current.phone);
      getLeadByPhone(normalPhone, state.auth.access_token).then(function (fresh) {
        if (!fresh || !state.current.lead || fresh.id !== state.current.lead.id) return;
        if (state.ui.view !== 'existing-lead' || state.ui.saving) return;

        var changed = ['status', 'nome', 'observacao', 'origem_id', 'segmento_id', 'valor', 'proximo_followup'].some(function (k) {
          return fresh[k] !== state.current.lead[k];
        });

        // Compara tags (arrays) de forma segura para não re-renderizar eternamente
        var freshTags = Array.isArray(fresh.tags) ? fresh.tags : [];
        var currentTags = Array.isArray(state.current.lead.tags) ? state.current.lead.tags : [];
        if (!changed) {
          if (freshTags.length !== currentTags.length) {
            changed = true;
          } else {
            for (var idx = 0; idx < freshTags.length; idx++) {
              if (freshTags[idx] !== currentTags[idx]) {
                changed = true;
                break;
              }
            }
          }
        }

        if (changed) {
          console.log('[Connect CRM] Lead atualizado externamente.');
          state.current.lead = fresh;
          state.form.status = fresh.status || 'novo_lead';
          state.form.nome = fresh.nome || '';
          state.form.origem_id = fresh.origem_id || '';
          state.form.segmento_id = fresh.segmento_id || '';
          state.form.observacao = fresh.observacao || '';
          state.form.valor = fresh.valor != null ? String(fresh.valor) : '';
          state.form.tags = freshTags;
          render();
        }
      }).catch(function (err) {
        if (err && err.isUnauthorized) { handleUnauthorized(); }
      });
    }, 3000);
  }

  function stopLeadPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function detectAndLoad() {
    if (!state.auth) {
      // Só re-renderiza o login se ainda não estamos nele.
      // Evita destruir o formulário (e roubar o foco) a cada mutação do DOM.
      if (state.ui.view !== 'login') {
        state.ui.view = 'login';
        render();
      }
      return;
    }

    // Não interrompe enquanto um formulário está sendo salvo
    if (state.ui.saving) return;


    // Usa page world (inject.js) para ler fiber — funciona no isolated world
    getContactFromPageWorld().then(function (contact) {
      if (!contact) {
        // Nenhum contato retornado (timeout ou não há conversa aberta)
        if (state.ui.view !== 'no-contact') {
          state.ui.view = 'no-contact';
          render();
        }
        return;
      }

      if (contact.isGroup) {
        if (state.ui.view !== 'group') {
          state.ui.view = 'group';
          render();
        }
        return;
      }

      var phone = contact.phone;
      var name = contact.name || extractNameFromDom();

      if (!phone) {
        if (state.ui.view !== 'no-contact') {
          state.ui.view = 'no-contact';
          render();
        }
        return;
      }

      // Já carregando/exibindo este mesmo contato → não reprocessa.
      // Inclui 'loading' para evitar o loop de render enquanto a query async resolve
      // (o WhatsApp muta o DOM intensamente e re-dispara o detect várias vezes).
      if (phone === state.current.phone && (state.ui.view === 'existing-lead' || state.ui.view === 'new-lead' || state.ui.view === 'loading')) {
        return;
      }

      console.log('[Connect CRM] Contato detectado via page world:', phone, name);
      stopLeadPolling();
      state.visible = true; // auto-exibe quando um chat é aberto
      state.ui.view = 'loading';
      state.ui.error = '';
      state.ui.success = '';
      state.ui.tab = 'dados'; // sempre começa na aba Dados ao trocar de contato
      render();

      var normalPhone = normalizePhone(phone);
      state.current.phone = phone;
      state.current.name = name;
      state.current.photo = null;

      // Resolve a foto para base64 ANTES de carregar o lead — assim o save
      // (create ou update de foto_url) sempre persiste data URI, nunca URL que expira
      resolvePhotoToDataUri(contact.photo).then(function (photoDataUri) {
        state.current.photo = photoDataUri;
        return getLeadByPhone(normalPhone, state.auth.access_token);
      }).then(function (lead) {
        state.current.lead = lead;

        if (lead) {
          state.form = {
            nome: lead.nome,
            status: lead.status,
            origem_id: lead.origem_id || '',
            segmento_id: lead.segmento_id || '',
            observacao: lead.observacao || '',
            valor: lead.valor != null ? String(lead.valor) : '',
            tags: Array.isArray(lead.tags) ? lead.tags : [],
          };
          state.ui.view = 'existing-lead';
          console.log('[Connect CRM] Lead encontrado:', lead.nome);
          // Atualiza foto_url se ainda não tem e acabamos de capturar uma
          if (state.current.photo && !lead.foto_url) {
            updateLead(lead.id, { foto_url: state.current.photo }, state.auth.access_token)
              .then(function (u) { if (u) state.current.lead.foto_url = u.foto_url || state.current.photo; })
              .catch(function () { });
          }
          startLeadPolling();
        } else {
          stopLeadPolling();
          state.form = { nome: name || '', status: 'novo_lead', origem_id: '', segmento_id: '', observacao: '', valor: '', tags: [] };
          state.ui.view = 'new-lead';
          console.log('[Connect CRM] Contato não cadastrado:', normalPhone);
        }

        state.ui.animate = true; // anima ao abrir o CRM / trocar de contato
        render();
      }).catch(function (err) {
        console.error('[Connect CRM] Erro ao buscar lead:', err);
        if (err && err.isUnauthorized) {
          handleUnauthorized();
        } else {
          state.current.phone = null;
          state.ui.view = 'no-contact';
          render();
        }
      });
    });
  }


  /* ===== INIT ===== */

  // Inicia os intervalos de polling — chamado UMA vez após autenticação.
  // Flag garante que múltiplos logins (ex: via bridge) não disparem intervalos duplicados.
  var pollingStarted = false;

  function startPolling() {
    if (pollingStarted) return;
    pollingStarted = true;
    setInterval(injectListBadges, 3000);
    setInterval(function () {
      if (state.auth) syncRecentLeads(state.auth.access_token);
    }, 5000);
    setInterval(function () {
      if (state.auth) loadLeadsCache(state.auth.access_token);
    }, 60000);
    setInterval(function () {
      if (state.auth) fetchPendingFollowups(state.auth.access_token);
    }, 300000);
    // Sincroniza statuses/origens/segmentos a cada 30s para refletir mudanças feitas no CRM
    setInterval(function () {
      if (!state.auth) return;
      Promise.all([
        getSources(state.auth.access_token),
        getSegments(state.auth.access_token),
        getStatuses(state.auth.access_token),
        getOrg(state.auth.access_token),
      ]).then(function (results) {
        state.sources = Array.isArray(results[0]) ? results[0] : state.sources;
        state.segments = Array.isArray(results[1]) ? results[1] : state.segments;
        state.statuses = Array.isArray(results[2]) ? results[2] : state.statuses;
        var org = results[3];
        if (org) { state.orgName = (org.nome_exibicao && org.nome_exibicao.trim()) || org.nome || ''; applyBranding(); }
      }).catch(function () { });
    }, 30000);
  }

  // Inicializa a extensão com uma sessão válida (reutilizado pelo boot inicial e pelo bridge)
  function bootAuthenticated(session) {
    state.auth = session;
    state.ui.view = 'loading';
    render();

    fetchPendingFollowups(session.access_token);

    Promise.all([
      loadMeta(),
      waitForElement('#pane-side, [aria-label="Lista de conversas"], #main', 20000),
    ]).then(function () {
      console.log('[Connect CRM] WhatsApp Web pronto.');
      if (typeof crmLogger !== 'undefined') crmLogger.info('boot_whatsapp_pronto', 'WhatsApp Web detectado e pronto — extensão ativa', { modulo: 'content.js' });
      detectAndLoad();
      ensurePageScript().then(function () {
        injectListBadges();
        var earlyTries = 0;
        var earlyTimer = setInterval(function () {
          earlyTries++;
          injectListBadges();
          if (earlyTries >= 8) clearInterval(earlyTimer);
        }, 1500);
      });
      startPolling();
    }).catch(function (err) {
      if (typeof crmLogger !== 'undefined') crmLogger.error('boot_extensao', 'WhatsApp Web não ficou pronto — seletor não encontrado em 20s', {
        modulo: 'content.js',
        erro_tecnico: err && (err.message || String(err)),
        contexto: { url: location.href }
      });
    });
  }

  function startExtension() {
    // Injeta o sidebar imediatamente
    injectSidebar();

    // Detecta painéis nativos do WhatsApp e cede espaço automaticamente
    watchWhatsAppModals();

    // Escuta atualizações de sessão vindas do session-bridge.js (CRM Web)
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      var newSession = changes[STORAGE_KEY].newValue;

      if (newSession && newSession.access_token && !state.auth) {
        // Sessão chegou do CRM — inicia automaticamente sem precisar de login
        console.log('[Connect CRM] Sessão recebida do CRM — iniciando automaticamente.');
        if (typeof crmLogger !== 'undefined') crmLogger.info('sessao_recebida', 'Sessão recebida do CRM web — extensão autenticada automaticamente', { modulo: 'content.js' });
        bootAuthenticated(newSession);
      } else if (newSession && newSession.access_token && state.auth &&
        newSession.access_token !== state.auth.access_token) {
        // CRM renovou o token (~1h) — atualiza no lugar, sem re-bootar, para que
        // as próximas chamadas usem o token fresco em vez do antigo (que expira
        // e derrubaria o usuário pro login mesmo com o CRM aberto e válido).
        console.log('[Connect CRM] Token atualizado pelo CRM.');
        if (typeof crmLogger !== 'undefined') crmLogger.info('token_atualizado', 'Token de acesso renovado pelo CRM web — sessão continuada', { modulo: 'content.js' });
        state.auth = newSession;
      } else if (!newSession && state.auth) {
        // Usuário fez logout no CRM — espelha aqui
        console.log('[Connect CRM] Logout detectado no CRM.');
        if (typeof crmLogger !== 'undefined') crmLogger.info('logout_detectado', 'Logout detectado no CRM web — sessão encerrada na extensão', { modulo: 'content.js' });
        handleUnauthorized();
      }
    });

    // Verifica sessão existente no storage
    getSession().then(function (session) {
      if (session && session.access_token) {
        bootAuthenticated(session);
      } else {
        state.ui.view = 'login';
        render();
      }

      // MutationObserver para detectar mudanças de conversa
      var debouncedDetect = debounce(detectAndLoad, 200);
      var observer = new MutationObserver(debouncedDetect);
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });

    }).catch(function (err) {
      console.error('[Connect CRM] Erro na sessão:', err);
      state.ui.view = 'login';
      render();
    });
  }

  // Inicializa o logger (drena fila offline + sincroniza debug_mode)
  if (typeof crmLogger !== 'undefined') crmLogger.init();

  // Inicia assim que o body estiver disponível
  if (document.body) {
    startExtension();
  } else {
    document.addEventListener('DOMContentLoaded', startExtension);
  }

})();
