chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled:       false,
    sourceLang:    'auto',
    targetLang:    'en',
    displayMode:   'translated',
    chunkInterval: 3000,
    backendUrl:    'http://localhost:3000'
  });
  console.log('[SubtitleX] Installed ✓');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TRANSCRIBE') {
    handleTranscribe(msg).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function handleTranscribe({ audioBase64, mimeType, sourceLang, targetLang, backendUrl }) {
  try {
    const byteChars = atob(audioBase64);
    const byteArr   = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArr], { type: mimeType || 'audio/webm' });
    const form = new FormData();
    form.append('audio',      blob, 'chunk.webm');
    form.append('sourceLang', sourceLang);
    form.append('targetLang', targetLang);
    const res = await fetch(`${backendUrl}/transcribe`, {
      method: 'POST',
      body:   form
    });
    if (!res.ok) {
      const txt = await res.text();
      return { error: `Server error ${res.status}: ${txt}` };
    }
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}
