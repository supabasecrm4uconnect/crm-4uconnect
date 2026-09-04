(function () {
  'use strict';

  // Chave que o Supabase JS SDK v2 usa para guardar a sessão no localStorage.
  // Formato: sb-<project-ref>-auth-token
  var SUPABASE_KEY = 'sb-cimehhzkwgiwgfnkeauo-auth-token';

  function syncSession() {
    try {
      var raw = localStorage.getItem(SUPABASE_KEY);

      if (!raw) {
        // Sessão removida (logout no CRM) — limpa também no storage da extensão
        chrome.runtime.sendMessage({ type: 'SYNC_SESSION', session: null });
        return;
      }

      var data = JSON.parse(raw);
      if (!data || !data.access_token) return;

      chrome.runtime.sendMessage({
        type: 'SYNC_SESSION',
        session: {
          access_token:  data.access_token,
          refresh_token: data.refresh_token  || null,
          expires_at:    data.expires_at     || null,
          user_id:       (data.user && data.user.id) || null,
          // O BrandingContext do CRM mantém document.title com o appTitle exato.
          // Sincronizar esse valor evita duplicar a regra de título na extensão.
          app_title:     (document.title || '').trim().slice(0, 160) || null,
        },
      });
    } catch (e) {
      // Contexto da extensão invalidado (reload) ou JSON corrompido — ignora silenciosamente
    }
  }

  // Sincroniza imediatamente ao carregar a página do CRM
  syncSession();

  // Detecta login/logout em OUTRAS abas do CRM (storage event só dispara fora da aba que escreveu)
  window.addEventListener('storage', function (e) {
    if (e.key === SUPABASE_KEY) syncSession();
  });

  // Poll periódico para capturar login/logout na MESMA aba (storage event não dispara aqui)
  setInterval(syncSession, 3000);

  // Sincroniza quando o usuário volta para a aba do CRM
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') syncSession();
  });
})();
