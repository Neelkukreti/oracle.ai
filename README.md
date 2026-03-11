# 🔮 Oracle

**AI trading analyst that watches your screen and answers voice questions in real time.**

Share your trading terminal, ask a question out loud, and Oracle tells you what it sees — trend, key levels, and a direct trade call — in under 3 seconds. Switch charts and it adapts instantly.

Built with Gemini 2.5 Flash vision + WebSockets + Next.js.

---

## Demo

> *"Is this a good entry?"*
> Oracle: *"BTC's holding 83,400 with momentum turning up — I'd go long here with a stop below 82,800. Not financial advice."*

---

## Features

- **Screen-aware** — shares your chart via `getDisplayMedia`, Oracle reads the actual ticker and price from the image
- **Voice input** — always-on mic using Web Speech API, no wake word needed
- **Voice output** — ElevenLabs TTS (or browser fallback)
- **Structured analysis** — trend direction, support/resistance levels, buy/sell/wait recommendation with confidence score
- **Floating PiP** — Document Picture-in-Picture overlay so Oracle stays visible while TradingView fills your screen
- **Anti-hallucination** — strict prompt rules: Oracle only states what it can literally read from the screenshot
- **Optional indicators** — plug in TAAPI for live RSI, MACD, EMA, Bollinger Bands enrichment

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + WebSocket (ws) |
| AI | Gemini 2.5 Flash (vision + JSON) |
| TTS | ElevenLabs (optional) / Web Speech API |
| STT | Web Speech API (browser-native) |

---

## Self-hosting

### Prerequisites
- Node.js 18+
- Gemini API key — [get one free](https://aistudio.google.com/app/apikey)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
npm run dev
```

Open `http://localhost:3000`, click **Share Screen**, enable the mic, and ask a question.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `TAAPI_PROXY_URL` | Optional | Your TAAPI proxy endpoint for live indicators |
| `TAAPI_PROXY_KEY` | Optional | TAAPI proxy authentication key |
| `PORT` | Optional | Server port (default: 8080) |
| `LOG_LEVEL` | Optional | `debug` / `info` / `warn` / `error` (default: info) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket URL of your backend |
| `NEXT_PUBLIC_ELEVENLABS_API_KEY` | Optional | ElevenLabs key for premium TTS voice |

---

## Deploy

### Backend — Google Cloud Run

```bash
cd backend
gcloud run deploy oracle-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key_here"
```

### Frontend — Vercel

```bash
cd frontend
vercel --prod
# Set NEXT_PUBLIC_WS_URL=wss://your-cloud-run-url.run.app/ws
```

---

## Project Structure

```
oracle/
├── backend/
│   └── src/
│       ├── server.ts     # WebSocket server + session management
│       ├── gemini.ts     # Gemini client + system prompt + response parsing
│       ├── taapi.ts      # Optional live indicator enrichment
│       └── types.ts      # Zod schemas (TradingAnalysis)
└── frontend/
    ├── app/
    │   └── page.tsx      # Main UI
    ├── components/
    │   ├── ScreenShare.tsx       # Screen capture via getDisplayMedia
    │   ├── AudioVoice.tsx        # Always-on mic with backoff + fallback
    │   ├── AnalysisSidebar.tsx   # Trend, levels, recommendation panel
    │   ├── ChartOverlay.tsx      # Key level highlight boxes on chart
    │   ├── FloatingOracle.tsx    # Document PiP window
    │   └── ConversationLog.tsx   # Voice exchange history
    └── hooks/
        └── useOracle.ts          # WebSocket lifecycle + TTS
```

---

## Reproducible Testing

### Option A — Hosted demo (zero setup)

1. Open **[https://frontend-ebon-iota-49.vercel.app](https://frontend-ebon-iota-49.vercel.app)**
2. Click the **⚙️ Settings** gear icon (top right)
3. Paste your free Gemini API key → [get one here](https://aistudio.google.com/app/apikey) (no billing required)
4. Click **Save**
5. Click **Start Oracle**
6. Click **Share Screen** — share your browser tab, a TradingView chart, or any chart window
7. Ask a question (voice or text): *"What's the trend here?"* or *"Is this a good entry?"*
8. ✅ Analysis panel on the right populates with trend, support/resistance levels, and a buy/sell/wait recommendation. Oracle speaks the answer aloud.

### Option B — Run locally

**1. Start the backend**
```bash
cd backend
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
# → Oracle Backend running on :8080
```

**2. Start the frontend**
```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local already points to ws://localhost:8080/ws by default
npm run dev
# → http://localhost:3000
```

**3. Test end-to-end**
1. Open `http://localhost:3000`
2. Click **Start Oracle**
3. Click **Share Screen** → share a tab with any chart (TradingView, Yahoo Finance, Binance, etc.)
4. Ask a question — type it in the text box or speak it
5. ✅ Within 3 seconds: analysis sidebar updates + Oracle speaks the response

**No trading account needed** — any chart visible on screen works. The text input box (bottom of sidebar) lets you test without a microphone.

---

## License

MIT — free to use, modify, and deploy.
