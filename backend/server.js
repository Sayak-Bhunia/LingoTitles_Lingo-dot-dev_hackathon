'use strict';

require('dotenv').config();

const express  = require('express');
const multer  = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { LingoDotDevEngine } = require('lingo.dev/sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const lingo = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY
});

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 25 * 1024 * 1024 }
});

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    groq:   !!process.env.GROQ_API_KEY,
    lingo:  !!process.env.LINGODOTDEV_API_KEY,
    time:   new Date().toISOString()
  });
});


app.post('/transcribe', upload.single('audio'), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    const sourceLang = (req.body.sourceLang || 'auto').trim();
    const targetLang = (req.body.targetLang || 'en').trim();
    console.log(`▶  /transcribe  src=${sourceLang} → tgt=${targetLang}  size=${req.file.size}B`);
    const original = await groqTranscribe(tempPath, sourceLang);
    if (!original || !original.trim()) {
      return res.json({ original: '', translated: '' });
    }
    console.log(`   Groq Whisper → "${original}"`);
    let translated = original;
    if (sourceLang !== targetLang) {
      translated = await lingoTranslate(original, sourceLang, targetLang);
      console.log(`   Lingo.dev    → "${translated}"`);
    }
    res.json({
      original:   original.trim(),
      translated: translated.trim()
    });
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempPath) {
      fs.unlink(tempPath, () => {});
    }
  }
});

async function groqTranscribe(filePath, sourceLang) {
  const webmPath = filePath + '.webm';
  try {
    fs.copyFileSync(filePath, webmPath);
    const stats = fs.statSync(webmPath);
    console.log(`   webm copy: ${stats.size}B at ${webmPath}`);
    const response = await groq.audio.transcriptions.create({
      file:            fs.createReadStream(webmPath),
      model:           'whisper-large-v3-turbo',
      language:        sourceLang === 'auto' ? undefined : sourceLang,
      response_format: 'text',
      temperature:     0
    });
    return (typeof response === 'string' ? response : response?.text ?? '').trim();
  } finally {
    try { fs.unlinkSync(webmPath); } catch(_) {}
  }
}

const LOCALE_MAP = {
  ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', es: 'es-ES', fr: 'fr-FR',
  de: 'de-DE', ar: 'ar-SA', fa: 'fa-IR', vi: 'vi-VN', tr: 'tr-TR',
  pt: 'pt-BR', ru: 'ru-RU', hi: 'hi-IN', id: 'id-ID', th: 'th-TH',
  en: 'en-US', it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE',
  uk: 'uk-UA', cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU', el: 'el-GR',
  he: 'he-IL', bn: 'bn-BD', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN',
  kn: 'kn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-PK', ms: 'ms-MY',
  tl: 'tl-PH', sw: 'sw-KE'
};

function toLocale(code) {
  if (!code || code === 'auto') return null;
  if (code.includes('-')) return code;
  return LOCALE_MAP[code.toLowerCase()] || code;
}

async function lingoTranslate(text, sourceLang, targetLang) {
  const src = toLocale(sourceLang);
  const tgt = toLocale(targetLang);
  const options = { targetLocale: tgt };
  if (src) options.sourceLocale = src;
  const result = await lingo.localizeText(text, options);
  return result ?? text;
}

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`\n🌍 SubtitleX Backend — http://localhost:${PORT}`);
  console.log(`   Groq Whisper: ${process.env.GROQ_API_KEY       ? '✓ free & ready' : '✗ missing GROQ_API_KEY'}`);
  console.log(`   Lingo.dev:   ${process.env.LINGODOTDEV_API_KEY ? '✓ free & ready' : '✗ missing LINGODOTDEV_API_KEY'}`);
  console.log(`\n   💰 Cost: $0.00 — both APIs are free`);
  console.log(`   🌐 Languages: 99 supported + auto-detect`);
  console.log(`   🎬 anime • breaking news • foreign reels • any video\n`);
});
