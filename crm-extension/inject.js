// Roda no mundo da página — aqui __reactFiber* é visível nos elementos DOM
(function () {
  'use strict';

  // ── HELPER: extrai telefone de um objeto chat do React fiber ────────────────
  function extractPhoneFromChat(chat) {
    if (!chat) return null;
    var chatId = chat.id || chat.__x_id;
    // Grupos e broadcasts — ignora
    if (typeof chatId === 'string' && (chatId.includes('@g.us') || chatId.includes('@broadcast'))) return null;

    var c = chat.contact || {};
    var phone = null;

    // Caso 1: formattedTitle é o número (contato não salvo na agenda)
    if (chat.formattedTitle) {
      var cleaned = String(chat.formattedTitle).replace(/[\s\-\(\)\+]/g, '');
      if (/^\d{10,15}$/.test(cleaned)) phone = cleaned;
    }

    // Caso 2: número nos campos do contact
    if (!phone) {
      var phoneFields = ['__x_phoneNumber', 'phoneNumber', 'formattedPhone', 'numberPhone', 'phone', 'displayPhone'];
      for (var pf = 0; pf < phoneFields.length; pf++) {
        var rawPhone = c[phoneFields[pf]];
        if (!rawPhone) continue;
        var phoneStr = (typeof rawPhone === 'object' && rawPhone.user) ? String(rawPhone.user) : String(rawPhone);
        var pCleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
        if (/^\d{10,15}$/.test(pCleaned)) { phone = pCleaned; break; }
      }
    }

    // Caso 3: extrai direto do JID (chatId = "551199999@c.us" ou objeto {user})
    if (!phone) {
      var jidUser = null;
      if (typeof chatId === 'string' && chatId.includes('@c.us')) jidUser = chatId.split('@')[0];
      else if (chatId && typeof chatId === 'object' && chatId.user) jidUser = String(chatId.user);
      if (jidUser && /^\d{10,15}$/.test(jidUser)) phone = jidUser;
    }

    return phone;
  }

  // ── HELPER: fontes de foto aceitas ───────────────────────────────────────
  function isUsablePhotoSrc(src) {
    return typeof src === 'string' && (
      src.startsWith('data:image') ||
      src.startsWith('blob:') ||
      /^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//.test(src)  // pps.whatsapp.net e outros subdomínios do CDN
    );
  }

  // blob: URLs só são acessíveis dentro da página — converte para data URI aqui
  function blobUrlToDataUri(url) {
    return fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onloadend = function () { resolve(reader.result); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  }

  // ── HELPER: encontra o fiberKey de um elemento ───────────────────────────
  function getFiberKey(el) {
    try {
      var keys = Object.keys(el);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('__reactFiber') || keys[i].startsWith('__reactInternalInstance')) return keys[i];
      }
    } catch (e) {}
    return null;
  }

  // ── CHAT HEADER (conversa aberta) ────────────────────────────────────────
  function getContactData() {
    try {
      var header = document.querySelector('#main header');
      if (!header) return null;

      var fiberKey = getFiberKey(header);
      if (!fiberKey) return null;

      var node = header[fiberKey];
      for (var d = 0; d < 15; d++) {
        node = node && node.return;
        if (!node) break;

        var props = node.memoizedProps;
        if (!props || !props.chat) continue;

        var chat = props.chat;
        var chatId = chat.id || chat.__x_id;
        if (typeof chatId === 'string' && (chatId.includes('@g.us') || chatId.includes('@broadcast'))) {
          return { isGroup: true, phone: null, name: null };
        }

        var phone = extractPhoneFromChat(chat);
        var c = chat.contact || {};
        var name = null;

        if (chat.formattedTitle) {
          var ftCleaned = String(chat.formattedTitle).replace(/[\s\-\(\)\+]/g, '');
          if (!/^\d{10,15}$/.test(ftCleaned)) name = String(chat.formattedTitle);
        }
        if (!name) {
          name = c.pushname || c.name || c.formattedName || c.verifiedName || c.businessName || c.shortName || chat.name || null;
        }

        var photo = null;
        try {
          // O CDN do WhatsApp serve avatares como https://pps.whatsapp.net/... ou blob:
          // (base64 direto é raro). A conversão para data URI acontece depois.
          var thumbFields = ['__x_profilePicThumbObj', 'profilePicThumbObj'];
          var srcFields = ['eurl', '__x_eurl', 'img', '__x_img', 'imgFull', '__x_imgFull'];
          for (var tf = 0; tf < thumbFields.length && !photo; tf++) {
            var thumbObj = c[thumbFields[tf]];
            if (!thumbObj || typeof thumbObj !== 'object') continue;
            for (var sf = 0; sf < srcFields.length; sf++) {
              if (isUsablePhotoSrc(thumbObj[srcFields[sf]])) { photo = thumbObj[srcFields[sf]]; break; }
            }
          }
          if (!photo) {
            var headerImgs = document.querySelectorAll('#main header img');
            var dbgSrcs = [];
            for (var hi = 0; hi < headerImgs.length; hi++) {
              dbgSrcs.push((headerImgs[hi].src || '').slice(0, 60));
              if (isUsablePhotoSrc(headerImgs[hi].src)) { photo = headerImgs[hi].src; break; }
            }
            if (!photo) {
              console.log('[4U CRM][foto] Nenhuma fonte aceita. thumbObj presente:',
                !!(c.profilePicThumbObj || c.__x_profilePicThumbObj),
                '| imgs no header:', dbgSrcs.length ? dbgSrcs : '(nenhuma)');
            }
          }
          if (photo) console.log('[4U CRM][foto] Fonte encontrada:', photo.slice(0, 60) + '...');
        } catch (photoErr) {}

        return { isGroup: false, phone: phone, name: name, photo: photo };
      }
    } catch (e) {}
    return null;
  }

  // ── LISTA DE CONVERSAS: lê telefone de cada linha ───────────────────────

  // Extrai telefone a partir de um elemento que tem fiber React (lista de conversas).
  // Usa fiber walk primeiro (mais confiável para contatos salvos) e cai para text node
  // (funciona para contatos não salvos onde o título já é o número).
  function getPhoneFromEl(el) {
    // Fiber walk — obj chat está tipicamente 30-60 níveis acima a partir de list-item-N
    try {
      var fiberKey = getFiberKey(el);
      if (fiberKey) {
        var node = el[fiberKey];
        for (var d = 0; d < 80; d++) {
          node = node && node.return;
          if (!node) break;
          var props = node.memoizedProps;
          if (props && props.chat) return extractPhoneFromChat(props.chat);
        }
      }
    } catch (fe) {}

    // span[dir="auto"] dentro do cell-frame-title — tem o número/nome puro no atributo title,
    // sem ícones concatenados (ex: ic-label-filled que polui o textContent)
    try {
      var titleEl = el.querySelector('[data-testid="cell-frame-title"]');
      if (titleEl) {
        var nameSpan = titleEl.querySelector('span[dir="auto"]');
        var text = nameSpan
          ? ((nameSpan.getAttribute('title') || nameSpan.textContent || '').trim())
          : (titleEl.textContent || '').trim();
        var cleaned = text.replace(/[\s\-\(\)\+]/g, '');
        if (/^\d{10,15}$/.test(cleaned)) return cleaned;
      }
    } catch (te) {}

    return null;
  }

  function annotateChatRows() {
    var count = 0;
    try {
      // list-item-N é o componente React real de cada linha — 4 níveis DOM acima de
      // cell-frame-container, o que significa que props.chat fica 30-50 níveis fiber
      // mais próximo, resolvendo o problema de só aparecer após clicar num chat.
      var listItems = document.querySelectorAll('[data-testid^="list-item-"]');
      if (listItems.length > 0) {
        for (var r = 0; r < listItems.length; r++) {
          var phone = getPhoneFromEl(listItems[r]);
          if (phone) {
            var container = listItems[r].querySelector('[data-testid="cell-frame-container"]');
            if (container) { container.setAttribute('data-crm-phone', phone); count++; }
          }
        }
      } else {
        // Fallback: WhatsApp pode ter mudado a estrutura — tenta direto em cell-frame-container
        var rows = document.querySelectorAll('[data-testid="cell-frame-container"]');
        for (var rr = 0; rr < rows.length; rr++) {
          var phone2 = getPhoneFromEl(rows[rr]);
          if (phone2) { rows[rr].setAttribute('data-crm-phone', phone2); count++; }
        }
      }
    } catch (e) {}
    return count;
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'crm4u_cs') return;

    if (e.data.type === 'GET_PHONE') {
      var result = getContactData();
      var sendResult = function (photo) {
        window.postMessage({
          source:  'crm4u_inject',
          type:    'PHONE_RESULT',
          phone:   result ? result.phone   : null,
          name:    result ? result.name    : null,
          isGroup: !!(result && result.isGroup),
          photo:   photo || null,
        }, '*');
      };
      var rawPhoto = result ? result.photo : null;
      if (rawPhoto && rawPhoto.indexOf('blob:') === 0) {
        // blob: não é acessível fora da página — converte para base64 antes de enviar
        blobUrlToDataUri(rawPhoto).then(sendResult);
      } else {
        sendResult(rawPhoto);
      }
    }

    if (e.data.type === 'ANNOTATE_CHATS') {
      var n = annotateChatRows();
      window.postMessage({ source: 'crm4u_inject', type: 'ANNOTATE_CHATS_DONE', count: n }, '*');
    }
  });
})();
