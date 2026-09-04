/**
 * logger.js — Módulo de logs da extensão Connect CRM
 *
 * Script clássico (sem ES modules). Expõe window.crmLogger para uso em
 * content.js (IIFE) e via importScripts() em background.js.
 *
 * Regras:
 *  - Envia ao Supabase APENAS falhas e alertas reais (ERROR e WARN).
 *  - INFO e DEBUG permanecem estritamente no console local do navegador (zero chamadas de rede/banco).
 *  - Nunca logar conteúdo de conversas ou mensagens do WhatsApp.
 *  - Mascarar números de telefone (mantém apenas 4 últimos dígitos).
 *  - Falhas de rede: enfileira localmente e retenta na próxima inicialização.
 *  - Erros no próprio logger nunca quebram a extensão (try/catch defensivo).
 */

(function (global) {
  'use strict';

  var SUPABASE_URL     = 'https://cimehhzkwgiwgfnkeauo.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWVoaHprd2dpd2dmbmtlYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Nzk0NTEsImV4cCI6MjA5NzE1NTQ1MX0.lMAp7uK7_H3jRqGksZGVVH72bxyOISIOAefTPAlLxJI';

  var SESSION_KEY = 'crm_4u_session';
  var QUEUE_KEY   = 'crm_logger_queue';

  /* ---- Utilitários ---- */

  function maskPhone(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\d{4,}(\d{4})/g, '*****$1');
  }

  function sanitize(obj) {
    try {
      return JSON.parse(maskPhone(JSON.stringify(obj)));
    } catch (e) {
      return obj;
    }
  }

  function getVersion() {
    try { return chrome.runtime.getManifest().version; } catch (e) { return null; }
  }

  function getBrowserName() {
    try {
      var ua = navigator.userAgent;
      if (!ua) return 'Desconhecido';
      if (ua.indexOf('Edg/') !== -1) return 'Edge';
      if (ua.indexOf('Chrome/') !== -1) return 'Chrome';
      if (ua.indexOf('Firefox/') !== -1) return 'Firefox';
      if (ua.indexOf('Safari/') !== -1) return 'Safari';
      if (ua.indexOf('OPR/') !== -1) return 'Opera';
      return 'Outro';
    } catch (e) {
      return 'Desconhecido';
    }
  }

  /* ---- Sessão ---- */

  function getSession(cb) {
    try {
      chrome.storage.local.get([SESSION_KEY], function (r) {
        cb(r[SESSION_KEY] || null);
      });
    } catch (e) {
      cb(null);
    }
  }

  /* ---- Fila local para retentativa ---- */

  function enqueue(entry) {
    try {
      chrome.storage.local.get([QUEUE_KEY], function (r) {
        var queue = Array.isArray(r[QUEUE_KEY]) ? r[QUEUE_KEY] : [];
        queue.push(entry);
        if (queue.length > 50) queue = queue.slice(-50);
        chrome.storage.local.set({ [QUEUE_KEY]: queue });
      });
    } catch (e) {
      // Storage indisponível — descarta silenciosamente
    }
  }

  /* ---- Envio ao Supabase ---- */

  function postLog(entry, token) {
    return fetch(SUPABASE_URL + '/rest/v1/extension_logs', {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(entry),
    });
  }

  function sendOrQueue(entry) {
    try {
      getSession(function (session) {
        if (!session || !session.access_token) {
          enqueue(entry);
          return;
        }
        var payload = Object.assign({}, entry, { user_id: session.user_id });
        postLog(payload, session.access_token).then(function (res) {
          if (!res.ok && res.status !== 201) {
            console.warn('[Connect CRM] Falha ao enviar log (' + res.status + '), enfileirado:', entry.acao);
            enqueue(entry);
          }
        }).catch(function (err) {
          console.warn('[Connect CRM] Erro ao enviar log, enfileirado:', err && err.message);
          enqueue(entry);
        });
      });
    } catch (e) {
      // Nunca quebra a extensão
    }
  }

  /* ---- API pública do Logger ---- */

  var crmLogger = {
    error: function (acao, mensagem, opts) {
      try {
        var options = opts || {};
        console.error('[Connect CRM][' + acao + ']', mensagem, options.erro_tecnico || '');
        var entry = {
          nivel:           'ERROR',
          modulo:          options.modulo || 'content.js',
          acao:            maskPhone(String(acao)),
          mensagem:        maskPhone(String(mensagem)),
          erro_tecnico:    options.erro_tecnico ? maskPhone(String(options.erro_tecnico)) : null,
          contexto:        options.contexto ? sanitize(options.contexto) : null,
          versao_extensao: getVersion(),
          navegador:       getBrowserName(),
          url:             'https://web.whatsapp.com/',
        };
        sendOrQueue(entry);
      } catch (e) {}
    },

    warn: function (acao, mensagem, opts) {
      try {
        var options = opts || {};
        console.warn('[Connect CRM][' + acao + ']', mensagem);
        var entry = {
          nivel:           'WARN',
          modulo:          options.modulo || 'content.js',
          acao:            maskPhone(String(acao)),
          mensagem:        maskPhone(String(mensagem)),
          erro_tecnico:    options.erro_tecnico ? maskPhone(String(options.erro_tecnico)) : null,
          contexto:        options.contexto ? sanitize(options.contexto) : null,
          versao_extensao: getVersion(),
          navegador:       getBrowserName(),
          url:             'https://web.whatsapp.com/',
        };
        sendOrQueue(entry);
      } catch (e) {}
    },

    // INFO e DEBUG ficam estritamente locais no console (não gastam banco nem rede)
    info: function (acao, mensagem, opts) {
      try {
        console.log('[Connect CRM][' + acao + ']', mensagem, opts ? opts : '');
      } catch (e) {}
    },

    debug: function (acao, mensagem, opts) {
      try {
        console.debug('[Connect CRM:DEBUG][' + acao + ']', mensagem, opts ? opts : '');
      } catch (e) {}
    },

    /**
     * Drena a fila local de erros pendentes quando a extensão inicializa e há sessão ativa.
     */
    init: function () {
      try {
        getSession(function (session) {
          if (!session || !session.access_token) return;

          chrome.storage.local.get([QUEUE_KEY], function (r) {
            var queue = Array.isArray(r[QUEUE_KEY]) ? r[QUEUE_KEY] : [];
            if (queue.length === 0) return;

            var remaining = [];
            function next(i) {
              if (i >= queue.length) {
                chrome.storage.local.set({ [QUEUE_KEY]: remaining });
                return;
              }
              var entry = Object.assign({}, queue[i], { user_id: session.user_id });
              postLog(entry, session.access_token).then(function (res) {
                if (!res.ok && res.status !== 201) remaining.push(queue[i]);
                next(i + 1);
              }).catch(function () {
                remaining.push(queue[i]);
                next(i + 1);
              });
            }
            next(0);
          });
        });
      } catch (e) {
        // Silencioso
      }
    },
  };

  // Expõe como global para uso no IIFE do content.js e no service worker
  if (typeof global !== 'undefined') {
    global.crmLogger = crmLogger;
  }
  try { self.crmLogger = crmLogger; } catch (e) {}

  console.log('[Connect CRM] logger.js carregado (modo enxuto).');

}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this));
