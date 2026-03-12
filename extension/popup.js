const $ = id => document.getElementById(id);

const BACKEND_URL = 'http://localhost:3000'; // change this when deploying

async function load() {
  const d = await chrome.storage.local.get(
    ['enabled','sourceLang','targetLang','displayMode','chunkInterval']
  );
  $('enabledToggle').checked = d.enabled      ?? false;
  $('sourceLang').value      = d.sourceLang   ?? 'ja';
  $('targetLang').value      = d.targetLang   ?? 'en';
  $('displayMode').value     = d.displayMode  ?? 'translated';

  const interval = d.chunkInterval ?? 3000;
  $('chunkRange').value     = interval;
  $('chunkVal').textContent = (interval / 1000) + 's';
}

$('chunkRange').addEventListener('input', () => {
  $('chunkVal').textContent = ($('chunkRange').value / 1000) + 's';
});

$('saveBtn').addEventListener('click', async () => {
  const settings = {
    enabled:       $('enabledToggle').checked,
    sourceLang:    $('sourceLang').value,
    targetLang:    $('targetLang').value,
    displayMode:   $('displayMode').value,
    chunkInterval: parseInt($('chunkRange').value),
    backendUrl:    BACKEND_URL
  };

  await chrome.storage.local.set(settings);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings }).catch(() => {});

  $('saveBtn').textContent = '✓ Saved!';
  setTimeout(() => { $('saveBtn').textContent = 'Save Settings'; }, 1800);
});

$('testBtn').addEventListener('click', async () => {
  $('testBtn').textContent = 'Testing…';
  $('warn').classList.remove('show');
  try {
    const res  = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      $('testBtn').textContent = `✓ Connected — Groq:${data.groq?'✓':'✗'} Lingo:${data.lingo?'✓':'✗'}`;
      $('warn').classList.remove('show');
    } else throw new Error();
  } catch {
    $('testBtn').textContent = '✗ Failed';
    $('warn').classList.add('show');
  }
  setTimeout(() => { $('testBtn').textContent = 'Test Connection'; }, 3000);
});

async function refreshStatus() {
  const dot = $('dot');
  const txt = $('statusTxt');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, res => {
      if (chrome.runtime.lastError || !res) {
        dot.className = 'dot'; txt.textContent = 'no video'; return;
      }
      if (res.capturing) {
        dot.className = 'dot run';
        txt.textContent = `${res.sourceLang}→${res.targetLang}`;
      } else if (res.hasVideo) {
        dot.className = 'dot on'; txt.textContent = 'video found';
      } else {
        dot.className = 'dot'; txt.textContent = 'no video';
      }
    });
  } catch (_) {}
}

load();
refreshStatus();
