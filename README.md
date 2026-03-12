# LingoTitles - Real-Time AI Subtitles for Any Video

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/691d0c87-2082-4492-99d0-6f5a63dfea4e" />

[![Demo Video](https://img.youtube.com/vi/DEMO_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=DEMO_VIDEO_ID)

**Demo:** In case the app is not working, you can watch the demo video above to see how LingoTitles works.

LingoTitles is a Chrome extension that generates real-time AI-powered subtitles for any video on the internet. It captures the video audio, transcribes it using Groq's Whisper model, translates it using Lingo.dev, and overlays the subtitles directly on the video — all in under 2 seconds, completely free.

---

## Technologies Used

### Chrome Extension
- **Manifest V3** - Latest Chrome extension architecture
- **Web Audio API** - Captures video audio stream directly (no microphone needed)
- **Content Script** - Detects video elements and renders subtitle overlay
- **Background Service Worker** - Proxies API calls to bypass Chrome's localhost restrictions

### Backend
- **Node.js + Express** - REST API server
- **Groq Whisper Large V3 Turbo** - Free, ultra-fast speech-to-text (~300ms)
- **Lingo.dev** - AI-powered real-time translation (free)
- **Multer** - Audio file handling

---

## File Structure

```
lingodev2/
├── backend/
│   ├── server.js           # Express server — Groq + Lingo.dev handler
│   ├── package.json
│   ├── .env                # API keys (never commit this)
│   └── uploads/            # Temporary audio storage (auto-cleaned)
└── extension/
    ├── manifest.json        # Chrome MV3 manifest
    ├── background.js        # Service worker — proxies fetch to backend
    ├── content.js           # Audio capture + subtitle overlay
    ├── subtitles.css        # Subtitle styling
    ├── popup.html           # Extension popup UI
    ├── popup.js             # Popup logic
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---

## How to Clone and Run Locally

### Prerequisites
- Node.js 18+ installed
- Chrome browser
- Groq API key — free at [console.groq.com](https://console.groq.com)
- Lingo.dev API key — free at [lingo.dev](https://lingo.dev)

### Step 1 — Clone the repo
```bash
git clone https://github.com/YOURUSERNAME/lingotitles.git
cd lingotitles
```

### Step 2 — Set up the backend
```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
```env
GROQ_API_KEY=your_groq_api_key
LINGODOTDEV_API_KEY=your_lingo_api_key
```

Start the server:
```bash
npm start
```

You should see:
```
🌍 SubtitleX Backend — http://localhost:3000
   Groq Whisper: ✓ free & ready
   Lingo.dev:   ✓ free & ready
```

### Step 3 — Load the extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The LingoTitles icon will appear in your toolbar

### Step 4 — Use it
1. Open any video page (YouTube, news site, reels, etc.)
2. Click the LingoTitles extension icon
3. Select source language and target language
4. Click **Save Settings**
5. Subtitles will appear on the video within 2 seconds

---

## Architecture

> Architecture diagram coming soon.

---

## Current Features

- **Any Video** — works on YouTube, news sites, and other third-party video streaming platforms
- **35+ Languages** — Japanese, Bengali, Marathi, Tamil, Hindi, Arabic, Spanish and more — manually select source and target language
- **Dual Mode** — show translated only, original only, or both
- **Adjustable chunk interval** — 1.5s for fast reels, 3s for anime/news, 5s for slow speech
- **Zero cost** — Groq and Lingo.dev are both free tiers
- **No login required** — just API keys in your backend `.env`

---

## Future Scope

- **Subtitle styling** — font size, color, position customization
- **Word-by-word streaming** — WebSocket architecture for near real-time subtitles
- **Mobile companion app** — iOS and Android support
- **Offline mode** — on-device Whisper model for privacy

---

## Problems I Solved

| Problem | Fix |
|---|---|
| Chrome blocks content scripts from calling localhost | Routed all fetch calls through background service worker |
| Groq rejects files without extensions | Copy upload to `.webm` before sending |
| Lingo.dev rejects short locale codes like `ja` | Built a locale map converting `ja` → `ja-JP` |
| Subtitles not visible on YouTube | Used `position: fixed` with max `z-index` |
| Audio chunks too small to transcribe | Added minimum size guard — skip if under 1000 bytes |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for Whisper transcription |
| `LINGODOTDEV_API_KEY` | Yes | Lingo.dev API key for translation |
