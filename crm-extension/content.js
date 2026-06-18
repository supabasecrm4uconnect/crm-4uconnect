(function () {
  'use strict';

  // Guard: não reinjetar se já existe
  if (document.getElementById('crm-4u-root')) return;

  console.log('[4U CRM] Content script carregado.');

  /* ===== CONFIGURAÇÃO ===== */

  const SUPABASE_URL = 'https://cimehhzkwgiwgfnkeauo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWVoaHprd2dpd2dmbmtlYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Nzk0NTEsImV4cCI6MjA5NzE1NTQ1MX0.lMAp7uK7_H3jRqGksZGVVH72bxyOISIOAefTPAlLxJI';

  // ⚠️ PRODUÇÃO: antes de entregar a extensão à atendente, troque o valor abaixo
  // pelo domínio real do CRM na Vercel. Ex.: 'https://crm.4uconnect.com.br'
  // (sem barra no final). Em desenvolvimento, mantenha 'http://localhost:5173'.
  // Este é o ÚNICO lugar do código que precisa mudar para apontar à produção.
  const CRM_URL = 'http://localhost:5173'; // ⚠️ TROCAR PARA O DOMÍNIO DE PRODUÇÃO

  const STORAGE_KEY = 'crm_4u_session';

  /* ===== STATUS CONFIG (dinâmico — carregado do DB) ===== */

  function getStatusCfg(value) {
    if (state && state.statuses) {
      var found = state.statuses.find(function(s) { return s.value === value; });
      if (found) return { label: found.label, color: found.color_text, bg: found.color_bg, dot: found.color_dot };
    }
    return { label: value, color: '#475569', bg: '#f1f5f9', dot: '#94a3b8' };
  }

  const ACTIVITY_TYPES = [
    { value: 'ligar',              label: 'Ligar'               },
    { value: 'enviar_mensagem',    label: 'Enviar mensagem'     },
    { value: 'retornar_orcamento', label: 'Retornar orçamento'  },
    { value: 'cobrar_resposta',    label: 'Cobrar resposta'     },
    { value: 'reuniao',            label: 'Reunião'             },
    { value: 'enviar_proposta',    label: 'Enviar proposta'     },
    { value: 'pos_venda',          label: 'Pós-venda'           },
  ];

  /* ===== STORAGE ===== */

  function getSession() {
    return new Promise(function(resolve) {
      chrome.storage.local.get([STORAGE_KEY], function(r) {
        resolve(r[STORAGE_KEY] || null);
      });
    });
  }

  function saveSession(data) {
    return new Promise(function(resolve) {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  function clearSession() {
    return new Promise(function(resolve) {
      chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
  }

  function handleUnauthorized() {
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
    }).then(function(res) {
      if (res.status === 204) return null;
      if (res.status === 401) {
        var err = new Error('Sessão expirada');
        err.isUnauthorized = true;
        throw err;
      }
      return res.json();
    });
  }

  function apiRequest(method, path, body, token) {
    // A sessão vem exclusivamente do CRM (via session-bridge). A extensão não renova
    // tokens por conta própria — quando o token expirar, o usuário deve fazer login no CRM.
    return doFetch(method, path, body, token).catch(function(err) {
      if (err.isUnauthorized) handleUnauthorized();
      throw err;
    });
  }


  function getLeadByPhone(phone, token) {
    // Busca pelas duas variantes do número (com/sem 9º dígito) para não criar duplicados
    var variants = phoneVariants(phone);
    return apiRequest('GET', '/rest/v1/leads?whatsapp=in.(' + variants.join(',') + ')&select=*,lead_sources(id,nome),lead_segments(id,nome)&limit=1', null, token)
      .then(function(data) { return Array.isArray(data) ? data[0] || null : null; });
  }

  function createLead(body, token) {
    return apiRequest('POST', '/rest/v1/leads', body, token)
      .then(function(data) { return Array.isArray(data) ? data[0] : data; });
  }

  function updateLead(id, body, token) {
    return apiRequest('PATCH', '/rest/v1/leads?id=eq.' + id, body, token)
      .then(function(data) { return Array.isArray(data) ? data[0] : data; });
  }

  function insertStatusHistory(body, token) {
    return apiRequest('POST', '/rest/v1/lead_status_history', body, token);
  }

  function createActivity(body, token) {
    return apiRequest('POST', '/rest/v1/lead_activities', body, token);
  }

  function getSources(token) {
    return apiRequest('GET', '/rest/v1/lead_sources?ativo=eq.true&select=id,nome&order=nome', null, token)
      .then(function(d) { return Array.isArray(d) ? d : []; });
  }

  function getSegments(token) {
    return apiRequest('GET', '/rest/v1/lead_segments?ativo=eq.true&select=id,nome&order=nome', null, token)
      .then(function(d) { return Array.isArray(d) ? d : []; });
  }

  function getStatuses(token) {
    return apiRequest('GET', '/rest/v1/lead_statuses?ativo=eq.true&select=*&order=ordem', null, token)
      .then(function(d) { return Array.isArray(d) ? d : []; });
  }

  function loadLeadsCache(token) {
    return apiRequest('GET', '/rest/v1/leads?select=id,nome,whatsapp,status&order=updated_at.desc&limit=2000', null, token)
      .then(function(data) {
        if (!Array.isArray(data)) return;
        leadsCache = {};
        data.forEach(function(lead) {
          if (!lead.whatsapp) return;
          // Indexa sob TODAS as variantes do número (com/sem 9º dígito)
          phoneVariants(lead.whatsapp).forEach(function(v) { leadsCache[v] = lead; });
        });
        console.log('[4U CRM] Cache de leads: ' + Object.keys(leadsCache).length + ' leads.');
      }).catch(function(err) { if (err && err.isUnauthorized) handleUnauthorized(); });
  }

  function syncRecentLeads(token) {
    var thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    return apiRequest('GET', '/rest/v1/leads?select=id,nome,whatsapp,status&updated_at=gte.' + thirtySecondsAgo, null, token)
      .then(function(data) {
        if (!Array.isArray(data) || data.length === 0) return;
        var changed = false;
        data.forEach(function(lead) {
          if (!lead.whatsapp) return;
          phoneVariants(lead.whatsapp).forEach(function(v) {
            if (!leadsCache[v] || leadsCache[v].status !== lead.status || leadsCache[v].nome !== lead.nome) {
              leadsCache[v] = lead;
              changed = true;
            }
          });
        });
        if (changed) injectListBadges();
      }).catch(function(err) { if (err && err.isUnauthorized) handleUnauthorized(); });
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
    if (local.length === 11) return '(' + local.slice(0,2) + ') ' + local.slice(2,7) + '-' + local.slice(7);
    if (local.length === 10) return '(' + local.slice(0,2) + ') ' + local.slice(2,6) + '-' + local.slice(6);
    return number;
  }

  function getInitials(name) {
    return (name || '').trim().split(/\s+/).slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
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
    var sum = (name || '').split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  function debounce(fn, ms) {
    var timer;
    return function() {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(null, args); }, ms);
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      ? state.statuses.map(function(s) { return { value: s.value, label: s.label }; })
      : [{ value: 'novo_lead', label: 'Novo lead' }];
    return list.map(function(s) {
      return '<option value="' + s.value + '"' + (s.value === selected ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    }).join('');
  }

  function sourceOptions(sources, selected) {
    var opts = (sources || []).map(function(s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + escapeHtml(s.nome) + '</option>';
    }).join('');
    return '<option value="">Selecionar</option>' + opts;
  }

  function segmentOptions(segments, selected) {
    var opts = (segments || []).map(function(s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + escapeHtml(s.nome) + '</option>';
    }).join('');
    return '<option value="">Selecionar</option>' + opts;
  }

  function activityTypeOptions(selected) {
    return ACTIVITY_TYPES.map(function(t) {
      return '<option value="' + t.value + '"' + (t.value === selected ? ' selected' : '') + '>' + escapeHtml(t.label) + '</option>';
    }).join('');
  }

  function tagsFieldHtml(tags) {
    var chips = (tags || []).map(function(tag) {
      return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#f1f5f9;color:#475569;border-radius:999px;font-size:11px;font-weight:500">' +
        escapeHtml(tag) +
        '<button type="button" data-remove-tag="' + escapeHtml(tag) + '" style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;line-height:1;color:#94a3b8;font-size:14px;display:flex;align-items:center">\xd7</button>' +
        '</span>';
    }).join('');
    return '<div class="crm-field">' +
      '<label class="crm-label">Tags</label>' +
      '<div id="crm-tags-container" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:8px;min-height:36px;background:#fff;cursor:text" onclick="document.getElementById(\'crm-tag-input\')&&document.getElementById(\'crm-tag-input\').focus()">' +
        chips +
        '<input id="crm-tag-input" type="text" placeholder="' + ((tags && tags.length) ? '' : 'Adicionar tag...') + '" style="border:none;outline:none;font-size:12px;color:#0f172a;background:transparent;min-width:80px;flex:1;padding:1px 2px;font-family:inherit" />' +
      '</div>' +
      '<p style="font-size:10px;color:#94a3b8;margin:3px 0 0">Enter ou vírgula para adicionar</p>' +
    '</div>';
  }

  /* ===== AGUARDA ELEMENTO NO DOM ===== */

  function waitForElement(selector, timeoutMs) {
    return new Promise(function(resolve) {
      var el = document.querySelector(selector);
      if (el) { resolve(el); return; }

      var timer = setTimeout(function() {
        obs.disconnect();
        console.warn('[4U CRM] Timeout aguardando:', selector);
        resolve(null);
      }, timeoutMs || 15000);

      var obs = new MutationObserver(function() {
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
        console.log('[4U CRM] inject.js pronto no page world.');
        resolve();
      };
      script.onerror = function () {
        console.warn('[4U CRM] Falha ao carregar inject.js.');
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
          console.log('[4U CRM] Page world: timeout.');
          resolve(null);
        }, 2000);

        function handler(e) {
          if (!e.data || e.data.source !== 'crm4u_inject' || e.data.type !== 'PHONE_RESULT') return;
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve({
            phone:   e.data.phone   || null,
            name:    e.data.name    || null,
            isGroup: !!e.data.isGroup,
            photo:   e.data.photo   || null,
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
      console.log('[4U CRM][foto] Já é data URI (' + photo.length + ' chars).');
      return Promise.resolve(photo);
    }
    if (!/^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//.test(photo)) {
      console.log('[4U CRM][foto] Fonte descartada (formato não suportado):', photo.slice(0, 60));
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_PHOTO', url: photo }, function (resp) {
          if (chrome.runtime.lastError) {
            console.warn('[4U CRM][foto] Erro no background:', chrome.runtime.lastError.message);
            resolve(null); return;
          }
          if (!resp || !resp.dataUri) {
            console.warn('[4U CRM][foto] Background não retornou foto. resp:', JSON.stringify(resp).slice(0, 100));
            resolve(null); return;
          }
          // Guarda de tamanho: thumbnails têm ~5-30KB; acima de 150KB algo está errado
          if (resp.dataUri.length > 200000) {
            console.warn('[4U CRM][foto] Foto muito grande, descartada:', resp.dataUri.length);
            resolve(null); return;
          }
          console.log('[4U CRM][foto] Convertida para base64 (' + resp.dataUri.length + ' chars).');
          resolve(resp.dataUri);
        });
      } catch (e) {
        console.warn('[4U CRM][foto] Exceção no sendMessage (página precisa de F5 após recarregar a extensão?):', e.message);
        resolve(null);
      }
    });
  }

  /* ===== BADGES NA LISTA DE CONVERSAS ===== */

  function requestAnnotateChats() {
    return ensurePageScript().then(function() {
      return new Promise(function(resolve) {
        // 400ms é suficiente — inject.js responde em milissegundos quando bem-sucedido
        var timer = setTimeout(function() {
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
    document.querySelectorAll('[data-testid="cell-frame-container"]').forEach(function(row) {
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
    Object.keys(leadsCache).forEach(function(phone) {
      var lead = leadsCache[phone];
      var key = normalizeName(lead.nome);
      if (key) nameMap[key] = lead;
    });

    // Passo 1: scan imediato por nome (sem esperar fiber) — badges aparecem em <10ms
    scanRows(nameMap);

    // Passo 2: anota telefones via fiber walk no page world e refaz o scan (cobre não-salvos)
    requestAnnotateChats().then(function() {
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
    ui: { view: 'loading', saving: false, error: '', success: '', tab: 'dados' },
    form: { nome: '', status: 'novo_lead', origem_id: '', segmento_id: '', observacao: '', tags: [] },
    followupForm: { tipo: 'enviar_mensagem', data: '', hora: '', descricao: '' },
  };

  /* ===== FOLLOW-UP BADGE ===== */

  function todayLocalStr() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm   = String(d.getMonth() + 1).padStart(2, '0');
    var dd   = String(d.getDate()).padStart(2, '0');
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
    ).then(function(data) {
      var list = Array.isArray(data) ? data : [];
      var count = list.length;
      state.avisosList = list;
      if (state.pendingFollowups !== count) {
        state.pendingFollowups = count;
        renderFollowupBadge();
      }
      // Re-renderiza a aba Avisos se estiver ativa
      if (state.ui.tab === 'avisos') render();
    }).catch(function(err) { if (err && err.isUnauthorized) handleUnauthorized(); });
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
          '<span class="crm-logo-text">4U Connect CRM</span>',
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

    document.getElementById('crm-refresh-btn').addEventListener('click', function() {
      state.current.phone = null; // force reload
      detectAndLoad();
    });

    console.log('[4U CRM] Sidebar injetado no DOM.');
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
      var root   = document.getElementById('crm-4u-root');
      var toggle = document.getElementById('crm-4u-toggle');
      if (!root || !toggle || !state.visible) return;

      console.log('[4U CRM] Painel WA detectado — ocultando sidebar.');
      state.visible    = false;
      state.hiddenByWA = true;
      root.classList.add('crm-hidden');
      toggle.classList.add('crm-toggle-hidden');
      toggle.querySelector('path').setAttribute('d', 'M4 2L8 6L4 10');
      toggle.title = 'CRM oculto — clique para restaurar';
      toggle.style.borderLeft = '3px solid #10b981';
    }

    function restoreSidebarAfterWA() {
      var root   = document.getElementById('crm-4u-root');
      var toggle = document.getElementById('crm-4u-toggle');
      if (!root || !toggle || !state.hiddenByWA) return;

      console.log('[4U CRM] Painel WA fechado — restaurando sidebar.');
      state.visible    = true;
      state.hiddenByWA = false;
      root.classList.remove('crm-hidden');
      toggle.classList.remove('crm-toggle-hidden');
      toggle.querySelector('path').setAttribute('d', 'M8 2L4 6L8 10');
      toggle.title = 'Abrir/fechar CRM';
      toggle.style.borderLeft = '';
    }

    var panelWasOpen = false;

    setInterval(function() {
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
          } catch(rangeErr) {
            document.execCommand('selectAll', false, null);
          }
          document.execCommand('delete', false, null);
        } else {
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, value);
        }
      }
    } catch (err) {
      console.error('[4U CRM] Erro ao setar valor do input:', err);
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        try {
          input.focus();
          document.execCommand('selectAll', false, null);
          if (value === '') { document.execCommand('delete', false, null); }
          else { document.execCommand('insertText', false, value); }
        } catch(e) {}
      }
    }
  }

  function simulateClick(el) {
    if (!el) return;
    try {
      var events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      events.forEach(function(eventName) {
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
      console.error('[4U CRM] Erro ao simular clique:', e);
      el.click();
    }
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
            console.log('[4U CRM] Encontrou botão de adicionar contato:', text || aria || title);
            simulateClick(clickTarget);
            return true;
          }
        }
      }
    }
    return false;
  }

  function triggerWhatsAppAddContactDrawer() {
    return new Promise(function(resolve, reject) {
      // Verifica se já está aberto
      var drawer = document.querySelector('[data-testid="save-contact-drawer"]');
      if (drawer) {
        return resolve(drawer);
      }
      
      // Tenta achar na tela principal
      if (findAndClickAddContactButton()) {
        var count = 0;
        var interval = setInterval(function() {
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
      console.log('[4U CRM] Clicou no cabeçalho para abrir Info do Contato');
      
      // Espera o drawer direito abrir
      var count2 = 0;
      var rightDrawerOpened = false;
      var interval2 = setInterval(function() {
        var rightDrawer = document.querySelector('[data-testid="drawer-right"]');
        if (rightDrawer) {
          rightDrawerOpened = true;
          // Procura o botão no drawer direito
          if (findAndClickAddContactButton()) {
            clearInterval(interval2);
            // Espera abrir o save-contact-drawer
            var count3 = 0;
            var interval3 = setInterval(function() {
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
    console.log('[4U CRM] Iniciando automação de salvar no WhatsApp:', contactName);
    
    triggerWhatsAppAddContactDrawer()
      .then(function(drawer) {
        console.log('[4U CRM] Drawer de contato detectado com sucesso! Aguardando renderização dos inputs...');
        
        // Polling para esperar os inputs estarem presentes e visíveis no drawer
        var inputPollCount = 0;
        var inputInterval = setInterval(function() {
          var rawInputs = drawer.querySelectorAll('input, [contenteditable="true"]');
          var visibleInputs = [];
          for (var i = 0; i < rawInputs.length; i++) {
            var rect = rawInputs[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              visibleInputs.push(rawInputs[i]);
            }
          }
          
          if (visibleInputs.length > 0 || inputPollCount++ > 15) {
            clearInterval(inputInterval);
            fillContactDetails(drawer, visibleInputs, contactName);
          }
        }, 150);
      })
      .catch(function(err) {
        console.error('[4U CRM] Falha na automação de salvar contato:', err.message);
      });
  }

  function fillContactDetails(drawer, _inputs, contactName) {
    var nameParts = contactName.trim().split(/\s+/);
    var firstName = nameParts[0] || '';
    var lastName  = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : '';

    // 1. Nome — query por aria-label para não depender da ordem DOM
    var nomeField = drawer.querySelector('[contenteditable="true"][aria-label="Nome"]') ||
                    drawer.querySelector('[data-testid="text-input"][aria-label="Nome"]');
    if (nomeField) {
      setReactInputValue(nomeField, firstName);
      console.log('[4U CRM] Nome preenchido:', firstName);
    } else {
      console.warn('[4U CRM] Campo Nome não encontrado no drawer.');
    }

    // 2. Sobrenome — re-query após 150 ms para evitar referência obsoleta após re-render do Lexical
    setTimeout(function() {
      var sobrenomeField = drawer.querySelector('[contenteditable="true"][aria-label="Sobrenome"]') ||
                           drawer.querySelector('[data-testid="text-input"][aria-label="Sobrenome"]');
      if (sobrenomeField) {
        setReactInputValue(sobrenomeField, lastName);
        console.log('[4U CRM] Sobrenome preenchido:', lastName !== '' ? lastName : '(limpo)');
        if (lastName === '') {
          // Verifica se execCommand('delete') realmente limpou o campo Lexical
          setTimeout(function() {
            var domContent = (sobrenomeField.innerText || '').replace(/\n/g, '').trim();
            console.log('[4U CRM] Sobrenome DOM após limpeza:', domContent === '' ? '(vazio ✓)' : '"' + domContent + '" — AINDA TEM CONTEÚDO');
          }, 80);
        }
      }

      // 3. Toggle "Sincronizar contato com celular"
      setTimeout(function() {
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
                  nd.memoizedProps.onChange({ target: el, currentTarget: el, type: 'change', preventDefault: function(){}, stopPropagation: function(){}, nativeEvent: {} });
                  fiberActivated = true;
                  break;
                }
                nd = nd.return;
              }
            }
          } catch(ferr) {
            console.warn('[4U CRM] Fiber toggle falhou:', ferr.message);
          }

          if (!fiberActivated) {
            // Fallback: click() nativo que togglea o checkbox e dispara os eventos
            el.click();
          }
        }

        if (!toggle) {
          console.warn('[4U CRM] Toggle de sincronização não encontrado no drawer.');
        } else if (toggle.checked) {
          console.log('[4U CRM] Toggle já ativo.');
        } else {
          console.log('[4U CRM] Ativando toggle de sincronização...');
          activateToggle(toggle);
          setTimeout(function() {
            // Re-query para pegar o estado atualizado pelo React (não o nosso nativeSetter)
            var freshToggle = drawer.querySelector('#sync-contact-switch') ||
                              drawer.querySelector('input[aria-label="Sincronizar contato com celular"]');
            var nowChecked = freshToggle ? freshToggle.checked : toggle.checked;
            console.log('[4U CRM] Toggle estado após ativação:', nowChecked ? 'ATIVO ✓' : 'AINDA INATIVO — retry');
            if (!nowChecked && freshToggle) {
              activateToggle(freshToggle);
              setTimeout(function() {
                var t2 = drawer.querySelector('#sync-contact-switch') ||
                          drawer.querySelector('input[aria-label="Sincronizar contato com celular"]');
                console.log('[4U CRM] Toggle estado final:', t2 ? t2.checked : '?');
              }, 200);
            }
          }, 300);
        }

        // 4. Salvar — verifica popup "Continuar" antes de clicar salvar.
        // O toggle pode abrir um popup de confirmação que bloqueia o formulário;
        // tentar salvar enquanto o popup está visível resulta em save silenciosamente ignorado.
        setTimeout(function() {
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
              console.log('[4U CRM] Botão salvar encontrado. disabled:', saveBtnDisabled, 'testid:', saveBtn.getAttribute('data-testid') || '');
              if (saveBtnDisabled) {
                console.warn('[4U CRM] Botão salvar DESATIVADO — WA pode estar com validação pendente (Sobrenome vazio?).');
              }
              simulateClick(saveBtn);
              setTimeout(function() {
                var closeBtn =
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Fechar"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Close"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Voltar"]') ||
                  document.querySelector('[data-testid="save-contact-drawer"] [aria-label="Back"]') ||
                  document.querySelector('[aria-label="Fechar"][data-tab="2"]') ||
                  document.querySelector('[data-testid="drawer-right"] [aria-label="Fechar"]');
                if (closeBtn) {
                  console.log('[4U CRM] Fechando drawer de contato automaticamente.');
                  simulateClick(closeBtn);
                }
              }, 1200);
            } else {
              console.warn('[4U CRM] Botão de salvar do WhatsApp não foi encontrado no drawer.');
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
            console.log('[4U CRM] Popup de toggle detectado antes de salvar — clicando Continuar.');
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
    var moreBtn = document.querySelector('button[aria-label="Mais opções"][data-tab="6"]');
    if (!moreBtn) return;
    simulateClick(moreBtn);

    waitForElement(
      'button[aria-label="Dados do contato"][role="menuitem"], button[aria-label="Add to contacts"][role="menuitem"]',
      3000
    ).then(function(found) {
      if (!found) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      var isDados = document.querySelector('button[aria-label="Dados do contato"][role="menuitem"]');
      if (isDados) {
        // Contato já salvo na agenda → editar pelo fluxo nativo
        automateWhatsAppEditContact(newName);
      } else {
        // Contato não salvo → fechar menu e abrir drawer de adicionar contato
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        setTimeout(function() { automateWhatsAppSaveContact(newName); }, 400);
      }
    });
  }

  // Edita o nome de um contato já salvo na agenda do WhatsApp Web.
  // Fluxo: "Mais opções" (já aberto) → "Dados do contato" → aguarda botão "Editar" → save-contact-drawer → preenche nome → salva.
  function automateWhatsAppEditContact(newName) {
    var dadosBtn = document.querySelector('button[aria-label="Dados do contato"][role="menuitem"]');
    if (!dadosBtn) return;
    simulateClick(dadosBtn);

    // Aguarda direto o botão "Editar" — não depende do testid do painel de informações
    // (varia entre versões do WA: contact-info-1, drawer-right, etc.)
    waitForElement('button[aria-label="Editar"]', 6000).then(function(editBtn) {
      if (!editBtn) return;
      simulateClick(editBtn);

      waitForElement('[data-testid="save-contact-drawer"]', 5000).then(function(saveDrawer) {
        if (!saveDrawer) return;
        var count = 0;
        var poll = setInterval(function() {
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
            setTimeout(function() {
              var fallbackBtns = document.querySelectorAll('button');
              for (var j = 0; j < fallbackBtns.length; j++) {
                if ((fallbackBtns[j].textContent || '').trim().toLowerCase() === 'continuar') {
                  console.log('[4U CRM] Popup residual "Continuar" detectado — clicando (fallback).');
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
          '<div class="crm-field"><label class="crm-label">Nome</label><input class="crm-input" type="text" id="crm-nome" value="' + escapeHtml(form.nome) + '" placeholder="Nome do contato" required /></div>',
          '<div class="crm-field"><label class="crm-label">Status</label><select class="crm-select" id="crm-status">' + statusOptions(form.status) + '</select></div>',
          '<div class="crm-field"><label class="crm-label">Origem</label><select class="crm-select" id="crm-origem">' + sourceOptions(sources, form.origem_id) + '</select></div>',
          '<div class="crm-field"><label class="crm-label">Segmento</label><select class="crm-select" id="crm-segmento">' + segmentOptions(segments, form.segmento_id) + '</select></div>',
          tagsFieldHtml(form.tags),
          '<div class="crm-field"><label class="crm-label">Observação</label><textarea class="crm-textarea" id="crm-obs" placeholder="Informações do atendimento...">' + escapeHtml(form.observacao) + '</textarea></div>',
          '<button class="crm-btn crm-btn-primary" type="submit"' + (saving ? ' disabled' : '') + '>',
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
        error   ? '<div class="crm-alert crm-alert-error">'   + escapeHtml(error)   + '</div>' : '',
        success ? '<div class="crm-alert crm-alert-success">' + escapeHtml(success) + '</div>' : '',
        '<form id="crm-update-form">',
          '<div class="crm-field"><label class="crm-label">Nome</label><input class="crm-input" type="text" id="crm-nome" value="' + escapeHtml(form.nome) + '" placeholder="Nome do contato" /></div>',
          '<div class="crm-field"><label class="crm-label">Status</label><select class="crm-select" id="crm-status">' + statusOptions(form.status) + '</select></div>',
          '<div class="crm-field"><label class="crm-label">Origem</label><select class="crm-select" id="crm-origem">' + sourceOptions(sources, form.origem_id) + '</select></div>',
          '<div class="crm-field"><label class="crm-label">Segmento</label><select class="crm-select" id="crm-segmento">' + segmentOptions(segments, form.segmento_id) + '</select></div>',
          tagsFieldHtml(form.tags),
          '<div class="crm-field"><label class="crm-label">Observação</label><textarea class="crm-textarea" id="crm-obs" placeholder="Informações do atendimento...">' + escapeHtml(form.observacao) + '</textarea></div>',
          '<button class="crm-btn crm-btn-primary" type="submit"' + (saving ? ' disabled' : '') + '>',
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
        error   ? '<div class="crm-alert crm-alert-error">'   + escapeHtml(error)   + '</div>' : '',
        success ? '<div class="crm-alert crm-alert-success">' + escapeHtml(success) + '</div>' : '',
        '<p style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Agendar novo follow-up</p>',
        '<form id="crm-followup-form">',
          '<div class="crm-field"><label class="crm-label">Tipo</label><select class="crm-select" id="crm-fu-tipo">' + activityTypeOptions(followupForm.tipo) + '</select></div>',
          '<div class="crm-followup-row" style="margin-bottom:10px">',
            '<div class="crm-field" style="margin-bottom:0"><label class="crm-label">Data</label><input class="crm-input" type="date" id="crm-fu-data" value="' + escapeHtml(followupForm.data) + '" required /></div>',
            '<div class="crm-field" style="margin-bottom:0"><label class="crm-label">Hora</label><input class="crm-input" type="time" id="crm-fu-hora" value="' + escapeHtml(followupForm.hora) + '" required /></div>',
          '</div>',
          '<div class="crm-field"><label class="crm-label">Descrição</label><input class="crm-input" type="text" id="crm-fu-desc" value="' + escapeHtml(followupForm.descricao) + '" placeholder="Opcional..." /></div>',
          '<button class="crm-btn crm-btn-primary" type="submit"' + (saving ? ' disabled' : '') + '>',
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
      var atrasados = state.avisosList.filter(function(a) { return a.data_agendada < today2; });
      var hojeList  = state.avisosList.filter(function(a) { return a.data_agendada === today2; });

      function avisosGroup(label, color, items) {
        if (!items.length) return '';
        var rows = items.map(function(a) {
          var leadNome = (a.leads && a.leads.nome) ? a.leads.nome : '—';
          var leadId   = a.leads && a.leads.id ? a.leads.id : null;
          var tipo = ACTIVITY_TYPES.find(function(t) { return t.value === a.tipo_atividade; });
          var tipoLabel = tipo ? tipo.label : a.tipo_atividade;
          var hora = a.hora_agendada ? a.hora_agendada.slice(0, 5) : '';
          var dataFmt = a.data_agendada
            ? (function(d) { var p = d.split('-'); return p[2]+'/'+p[1]; })(a.data_agendada)
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

      if (activeTab === 'dados')    html = tabBar + contactCard + tabDados;
      else if (activeTab === 'followup') html = tabBar + contactCard + tabFollowup;
      else                          html = tabBar + tabAvisos;
    }

    content.innerHTML = html;
    attachEvents();

    // Stagger sequencial: anima cada elemento-chave em ordem de aparição no DOM
    var staggerEls = content.querySelectorAll(
      '.crm-contact, .crm-field, .crm-followup-form, .crm-aviso-item, .crm-btn-group, .crm-center'
    );
    Array.prototype.forEach.call(staggerEls, function(el, i) {
      el.style.animation = 'crm-content-appear 0.22s ease both';
      el.style.animationDelay = (i * 50) + 'ms';
    });

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
      var saveForm = document.getElementById('crm-save-form');
      if (saveForm) saveForm.addEventListener('submit', handleSaveLead);
      syncFormInputs();
    }

    if (view === 'existing-lead') {
      // Tab switching
      var tabDadosBtn = document.getElementById('crm-tab-dados');
      var tabFuBtn    = document.getElementById('crm-tab-followup');
      var tabAvisosBtn = document.getElementById('crm-tab-avisos');
      if (tabDadosBtn) tabDadosBtn.addEventListener('click', function() {
        state.ui.tab = 'dados';
        state.ui.error = '';
        state.ui.success = '';
        render();
      });
      if (tabFuBtn) tabFuBtn.addEventListener('click', function() {
        state.ui.tab = 'followup';
        state.ui.error = '';
        state.ui.success = '';
        render();
      });
      if (tabAvisosBtn) tabAvisosBtn.addEventListener('click', function() {
        state.ui.tab = 'avisos';
        state.ui.error = '';
        state.ui.success = '';
        // Recarrega a lista ao abrir a aba
        if (state.auth) fetchPendingFollowups(state.auth.access_token);
        render();
      });

      // Form handlers
      var updateForm = document.getElementById('crm-update-form');
      if (updateForm) updateForm.addEventListener('submit', handleUpdateLead);
      var fuForm = document.getElementById('crm-followup-form');
      if (fuForm) fuForm.addEventListener('submit', handleSaveFollowup);
      syncFormInputs();
    }
  }

  function syncFormInputs() {
    var inputs = {
      'crm-status':   function(v) { state.form.status = v; },
      'crm-origem':   function(v) { state.form.origem_id = v; },
      'crm-segmento': function(v) { state.form.segmento_id = v; },
      'crm-obs':      function(v) { state.form.observacao = v; },
      'crm-nome':     function(v) { state.form.nome = v; },
    };

    Object.keys(inputs).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function(e) { inputs[id](e.target.value); });
        el.addEventListener('change', function(e) { inputs[id](e.target.value); });
      }
    });

    var fuInputs = {
      'crm-fu-tipo':  function(v) { state.followupForm.tipo = v; },
      'crm-fu-data':  function(v) { state.followupForm.data = v; },
      'crm-fu-hora':  function(v) { state.followupForm.hora = v; },
      'crm-fu-desc':  function(v) { state.followupForm.descricao = v; },
    };

    Object.keys(fuInputs).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function(e) { fuInputs[id](e.target.value); });
    });

    var tagInput = document.getElementById('crm-tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          var val = tagInput.value.trim().replace(/,/g, '');
          if (val && state.form.tags.indexOf(val) === -1) {
            state.form.tags = state.form.tags.concat([val]);
            render();
          } else {
            tagInput.value = '';
          }
        } else if (e.key === 'Backspace' && !tagInput.value && state.form.tags.length > 0) {
          state.form.tags = state.form.tags.slice(0, -1);
          render();
        }
      });
    }

    var tagsContainer = document.getElementById('crm-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', function(e) {
        var btn = e.target.closest ? e.target.closest('[data-remove-tag]') : null;
        if (!btn && e.target.getAttribute) btn = e.target.getAttribute('data-remove-tag') ? e.target : null;
        if (btn) {
          var tag = btn.getAttribute('data-remove-tag');
          state.form.tags = state.form.tags.filter(function(t) { return t !== tag; });
          render();
        }
      });
    }
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
    e.preventDefault();
    flushTagInput();
    state.ui.saving = true;
    state.ui.error = '';
    render();

    var phone = normalizePhone(state.current.phone);
    var nome       = state.form.nome;
    var status     = state.form.status;
    var origem_id  = state.form.origem_id;
    var segmento_id = state.form.segmento_id;
    var observacao = state.form.observacao;
    var token = state.auth.access_token;

    getLeadByPhone(phone, token).then(function(existing) {
      if (existing) {
        state.current.lead = existing;
        state.form = { nome: existing.nome, status: existing.status, origem_id: existing.origem_id || '', segmento_id: existing.segmento_id || '', observacao: existing.observacao || '', tags: Array.isArray(existing.tags) ? existing.tags : [] };
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
        foto_url: state.current.photo || null,
        tags: state.form.tags || [],
      }, token).then(function(newLead) {
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
        }, token).then(function() {
          state.current.lead = newLead;
          state.ui.view = 'existing-lead';
          state.ui.saving = false;
          state.ui.success = 'Lead salvo com sucesso!';
          render();

          // Atualiza o cache local (todas as variantes do número) e injeta o badge na lista
          if (newLead.whatsapp) {
            var entry = { id: newLead.id, nome: newLead.nome, whatsapp: newLead.whatsapp, status: newLead.status };
            phoneVariants(newLead.whatsapp).forEach(function(v) { leadsCache[v] = entry; });
          }
          injectListBadges();

          // Automate saving the contact natively in WhatsApp Web
          var leadNome = newLead.nome || state.form.nome || state.current.name || 'Contato';
          automateWhatsAppSaveContact(leadNome);

          setTimeout(function() { state.ui.success = ''; render(); }, 3000);
        });
      });
    }).catch(function(err) {
      console.error('[4U CRM] Erro ao salvar lead:', err);
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  function handleUpdateLead(e) {
    e.preventDefault();
    if (!state.current.lead) return;

    flushTagInput();
    state.ui.saving = true;
    state.ui.error = '';
    render();

    var nome       = state.form.nome;
    var status     = state.form.status;
    var origem_id  = state.form.origem_id;
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
      tags: state.form.tags || [],
      foto_url: state.current.photo || state.current.lead.foto_url || null,
    }, token).then(function(updated) {
      var afterHistory = statusChanged
        ? insertStatusHistory({ lead_id: leadId, status_anterior: prevStatus, status_novo: status, alterado_por: state.auth.user_id || null }, token)
        : Promise.resolve();

      return afterHistory.then(function() {
        state.current.lead = Object.assign({}, state.current.lead, updated);
        state.ui.saving = false;
        state.ui.success = 'Alterações salvas!';
        render();

        // Atualiza o cache local (todas as variantes do número) e reinjeta badges na lista
        if (updated && updated.whatsapp) {
          var entry = { id: updated.id, nome: updated.nome, whatsapp: updated.whatsapp, status: updated.status };
          phoneVariants(updated.whatsapp).forEach(function(v) { leadsCache[v] = entry; });
        }
        injectListBadges();

        // Sincroniza nome no WhatsApp Web apenas quando o nome mudou
        if (nomeChanged && document.querySelector('#main')) {
          syncContactNameToWA(updated.nome || nome);
        }

        setTimeout(function() { state.ui.success = ''; render(); }, 3000);
      });
    }).catch(function(err) {
      console.error('[4U CRM] Erro ao atualizar lead:', err);
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  function handleSaveFollowup(e) {
    e.preventDefault();
    if (!state.current.lead) return;

    state.ui.saving = true;
    render();

    var tipo = state.followupForm.tipo;
    var data = state.followupForm.data;
    var hora = state.followupForm.hora;
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
    }, token).then(function() {
      // Usa meio-dia UTC para evitar troca de dia por diferença de fuso horário
      var proximo = data + 'T12:00:00.000Z';
      if (!state.current.lead.proximo_followup || proximo < state.current.lead.proximo_followup) {
        return updateLead(state.current.lead.id, { proximo_followup: proximo }, token);
      }
    }).then(function() {
      state.followupForm = { tipo: 'enviar_mensagem', data: '', hora: '', descricao: '' };
      state.ui.saving = false;
      state.ui.tab = 'followup'; // mantém na aba de follow-up após agendar
      state.ui.success = '✓ Follow-up agendado!';
      render();
      // Atualiza o badge imediatamente (nova atividade pode ser "hoje" ou "atrasada")
      if (state.auth) fetchPendingFollowups(state.auth.access_token);
      setTimeout(function() { state.ui.success = ''; render(); }, 3000);
    }).catch(function(err) {
      console.error('[4U CRM] Erro ao criar follow-up:', err);
      state.ui.saving = false;
      if (err && err.isUnauthorized) { handleUnauthorized(); } else { state.ui.error = 'Erro de conexão.'; render(); }
    });
  }

  /* ===== DETECÇÃO E CARREGAMENTO ===== */

  function loadMeta() {
    if (!state.auth) return Promise.resolve();
    return Promise.all([
      getSources(state.auth.access_token),
      getSegments(state.auth.access_token),
      getStatuses(state.auth.access_token),
      loadLeadsCache(state.auth.access_token),
    ]).then(function(results) {
      state.sources = Array.isArray(results[0]) ? results[0] : [];
      state.segments = Array.isArray(results[1]) ? results[1] : [];
      state.statuses = Array.isArray(results[2]) ? results[2] : [];
      console.log('[4U CRM] Meta carregada: ' + state.sources.length + ' origens, ' + state.segments.length + ' segmentos, ' + state.statuses.length + ' statuses.');
    }).catch(function(err) {
      if (err && err.isUnauthorized) { handleUnauthorized(); }
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

        var changed = ['status', 'nome', 'observacao', 'origem_id', 'segmento_id', 'proximo_followup'].some(function (k) {
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
          console.log('[4U CRM] Lead atualizado externamente.');
          state.current.lead = fresh;
          state.form.status      = fresh.status      || 'novo_lead';
          state.form.nome        = fresh.nome        || '';
          state.form.origem_id   = fresh.origem_id   || '';
          state.form.segmento_id = fresh.segmento_id || '';
          state.form.observacao  = fresh.observacao  || '';
          state.form.tags        = freshTags;
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
    getContactFromPageWorld().then(function(contact) {
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
      var name  = contact.name || extractNameFromDom();

      if (!phone) {
        if (state.ui.view !== 'no-contact') {
          state.ui.view = 'no-contact';
          render();
        }
        return;
      }

      if (phone === state.current.phone && (state.ui.view === 'existing-lead' || state.ui.view === 'new-lead')) {
        return;
      }

      console.log('[4U CRM] Contato detectado via page world:', phone, name);
      stopLeadPolling();
      state.visible = true; // auto-exibe quando um chat é aberto
      state.ui.view = 'loading';
      state.ui.error = '';
      state.ui.success = '';
      state.ui.tab = 'dados'; // sempre começa na aba Dados ao trocar de contato
      render();

      var normalPhone = normalizePhone(phone);
      state.current.phone = phone;
      state.current.name  = name;
      state.current.photo = null;

      // Resolve a foto para base64 ANTES de carregar o lead — assim o save
      // (create ou update de foto_url) sempre persiste data URI, nunca URL que expira
      resolvePhotoToDataUri(contact.photo).then(function(photoDataUri) {
        state.current.photo = photoDataUri;
        return getLeadByPhone(normalPhone, state.auth.access_token);
      }).then(function(lead) {
        state.current.lead = lead;

        if (lead) {
          state.form = {
            nome:        lead.nome,
            status:      lead.status,
            origem_id:   lead.origem_id || '',
            segmento_id: lead.segmento_id || '',
            observacao:  lead.observacao || '',
            tags:        Array.isArray(lead.tags) ? lead.tags : [],
          };
          state.ui.view = 'existing-lead';
          console.log('[4U CRM] Lead encontrado:', lead.nome);
          // Atualiza foto_url se ainda não tem e acabamos de capturar uma
          if (state.current.photo && !lead.foto_url) {
            updateLead(lead.id, { foto_url: state.current.photo }, state.auth.access_token)
              .then(function(u) { if (u) state.current.lead.foto_url = u.foto_url || state.current.photo; })
              .catch(function() {});
          }
          startLeadPolling();
        } else {
          stopLeadPolling();
          state.form = { nome: name || '', status: 'novo_lead', origem_id: '', segmento_id: '', observacao: '', tags: [] };
          state.ui.view = 'new-lead';
          console.log('[4U CRM] Contato não cadastrado:', normalPhone);
        }

        render();
      }).catch(function(err) {
        console.error('[4U CRM] Erro ao buscar lead:', err);
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
    setInterval(function() {
      if (state.auth) syncRecentLeads(state.auth.access_token);
    }, 5000);
    setInterval(function() {
      if (state.auth) loadLeadsCache(state.auth.access_token);
    }, 60000);
    setInterval(function() {
      if (state.auth) fetchPendingFollowups(state.auth.access_token);
    }, 300000);
    // Sincroniza statuses/origens/segmentos a cada 30s para refletir mudanças feitas no CRM
    setInterval(function() {
      if (!state.auth) return;
      Promise.all([
        getSources(state.auth.access_token),
        getSegments(state.auth.access_token),
        getStatuses(state.auth.access_token),
      ]).then(function(results) {
        state.sources  = Array.isArray(results[0]) ? results[0] : state.sources;
        state.segments = Array.isArray(results[1]) ? results[1] : state.segments;
        state.statuses = Array.isArray(results[2]) ? results[2] : state.statuses;
      }).catch(function() {});
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
    ]).then(function() {
      console.log('[4U CRM] WhatsApp Web pronto.');
      detectAndLoad();
      ensurePageScript().then(function() {
        injectListBadges();
        var earlyTries = 0;
        var earlyTimer = setInterval(function() {
          earlyTries++;
          injectListBadges();
          if (earlyTries >= 8) clearInterval(earlyTimer);
        }, 1500);
      });
      startPolling();
    });
  }

  function startExtension() {
    // Injeta o sidebar imediatamente
    injectSidebar();

    // Detecta painéis nativos do WhatsApp e cede espaço automaticamente
    watchWhatsAppModals();

    // Escuta atualizações de sessão vindas do session-bridge.js (CRM Web)
    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      var newSession = changes[STORAGE_KEY].newValue;

      if (newSession && newSession.access_token && !state.auth) {
        // Sessão chegou do CRM — inicia automaticamente sem precisar de login
        console.log('[4U CRM] Sessão recebida do CRM — iniciando automaticamente.');
        bootAuthenticated(newSession);
      } else if (!newSession && state.auth) {
        // Usuário fez logout no CRM — espelha aqui
        console.log('[4U CRM] Logout detectado no CRM.');
        handleUnauthorized();
      }
    });

    // Verifica sessão existente no storage
    getSession().then(function(session) {
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

    }).catch(function(err) {
      console.error('[4U CRM] Erro na sessão:', err);
      state.ui.view = 'login';
      render();
    });
  }

  // Inicia assim que o body estiver disponível
  if (document.body) {
    startExtension();
  } else {
    document.addEventListener('DOMContentLoaded', startExtension);
  }

})();
