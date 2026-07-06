/**
 * logger.js — Módulo de logs da extensão For You Connect
 *
 * Script clássico (sem ES modules). Expõe window.crmLogger para uso em
 * content.js (IIFE) e via importScripts() em background.js.
 *
 * Regras:
 *  - Nunca logar conteúdo de conversas ou mensagens do WhatsApp
 *  - Mascarar números de telefone (mostra apenas 4 últimos dígitos)
 *  - DEBUG só enviado se debug_mode === true (lido do Supabase no init)
 *  - Falhas de envio: enfileirar localmente e retentar no init
 *  - Erros no próprio logger não quebram a extensão (try/catch total)
 */

(function (global) {
  'use strict';

  var SUPABASE_URL     = 'https://cimehhzkwgiwgfnkeauo.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbWVoaHprd2dpd2dmbmtlYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Nzk0NTEsImV4cCI6MjA5NzE1NTQ1MX0.lMAp7uK7_H3jRqGksZGVVH72bxyOISIOAefTPAlLxJI';

  var SESSION_KEY = 'crm_4u_session';
  var QUEUE_KEY   = 'crm_logger_queue';
  var DEBUG_KEY   = 'debug_mode';

  /* ---- Utilitários ---- */

  function maskPhone(str) {
    if (typeof str !== 'string') return str;
    // Mascara sequências numéricas de 8+ dígitos, mantendo os 4 últimos
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

  function getUserAgent() {
    try { return navigator.userAgent; } catch (e) { return null; }
  }

  function getCurrentUrl() {
    try { return (typeof location !== 'undefined') ? location.href : null; } catch (e) { return null; }
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

  function getDebugMode(cb) {
    try {
      chrome.storage.local.get([DEBUG_KEY], function (r) {
        cb(r[DEBUG_KEY] === true);
      });
    } catch (e) {
      cb(false);
    }
  }

  /* ---- Fila local ---- */

  function enqueue(entry) {
    try {
      chrome.storage.local.get([QUEUE_KEY], function (r) {
        var queue = Array.isArray(r[QUEUE_KEY]) ? r[QUEUE_KEY] : [];
        queue.push(entry);
        // Limita a 100 entradas para não abusar do storage
        if (queue.length > 100) queue = queue.slice(-100);
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

  /* ---- API pública ---- */

  function log(nivel, acao, mensagem, opts) {
    try {
      var options = opts || {};
      var entry = {
        nivel:           nivel,
        modulo:          options.modulo || 'content.js',
        acao:            maskPhone(String(acao)),
        mensagem:        maskPhone(String(mensagem)),
        erro_tecnico:    options.erro_tecnico ? maskPhone(String(options.erro_tecnico)) : null,
        contexto:        options.contexto ? sanitize(options.contexto) : null,
        versao_extensao: getVersion(),
        navegador:       getUserAgent(),
        url:             getCurrentUrl(),
      };
      sendOrQueue(entry);
    } catch (e) {
      // Nunca quebra a extensão
    }
  }

  var crmLogger = {
    error: function (acao, mensagem, opts) { log('ERROR', acao, mensagem, opts); },
    warn:  function (acao, mensagem, opts) { log('WARN',  acao, mensagem, opts); },
    info:  function (acao, mensagem, opts) { log('INFO',  acao, mensagem, opts); },

    debug: function (acao, mensagem, opts) {
      try {
        getDebugMode(function (active) {
          if (active) log('INFO', acao, '[DEBUG] ' + mensagem, opts);
        });
      } catch (e) { /* nunca quebra */ }
    },

    /**
     * Chame no boot da extensão para:
     *  1) Drenar a fila de logs pendentes
     *  2) Sincronizar debug_mode do Supabase → chrome.storage.local
     */
    init: function () {
      try {
        // 1) Drena fila
        getSession(function (session) {
          if (!session || !session.access_token) return;

          chrome.storage.local.get([QUEUE_KEY], function (r) {
            var queue = Array.isArray(r[QUEUE_KEY]) ? r[QUEUE_KEY] : [];
            if (queue.length === 0) return;

            var remaining = [];
            var sent = 0;
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

          // 2) Sincroniza debug_mode do Supabase
          fetch(SUPABASE_URL + '/rest/v1/profiles?select=debug_mode&limit=1', {
            headers: {
              'apikey':        SUPABASE_ANON_KEY,
              'Authorization': 'Bearer ' + session.access_token,
            },
          }).then(function (res) {
            return res.ok ? res.json() : null;
          }).then(function (data) {
            if (Array.isArray(data) && data.length > 0) {
              chrome.storage.local.set({ [DEBUG_KEY]: data[0].debug_mode === true });
            }
          }).catch(function () { /* ignora — debug_mode permanece como estava */ });
        });
      } catch (e) {
        // Nunca quebra a extensão
      }
    },
  };

  // Expõe como global para uso no IIFE do content.js e no service worker
  if (typeof global !== 'undefined') {
    global.crmLogger = crmLogger;
  }
  // Fallback para window (content script) e self (service worker)
  try { self.crmLogger = crmLogger; } catch (e) {}

  console.log('[Connect CRM] logger.js carregado. crmLogger disponível:', typeof crmLogger === 'object');

}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this));
