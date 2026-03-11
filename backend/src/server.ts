import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientMessage,
  ServerMessage,
  SessionState,
  TradingAnalysis,
  validateClientMessage,
} from './types.js';
import { GeminiLiveClient, GeminiCallbacks } from './gemini.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
app.get('/', (req, res) => res.json({ name: 'Oracle Backend', status: 'running' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, SessionState>();
const geminiClients = new Map<string, GeminiLiveClient>();

wss.on('connection', (ws: WebSocket) => {
  const sessionId = uuidv4();
  log('info', `New connection: ${sessionId}`);

  const session: SessionState = {
    id: sessionId,
    startTime: Date.now(),
    lastFrameTime: 0,
    lastAudioTime: 0,
    frameCount: 0,
    audioChunkCount: 0,
    geminiSessionActive: false,
  };
  sessions.set(sessionId, session);

  sendMessage(ws, { type: 'status', status: 'connected', message: 'Oracle ready', timestamp: Date.now() });

  // ── Gemini callbacks ────────────────────────────────────────────────────────

  const geminiCallbacks: GeminiCallbacks = {
    onAnalysis: (analysis: TradingAnalysis) =>
      sendMessage(ws, { type: 'analysis', data: analysis, timestamp: Date.now() }),

    onSpeech: (text: string) =>
      sendMessage(ws, { type: 'speech_text', text, timestamp: Date.now() }),

    onError: (error: Error) => {
      log('error', `Gemini error: ${error.message}`);
      sendMessage(ws, { type: 'status', status: 'error', message: error.message, timestamp: Date.now() });
    },

    onLog: (level, message) => {
      log(level, message);
      if (level === 'error' || level === 'warn') {
        sendMessage(ws, { type: 'log', level, message, timestamp: Date.now() });
      }
    },
  };

  // ── Message handler ─────────────────────────────────────────────────────────

  ws.on('message', async (data: Buffer) => {
    try {
      const validated = validateClientMessage(JSON.parse(data.toString()));
      await handleClientMessage(validated);
    } catch (error) {
      log('error', `Invalid message: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  });

  async function handleClientMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'start':     return handleStart(message.geminiApiKey);
      case 'stop':      return handleStop();
      case 'frame':     return handleFrame(message.data, message.width, message.height, message.timestamp);
      case 'question':  return handleQuestion(message.text, message.symbol, message.interval);
      case 'audio_chunk':
        session.audioChunkCount++;
        return; // audio transcription done client-side via Web Speech API
      case 'heartbeat':
        sendMessage(ws, { type: 'status', status: 'ready', timestamp: Date.now() });
        return;
    }
  }

  async function handleStart(geminiApiKey?: string): Promise<void> {
    const apiKey = geminiApiKey || GEMINI_API_KEY;
    log('info', `Starting Oracle session for ${sessionId}`);
    if (!apiKey) {
      sendMessage(ws, { type: 'status', status: 'error', message: 'Gemini API key required — enter it in Settings', timestamp: Date.now() });
      return;
    }
    try {
      const client = new GeminiLiveClient({ apiKey }, geminiCallbacks);
      await client.start();
      geminiClients.set(sessionId, client);
      session.geminiSessionActive = true;
      sendMessage(ws, { type: 'status', status: 'ready', message: 'Oracle started', timestamp: Date.now() });
    } catch (error) {
      log('error', `Start failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      sendMessage(ws, { type: 'status', status: 'error', message: 'Failed to start Oracle', timestamp: Date.now() });
    }
  }

  async function handleStop(): Promise<void> {
    log('info', `Stopping session ${sessionId}`);
    const client = geminiClients.get(sessionId);
    if (client) { await client.stop(); geminiClients.delete(sessionId); }
    session.geminiSessionActive = false;
    sendMessage(ws, { type: 'status', status: 'disconnected', message: 'Oracle stopped', timestamp: Date.now() });
  }

  async function handleFrame(data: string, width: number, height: number, timestamp: number): Promise<void> {
    const client = geminiClients.get(sessionId);
    if (!client || !session.geminiSessionActive) return;
    session.frameCount++;
    session.lastFrameTime = timestamp;
    // Store latest frame — Gemini is called only when user asks a question
    client.storeFrame(data, width, height);
  }

  async function handleQuestion(text: string, symbol?: string, interval?: string): Promise<void> {
    const client = geminiClients.get(sessionId);
    if (!client || !session.geminiSessionActive) {
      sendMessage(ws, { type: 'status', status: 'error', message: 'Click "Start Oracle" first', timestamp: Date.now() });
      return;
    }
    await client.sendQuestion(text, symbol, interval);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  ws.on('close', async () => {
    log('info', `Disconnected: ${sessionId}`);
    const client = geminiClients.get(sessionId);
    if (client) { await client.stop(); geminiClients.delete(sessionId); }
    sessions.delete(sessionId);
  });

  ws.on('error', (error) => log('error', `WS error: ${error.message}`));
});

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const current = levels[LOG_LEVEL as keyof typeof levels] ?? 1;
  if (levels[level] >= current) {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
  }
}

server.listen(PORT, () => {
  console.log(`\n🔮 Oracle Backend running on :${PORT}\n   WS: ws://localhost:${PORT}/ws\n`);
});

process.on('SIGTERM', async () => {
  for (const [id, client] of geminiClients) { await client.stop(); }
  server.close(() => process.exit(0));
});
