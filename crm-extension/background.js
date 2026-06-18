chrome.runtime.onInstalled.addListener(() => {
  console.log('[4U Connect CRM] Extensão instalada.')
})

// Busca a foto de perfil no CDN do WhatsApp (pps.whatsapp.net) e converte para base64.
// Roda aqui no service worker porque o content script é bloqueado pelo CORS do CDN.
// As URLs do CDN expiram (~semanas), por isso a foto é persistida como data URI.
function blobToDataUri(blob) {
  // FileReader não existe em service workers — converte via arrayBuffer + btoa
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf)
    let binary = ''
    const CHUNK = 8192
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
    }
    return 'data:' + (blob.type || 'image/jpeg') + ';base64,' + btoa(binary)
  })
}

var CRM_SESSION_KEY = 'crm_4u_session';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Ponte de sessão: o script do CRM envia a sessão do Supabase para cá
  if (msg && msg.type === 'SYNC_SESSION') {
    if (msg.session && msg.session.access_token) {
      chrome.storage.local.set({ [CRM_SESSION_KEY]: msg.session }, function () {
        sendResponse({ ok: true });
      });
    } else {
      chrome.storage.local.remove([CRM_SESSION_KEY], function () {
        sendResponse({ ok: true });
      });
    }
    return true; // mantém canal aberto para resposta assíncrona
  }

  if (msg && msg.type === 'FETCH_PHOTO' && typeof msg.url === 'string' && /^https:\/\/[a-z0-9.-]+\.whatsapp\.net\//.test(msg.url)) {
    console.log('[4U Connect CRM][foto] Buscando:', msg.url.slice(0, 80))
    fetch(msg.url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(blobToDataUri)
      .then((dataUri) => {
        console.log('[4U Connect CRM][foto] OK,', dataUri.length, 'chars')
        sendResponse({ dataUri })
      })
      .catch((err) => {
        console.warn('[4U Connect CRM][foto] Falha ao buscar foto:', err.message)
        sendResponse({ dataUri: null })
      })
    return true // mantém o canal aberto para resposta assíncrona
  }

})
