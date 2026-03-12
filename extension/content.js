(function () {
  'use strict';

  console.log('[SubtitleX] content.js loaded ✓');

  let cfg = {
    enabled:       false,
    sourceLang:    'auto',
    targetLang:    'en',
    displayMode:   'translated',
    chunkInterval: 3000,
    backendUrl:    'http://localhost:3000'
  };

  let audioCtx     = null;
  let recorder     = null;
  let isCapturing  = false;
  let currentVideo = null;
  let subtitleEl   = null;
  let chunkTimer   = null;
  let audioChunks  = [];

  chrome.storage.local.get(
    ['enabled','sourceLang','targetLang','displayMode','chunkInterval','backendUrl'],
    data => {
      Object.assign(cfg, data);
      console.log('[SubtitleX] Settings loaded, enabled:', cfg.enabled);
      if (cfg.enabled) init();
    }
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'UPDATE_SETTINGS') {
      const wasEnabled = cfg.enabled;
      Object.assign(cfg, msg.settings);
      if (cfg.enabled && !isCapturing) init();
      if (!cfg.enabled && wasEnabled) teardown();
    }
    if (msg.type === 'GET_STATUS') {
      sendResponse({
        hasVideo:   !!document.querySelector('video'),
        capturing:  isCapturing,
        sourceLang: cfg.sourceLang,
        targetLang: cfg.targetLang
      });
    }
  });

  function bestVideo() {
    return [...document.querySelectorAll('video')]
      .filter(v => v.duration > 0 || v.readyState >= 2)
      .sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0] || null;
  }

  function init() {
    const v = bestVideo();
    if (v) { attach(v); return; }

    const poll = setInterval(() => {
      const v = bestVideo();
      if (v) { clearInterval(poll); attach(v); }
    }, 1000);
    setTimeout(() => clearInterval(poll), 60000);
  }

  function attach(video) {
    if (isCapturing) return;
    console.log('[SubtitleX] Attaching to video');
    currentVideo = video;
    buildOverlay();
    startCapture(video);
  }

  function buildOverlay() {
    if (subtitleEl) subtitleEl.remove();
    subtitleEl = document.createElement('div');
    subtitleEl.className = 'subtitlex-overlay';
    document.body.appendChild(subtitleEl);
    console.log('[SubtitleX] Overlay created');
  }

  function showSubtitles(original, translated) {
    if (!subtitleEl) return;
    subtitleEl.innerHTML = '';

    if (cfg.displayMode === 'dual' && original) {
      const o = document.createElement('div');
      o.className = 'subtitlex-original';
      o.textContent = original;
      subtitleEl.appendChild(o);
    }

    const text = cfg.displayMode === 'original' ? original : (translated || original);
    if (text) {
      const t = document.createElement('div');
      t.className = 'subtitlex-text';
      t.textContent = text;
      subtitleEl.appendChild(t);
    }

    subtitleEl.classList.add('subtitlex-visible');
    clearTimeout(subtitleEl._timer);
    subtitleEl._timer = setTimeout(
      () => subtitleEl && subtitleEl.classList.remove('subtitlex-visible'),
      Math.max(cfg.chunkInterval * 1.5, 3500)
    );
  }

  function startCapture(video) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src  = audioCtx.createMediaElementSource(video);
      src.connect(audioCtx.destination);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      beginRecording(dest.stream);
      console.log('[SubtitleX] Direct audio capture started');
    } catch (err) {
      console.warn('[SubtitleX] Direct capture failed:', err.message, '— trying mic');
      micFallback();
    }
  }

  async function micFallback() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      beginRecording(stream);
      console.log('[SubtitleX] Mic fallback started');
    } catch (e) {
      console.error('[SubtitleX] All capture methods failed:', e.message);
    }
  }

  function beginRecording(stream) {
    const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/ogg']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';

    recorder    = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    audioChunks = [];

    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    recorder.onstop = () => {
      if (!audioChunks.length) return;

      const totalSize = audioChunks.reduce((s, c) => s + c.size, 0);
      if (totalSize < 1000) {
        audioChunks = [];
        if (isCapturing) setTimeout(() => { try { recorder.start(); } catch(_){} }, 100);
        return;
      }

      const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      audioChunks = [];
      sendChunk(blob);

      if (isCapturing) {
        setTimeout(() => { try { recorder.start(); } catch(_){} }, 100);
      }
    };

    recorder.start();
    isCapturing = true;

    chunkTimer = setInterval(() => {
      if (isCapturing && recorder && recorder.state === 'recording') {
        try { recorder.stop(); } catch(_) {}
      }
    }, cfg.chunkInterval);
  }

  async function sendChunk(blob) {
    if (currentVideo && currentVideo.paused) return;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes       = new Uint8Array(arrayBuffer);
      let binary        = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const audioBase64 = btoa(binary);

      console.log('[SubtitleX] Sending chunk via background, size:', blob.size);

      chrome.runtime.sendMessage({
        type:       'TRANSCRIBE',
        audioBase64,
        mimeType:   blob.type,
        sourceLang: cfg.sourceLang,
        targetLang: cfg.targetLang,
        backendUrl: cfg.backendUrl
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('[SubtitleX] Message error:', chrome.runtime.lastError.message);
          return;
        }
        if (!response || response.error) {
          console.warn('[SubtitleX] Backend error:', response?.error);
          return;
        }
        console.log('[SubtitleX] Got subtitle:', response.original, '→', response.translated);
        if (response.original && response.original.trim()) {
          showSubtitles(response.original.trim(), response.translated?.trim());
        }
      });
    } catch (err) {
      console.error('[SubtitleX] sendChunk error:', err.message);
    }
  }

  function teardown() {
    isCapturing = false;
    clearInterval(chunkTimer);
    if (recorder && recorder.state !== 'inactive') try { recorder.stop(); } catch(_) {}
    if (audioCtx) try { audioCtx.close(); } catch(_) {}
    recorder = null; audioCtx = null;
    if (subtitleEl) subtitleEl.classList.remove('subtitlex-visible');
  }

})();
