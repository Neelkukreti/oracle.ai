import { z } from 'zod';

// ============================================================================
// TRADING ANALYSIS SCHEMA
// ============================================================================

// Highlight box (normalized coordinates 0..1)
export const HighlightSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  label: z.string().min(1).max(100),
});

export type Highlight = z.infer<typeof HighlightSchema>;

export const TradingAnalysisSchema = z.object({
  analysis: z.object({
    instrument: z.string(),
    timeframe: z.string(),
    trend: z.enum(['bullish', 'bearish', 'sideways']),
    trendStrength: z.enum(['strong', 'moderate', 'weak']),
    bias: z.string(),
  }).optional(),
  levels: z.object({
    resistance: z.array(z.number()),
    support: z.array(z.number()),
    keyLevel: z.number().optional(),
  }).optional(),
  recommendation: z.object({
    action: z.enum(['buy', 'sell', 'wait', 'hold']),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    invalidation: z.string(),
  }).optional(),
  risk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    notes: z.string(),
  }).optional(),
  highlights: z.array(HighlightSchema).max(10).optional(),
  speech: z.string(),
});

export type TradingAnalysis = z.infer<typeof TradingAnalysisSchema>;

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

// Client → Server
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('audio_chunk'),
    data: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('frame'),
    data: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('start'),
    sessionId: z.string(),
    geminiApiKey: z.string().optional(),
  }),
  z.object({
    type: z.literal('stop'),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('heartbeat'),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('question'),
    text: z.string(),
    timestamp: z.number(),
    symbol: z.string().optional(),   // e.g. "BTC/USDT"
    interval: z.string().optional(), // e.g. "4h"
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server → Client
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('audio_chunk'),
    data: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('analysis'),
    data: TradingAnalysisSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('status'),
    status: z.enum(['connected', 'disconnected', 'error', 'ready']),
    message: z.string().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('log'),
    level: z.enum(['debug', 'info', 'warn', 'error']),
    message: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('speech_text'),
    text: z.string(),
    timestamp: z.number(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ============================================================================
// SESSION STATE
// ============================================================================

export interface SessionState {
  id: string;
  startTime: number;
  lastFrameTime: number;
  lastAudioTime: number;
  frameCount: number;
  audioChunkCount: number;
  geminiSessionActive: boolean;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateTradingAnalysis(data: unknown): TradingAnalysis {
  return TradingAnalysisSchema.parse(data);
}

export function validateClientMessage(data: unknown): ClientMessage {
  return ClientMessageSchema.parse(data);
}
