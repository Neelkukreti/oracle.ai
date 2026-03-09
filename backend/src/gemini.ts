import { GoogleGenerativeAI } from '@google/generative-ai';
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
  private genAI: GoogleGenerativeAI | null;
  private model: any;
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
    if (!this.mockMode) {
      this.genAI = new GoogleGenerativeAI(config.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: config.model || 'gemini-2.5-flash',
        systemInstruction: this.systemPrompt,
      });
    } else {
      this.genAI = null;
      this.model = null;
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
        this.callbacks.onLog('warn', 'No frame available — answering without screenshot');
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
        ? `${indicatorContext}\n\nUser question: "${question}"\n\nAnalyze the trading chart in the screenshot. Use BOTH the visual chart AND the live indicator data above to give a more accurate answer. Return a JSON object with your analysis.`
        : `User question: "${question}"\n\nAnalyze the trading chart in this screenshot and answer the user's question. Return a JSON object with your analysis.`;

      parts.push({ text: promptText });

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      const text = result.response.text();
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

  private processText(text: string): void {
    let parsedData: any = null;

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
    }

    if (parsedData) {
      const validated = TradingAnalysisSchema.safeParse(parsedData);
      if (validated.success) {
        this.callbacks.onAnalysis(validated.data);
        if (validated.data.speech) {
          this.callbacks.onSpeech(validated.data.speech);
        }
      } else {
        // Schema mismatch — try to use speech-like field
        const speech = parsedData.speech || parsedData.message || parsedData.response;
        if (speech && typeof speech === 'string') {
          this.callbacks.onSpeech(speech);
          const partial: TradingAnalysis = { speech };
          const pv = TradingAnalysisSchema.safeParse(partial);
          if (pv.success) this.callbacks.onAnalysis(pv.data);
        } else {
          this.callbacks.onSpeech(text.slice(0, 300).trim());
        }
        this.callbacks.onLog('warn', `Schema issues: ${JSON.stringify(validated.error.flatten().fieldErrors).slice(0, 200)}`);
      }
    } else {
      // Plain text response — use as speech
      if (text.trim()) {
        this.callbacks.onSpeech(text.trim().slice(0, 500));
      }
    }
  }

  // ============================================================================
  // PROMPTS
  // ============================================================================

  private getSystemPrompt(): string {
    return `You are Oracle, a sharp trading partner sitting next to the user. You speak like a real human trader — casual, direct, confident. Never robotic. Never like you're reading a report.

Your expertise: reading charts in real time, spotting key levels, calling trend direction, flagging risk.

CRITICAL rules for the "speech" field:
- Sound like a real person talking, NOT a written report
- Use natural spoken language: contractions, casual phrasing, first person
- BAD: "Strong bearish momentum with price breaking below short-term moving averages."
- GOOD: "Yeah that's clearly bearish — BTC just broke below 67k with strong selling. I'd wait before touching this."
- BAD: "The instrument displays bullish trend strength on the 4H timeframe."
- GOOD: "Looking bullish on the 4H. Price held 42k support nicely, I'd lean long here."
- Max 2 sentences. No jargon dumps. Speak it out loud in your head first.

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
