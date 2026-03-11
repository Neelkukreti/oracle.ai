// Frontend types mirroring backend schemas

export interface Highlight {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface TradingAnalysis {
  analysis?: {
    instrument: string;
    timeframe: string;
    trend: 'bullish' | 'bearish' | 'sideways';
    trendStrength: 'strong' | 'moderate' | 'weak';
    bias: string;
  };
  levels?: {
    resistance: number[];
    support: number[];
    keyLevel?: number;
  };
  recommendation?: {
    action: 'buy' | 'sell' | 'wait' | 'hold';
    confidence: number;
    reason: string;
    invalidation: string;
  };
  risk?: {
    level: 'low' | 'medium' | 'high';
    notes: string;
  };
  highlights?: Highlight[];
  speech: string;
}

// WebSocket messages
export type ClientMessage =
  | { type: 'audio_chunk'; data: string; timestamp: number }
  | { type: 'frame'; data: string; width: number; height: number; timestamp: number }
  | { type: 'start'; sessionId: string; geminiApiKey?: string }
  | { type: 'stop'; sessionId: string }
  | { type: 'heartbeat'; timestamp: number }
  | { type: 'question'; text: string; timestamp: number; symbol?: string; interval?: string };

export type ServerMessage =
  | { type: 'audio_chunk'; data: string; timestamp: number }
  | { type: 'analysis'; data: TradingAnalysis; timestamp: number }
  | { type: 'status'; status: 'connected' | 'disconnected' | 'error' | 'ready'; message?: string; timestamp: number }
  | { type: 'log'; level: string; message: string; timestamp: number }
  | { type: 'speech_text'; text: string; timestamp: number };
