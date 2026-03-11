import { GoogleGenAI } from '@google/genai';
import { TradingAnalysis, TradingAnalysisSchema } from './types.js';
import { fetchIndicators, buildIndicatorContext } from './taapi.js';

// ============================================================================
// GEMINI ORACLE CLIENT
// ============================================================================

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface GeminiCallbacks {
  onAnalysis: (analysis: TradingAnalysis) => void;
  onSpeech: (text: string) => void;
  onError: (error: Error) => void;
  onLog: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

export class GeminiLiveClient {
  private genAI: GoogleGenAI | null;
  private modelId: string;
  private callbacks: GeminiCallbacks;
  private isActive = false;
  private mockMode: boolean;
  private latestFrameData: string | null = null;
  private latestFrameWidth = 0;
  private latestFrameHeight = 0;
  private readonly systemPrompt: string;

  constructor(config: GeminiConfig, callbacks: GeminiCallbacks) {
    this.mockMode = !config.apiKey;
    this.callbacks = callbacks;
    this.systemPrompt = this.getSystemPrompt();
    this.modelId = config.model || 'gemini-2.5-flash';
    if (!this.mockMode) {
      this.genAI = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      this.genAI = null;
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async start(): Promise<void> {
    if (this.isActive) return;
    if (this.mockMode) {
      this.callbacks.onLog('info', 'Starting MOCK session (no Gemini key)');
      this.isActive = true;
      return;
    }
    this.callbacks.onLog('info', 'Oracle session started');
    this.isActive = true;
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;
    this.callbacks.onLog('info', 'Stopping Gemini Oracle session');
    this.isActive = false;
    this.latestFrameData = null;
  }

  isSessionActive(): boolean {
    return this.isActive;
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  async sendAudioChunk(_audioData: string, _timestamp: number): Promise<void> {
    // Audio transcription handled by browser Web Speech API — no-op here
  }

  storeFrame(frameData: string, width: number, height: number): void {
    this.latestFrameData = frameData;
    this.latestFrameWidth = width;
    this.latestFrameHeight = height;
  }

  async sendFrame(
    frameData: string,
    width: number,
    height: number,
    _timestamp: number
  ): Promise<void> {
    if (!this.isActive) return;
    this.storeFrame(frameData, width, height);
  }

  // Called when a user question arrives — send question + latest frame to Gemini
  async sendQuestion(question: string, symbol?: string, interval?: string): Promise<void> {
    if (!this.isActive) {
      this.callbacks.onLog('warn', 'Cannot answer: session not active');
      return;
    }

    if (this.mockMode) {
      this.callbacks.onLog('info', `MOCK: answering "${question}"`);
      this.callbacks.onSpeech(`Mock Oracle: I see a bullish trend. ${question} — looks like a good setup.`);
      return;
    }

    try {
      this.callbacks.onLog('info', `Sending question to Gemini: "${question}"`);

      const parts: any[] = [];

      if (this.latestFrameData) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: this.latestFrameData },
        });
        this.callbacks.onLog('info', `Frame attached (${this.latestFrameWidth}x${this.latestFrameHeight})`);
      } else {
        this.callbacks.onLog('warn', 'No frame available — cannot analyze chart');
        this.callbacks.onSpeech("I can't see your screen yet. Click Share Screen to let me analyze your chart.");
        return;
      }

      // Optionally enrich with live TAAPI indicators
      let indicatorContext = '';
      if (symbol && interval) {
        try {
          const ind = await fetchIndicators(symbol, interval);
          indicatorContext = buildIndicatorContext(symbol, interval, ind);
          if (indicatorContext) this.callbacks.onLog('info', `TAAPI enrichment: ${indicatorContext.slice(0, 120)}`);
        } catch (e) {
          this.callbacks.onLog('warn', `TAAPI fetch skipped: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const promptText = indicatorContext
        ? `User question: "${question}"

Look at the screenshot. Identify the ticker symbol and current price DIRECTLY from what is printed on the chart — do not assume or guess.

Supplementary indicator data (only use if the symbol matches what you see on screen — otherwise ignore):
${indicatorContext}

For the "speech" field: speak only about what you can literally see in the screenshot. Mention the actual ticker and price you read from the chart. Return a JSON object.`
        : `User question: "${question}"\n\nLook at the screenshot. Read the ticker symbol and price directly from the chart — do not guess. Speak only about what you can see. Return a JSON object.`;

      parts.push({ text: promptText });

      const result = await this.genAI!.models.generateContent({
        model: this.modelId,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: this.systemPrompt,
          temperature: 0.5,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const text = result.text ?? '';
      this.callbacks.onLog('info', `Gemini response (${text.length} chars): ${text.substring(0, 300)}`);
      this.processText(text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.callbacks.onLog('error', `Question error: ${msg}`);
      this.callbacks.onError(new Error(msg));
    }
  }

  // ============================================================================
  // RESPONSE PROCESSING
  // ============================================================================

  // Strip any JSON fragments, markdown, or report-like phrasing that would sound bad when spoken
  private sanitizeSpeech(raw: string): string {
    let s = raw.trim();
    // Drop anything that looks like leaked JSON
    if (s.startsWith('{') || s.startsWith('"analysis') || s.startsWith('"instrument')) return '';
    // Strip markdown bold/italic
    s = s.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
    // Strip backticks
    s = s.replace(/`([^`]+)`/g, '$1');
    // Collapse multiple spaces
    s = s.replace(/\s{2,}/g, ' ').trim();
    // Hard cap at 300 chars — traders want short responses
    return s.slice(0, 300);
  }

  private processText(text: string): void {
    let parsedData: any = null;
    let speechSent = false;

    const speak = (raw: string) => {
      const clean = this.sanitizeSpeech(raw);
      if (clean) { this.callbacks.onSpeech(clean); speechSent = true; }
    };

    // 1. Direct JSON parse
    try {
      parsedData = JSON.parse(text.trim());
    } catch (e1) {
      this.callbacks.onLog('info', `Direct parse failed, trying fallbacks: ${e1 instanceof Error ? e1.message : String(e1)}`);

      // 2. Try markdown fences
      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try { parsedData = JSON.parse(jsonMatch[1]); } catch {}
      }

      // 3. Extract outermost { ... }
      if (!parsedData) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
          try { parsedData = JSON.parse(text.slice(start, end + 1)); } catch {}
        }
      }

      // 4. Partial/truncated JSON — regex-extract speech field directly
      //    (Gemini sometimes truncates JSON; speech is always near the top)
      if (!parsedData && !speechSent) {
        const speechMatch = text.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (speechMatch) {
          const extracted = speechMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
          speak(extracted);
          this.callbacks.onLog('info', 'Extracted speech from truncated JSON');
        }
      }
    }

    if (parsedData) {
      const validated = TradingAnalysisSchema.safeParse(parsedData);
      if (validated.success) {
        this.callbacks.onAnalysis(validated.data);
        if (validated.data.speech) speak(validated.data.speech);
      } else {
        // Schema mismatch — extract speech field only; never speak raw JSON
        const speech = parsedData.speech || parsedData.message || parsedData.response;
        if (speech && typeof speech === 'string') {
          speak(speech);
          const pv = TradingAnalysisSchema.safeParse({ ...parsedData, speech });
          if (pv.success) this.callbacks.onAnalysis(pv.data);
        }
        this.callbacks.onLog('warn', `Schema issues: ${JSON.stringify(validated.error.flatten().fieldErrors).slice(0, 200)}`);
      }
    } else {
      // Plain text — only speak if it doesn't look like JSON
      const trimmed = text.trim();
      if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('"')) {
        speak(trimmed);
      } else if (trimmed) {
        this.callbacks.onLog('warn', 'Unparseable JSON-like response, skipping speech');
      }
    }

    // Safety net: always fire onSpeech so the frontend never stays stuck
    if (!speechSent) {
      this.callbacks.onSpeech('Analysis complete — check the panel for details.');
    }
  }

  // ============================================================================
  // PROMPTS
  // ============================================================================

  private getSystemPrompt(): string {
    return `You are Oracle, a real-time chart analyst. You only describe what you can literally see in the screenshot — never guess, never invent.

ABSOLUTE RULES — violating these is a critical failure:
- NEVER state a price, level, ticker, or indicator value you cannot directly read from the chart image
- NEVER hallucinate. If you cannot clearly see something, say "I can't read that clearly" instead of guessing
- The ticker symbol and price MUST come from what's printed on the chart — not from any context or assumption
- If the chart is unclear or partially visible, say so honestly

SPEECH style rules:
- Sound like a real trader talking, not a written report
- Use contractions, first person, casual phrasing — max 2 sentences
- NEVER repeat information from a previous response — each answer must be fresh
- If asked for a trade direction (long/short, buy/sell), give a DEFINITIVE answer — say exactly what you'd do and why, then add "not financial advice" at the end
- GOOD: "I'd go long here — BTC is holding 66,250 with momentum turning up. Stop below 65,800. Not financial advice."
- GOOD: "ETH is sitting right at 2,020 and looks like it's building for a move. I'd watch that 2,000 level as the key support."
- BAD: "The instrument shows bullish momentum with RSI at 57." (never read back indicator numbers)
- BAD: Hedging with "I'd wait for more confirmation" when the user explicitly asked for a trade call

Output format — respond with a SINGLE JSON object:
{
  "speech": "What you'd say out loud to a trader friend — natural, conversational, 1-2 sentences",
  "analysis": {
    "instrument": "BTC/USD",
    "timeframe": "4H",
    "trend": "bullish",
    "trendStrength": "moderate",
    "bias": "Brief bias description"
  },
  "levels": {
    "resistance": [45000, 47500],
    "support": [42000, 40000],
    "keyLevel": 42000
  },
  "recommendation": {
    "action": "buy",
    "confidence": 0.72,
    "reason": "Bullish flag breakout with volume",
    "invalidation": "Close below 42,000"
  },
  "risk": {
    "level": "medium",
    "notes": "RSI at 62, approaching overbought"
  },
  "highlights": [
    {"x": 0.1, "y": 0.3, "w": 0.15, "h": 0.04, "label": "Support 42k"}
  ]
}

trend must be "bullish", "bearish", or "sideways".
trendStrength must be "strong", "moderate", or "weak".
recommendation.action must be "buy", "sell", "wait", or "hold".
risk.level must be "low", "medium", or "high".
All highlight coordinates are normalized 0..1 relative to frame dimensions.
The "speech" field is REQUIRED in every response.`;
  }
}
