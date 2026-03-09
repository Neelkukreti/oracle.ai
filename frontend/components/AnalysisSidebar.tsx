'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  ChevronRight,
  Loader2,
  Target,
  ExternalLink,
} from 'lucide-react';
import { TradingAnalysis } from '@/lib/types';
import { ConversationEntry } from '@/hooks/useOracle';
import { IndicatorData } from '@/hooks/useIndicators';

// ─── Observation types ─────────────────────────────────────────────────────────

interface Observation {
  id: string;
  text: string;
  tag: 'bullish' | 'bearish' | 'neutral' | 'warning';
  ts: number;
}

function makeObs(text: string, tag: Observation['tag']): Observation {
  return { id: `${Date.now()}-${Math.random()}`, text, tag, ts: Date.now() };
}

const OBS_TAG_STYLES: Record<Observation['tag'], string> = {
  bullish: 'text-oracle-green border-oracle-green/30 bg-oracle-green/6',
  bearish: 'text-oracle-red border-oracle-red/30 bg-oracle-red/6',
  neutral: 'text-oracle-blue border-oracle-blue/30 bg-oracle-blue/6',
  warning: 'text-oracle-yellow border-oracle-yellow/30 bg-oracle-yellow/6',
};

interface AnalysisSidebarProps {
  analysis: TradingAnalysis | null;
  conversation: ConversationEntry[];
  isSessionActive: boolean;
  latestSpeech: string | null;
  isThinking: boolean;
  indicators?: IndicatorData;
  symbol?: string;
  interval?: string;
  indLoading?: boolean;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const ACTION_STYLES = {
  buy: {
    headerBg: 'bg-oracle-green',
    headerText: 'text-black',
    border: 'border-oracle-green/60',
    bar: 'bg-oracle-green',
    label: 'BUY',
  },
  sell: {
    headerBg: 'bg-oracle-red',
    headerText: 'text-white',
    border: 'border-oracle-red/60',
    bar: 'bg-oracle-red',
    label: 'SELL',
  },
  wait: {
    headerBg: 'bg-oracle-yellow',
    headerText: 'text-black',
    border: 'border-oracle-yellow/60',
    bar: 'bg-oracle-yellow',
    label: 'WAIT',
  },
  hold: {
    headerBg: 'bg-oracle-blue',
    headerText: 'text-white',
    border: 'border-oracle-blue/60',
    bar: 'bg-oracle-blue',
    label: 'HOLD',
  },
} as const;

const TREND_STYLES = {
  bullish: {
    color: 'text-oracle-green',
    bg: 'bg-oracle-green/8',
    border: 'border-oracle-green/20',
    label: 'BULLISH',
    Icon: TrendingUp,
  },
  bearish: {
    color: 'text-oracle-red',
    bg: 'bg-oracle-red/8',
    border: 'border-oracle-red/20',
    label: 'BEARISH',
    Icon: TrendingDown,
  },
  sideways: {
    color: 'text-oracle-yellow',
    bg: 'bg-oracle-yellow/8',
    border: 'border-oracle-yellow/20',
    label: 'RANGING',
    Icon: Minus,
  },
} as const;

const RISK_COLORS = {
  low: { color: 'text-oracle-green', fill: 'bg-oracle-green', segs: 1, label: 'LOW' },
  medium: { color: 'text-oracle-yellow', fill: 'bg-oracle-yellow', segs: 2, label: 'MEDIUM' },
  high: { color: 'text-oracle-red', fill: 'bg-oracle-red', segs: 3, label: 'HIGH' },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Helper: extract first number from an invalidation string ─────────────────

function extractNumber(text: string): number | null {
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalysisSidebar({
  analysis,
  conversation,
  isSessionActive,
  latestSpeech,
  isThinking,
  indicators = {},
  symbol = 'BTC/USDT',
  interval = '4h',
  indLoading = false,
}: AnalysisSidebarProps) {
  const action = analysis?.recommendation?.action;
  const actionStyle = action ? ACTION_STYLES[action] : null;
  const trend = analysis?.analysis?.trend;
  const trendStyle = trend ? TREND_STYLES[trend] : null;
  const riskLevel = analysis?.risk?.level;
  const riskStyle = riskLevel ? RISK_COLORS[riskLevel] : null;

  // ── Oracle Observations feed ──────────────────────────────────────────────
  const [observations, setObservations] = useState<Observation[]>([]);
  const prevAnalysisRef = useRef<TradingAnalysis | null>(null);
  const prevIndicatorsRef = useRef<IndicatorData>({});

  useEffect(() => {
    if (!analysis || analysis === prevAnalysisRef.current) return;
    prevAnalysisRef.current = analysis;
    const newObs: Observation[] = [];

    if (analysis.analysis) {
      const { trend: t, trendStrength, instrument, timeframe } = analysis.analysis;
      const tag = t === 'bullish' ? 'bullish' : t === 'bearish' ? 'bearish' : 'neutral';
      newObs.push(makeObs(
        `${instrument} ${trendStrength} ${t} bias on ${timeframe}`,
        tag,
      ));
    }
    if (analysis.recommendation) {
      const { action: a, confidence } = analysis.recommendation;
      const tag = a === 'buy' ? 'bullish' : a === 'sell' ? 'bearish' : 'neutral';
      newObs.push(makeObs(
        `${a.toUpperCase()} signal — ${Math.round(confidence * 100)}% confidence`,
        tag,
      ));
    }
    if (analysis.levels) {
      const { resistance, support, keyLevel } = analysis.levels;
      if (keyLevel) newObs.push(makeObs(`Key level: ${formatPrice(keyLevel)}`, 'warning'));
      if (resistance.length > 0) newObs.push(makeObs(`Resistance: ${resistance.map(formatPrice).join(' · ')}`, 'bearish'));
      if (support.length > 0)    newObs.push(makeObs(`Support: ${support.map(formatPrice).join(' · ')}`, 'bullish'));
    }
    if (analysis.risk) {
      const tag = analysis.risk.level === 'high' ? 'warning' : analysis.risk.level === 'low' ? 'bullish' : 'neutral';
      newObs.push(makeObs(`Risk ${analysis.risk.level.toUpperCase()}: ${analysis.risk.notes}`, tag));
    }

    if (newObs.length > 0) {
      setObservations((prev) => [...newObs, ...prev].slice(0, 20));
    }
  }, [analysis]);

  useEffect(() => {
    if (!isSessionActive || JSON.stringify(indicators) === JSON.stringify(prevIndicatorsRef.current)) return;
    prevIndicatorsRef.current = indicators;
    const newObs: Observation[] = [];

    if (indicators.rsi !== undefined) {
      const rsi = indicators.rsi;
      const tag = rsi > 70 ? 'warning' : rsi < 30 ? 'bullish' : 'neutral';
      const label = rsi > 70 ? 'overbought zone' : rsi < 30 ? 'oversold zone' : 'neutral';
      newObs.push(makeObs(`RSI ${rsi.toFixed(1)} — ${label}`, tag));
    }
    if (indicators.macd) {
      const h = indicators.macd.histogram;
      newObs.push(makeObs(
        `MACD histogram ${h > 0 ? 'positive' : 'negative'} (${h > 0 ? '+' : ''}${h.toFixed(3)})`,
        h > 0 ? 'bullish' : 'bearish',
      ));
    }
    if (indicators.ema20 !== undefined && indicators.ema200 !== undefined) {
      const cross = indicators.ema20 > indicators.ema200 ? 'Golden Cross' : 'Death Cross';
      newObs.push(makeObs(`${cross} — EMA20 ${indicators.ema20 > indicators.ema200 ? 'above' : 'below'} EMA200`, indicators.ema20 > indicators.ema200 ? 'bullish' : 'bearish'));
    }
    if (indicators.bb) {
      const bw = (((indicators.bb.upper - indicators.bb.lower) / indicators.bb.middle) * 100).toFixed(1);
      newObs.push(makeObs(`Bollinger Band width: ${bw}% — ${parseFloat(bw) < 3 ? 'squeeze (breakout risk)' : parseFloat(bw) > 8 ? 'high volatility' : 'moderate range'}`, 'neutral'));
    }

    if (newObs.length > 0) {
      setObservations((prev) => [...newObs, ...prev].slice(0, 20));
    }
  }, [indicators, isSessionActive]);

  // Clear observations when session stops
  useEffect(() => {
    if (!isSessionActive) setObservations([]);
  }, [isSessionActive]);

  // ── Simulate Trade calculation ────────────────────────────────────────────
  const simulateTrade = (() => {
    if (!analysis?.recommendation || !analysis.levels) return null;
    const { action: a, invalidation } = analysis.recommendation;
    if (a !== 'buy' && a !== 'sell') return null;

    const stopNum = extractNumber(invalidation);
    const entry = analysis.levels.keyLevel
      ?? (a === 'buy' ? analysis.levels.support[0] : analysis.levels.resistance[0]);
    const target = a === 'buy'
      ? analysis.levels.resistance[0]
      : analysis.levels.support[0];

    if (!entry || !target) return null;

    let rr: string | null = null;
    if (stopNum && entry !== stopNum) {
      const risk = Math.abs(entry - stopNum);
      const reward = Math.abs(target - entry);
      rr = (reward / risk).toFixed(1);
    }

    return { entry, stop: stopNum, target, rr, action: a };
  })();

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sidebar header ─── */}
      <div className="shrink-0 px-4 py-3 border-b border-oracle-border flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-white/45 uppercase tracking-widest">
          Live Analysis
        </span>

        <div className="flex items-center gap-2">
          {/* TradingView link */}
          {(() => {
            const tvSymbol = symbol.replace('/', '');
            const tvUrl = `https://www.tradingview.com/chart/?symbol=BINANCE:${tvSymbol}&interval=${
              interval === '15m' ? '15' : interval === '1h' ? '60' : interval === '4h' ? '240' : 'D'
            }`;
            return (
              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`View ${symbol} on TradingView`}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/35 hover:text-oracle-green/70 hover:border-oracle-green/25 transition-all text-[9px] font-mono tracking-wider"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                TV
              </a>
            );
          })()}

          {isSessionActive && (
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  isThinking ? 'bg-oracle-blue' : analysis ? 'bg-oracle-green' : 'bg-white/20'
                }`}
              />
              <span
                className={`text-[10px] font-mono tracking-widest ${
                  isThinking
                    ? 'text-oracle-blue'
                    : analysis
                    ? 'text-oracle-green'
                    : 'text-white/25'
                }`}
              >
                {isThinking ? 'THINKING' : analysis ? 'LIVE' : 'WAITING'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Empty — no session */}
        {!isSessionActive && !analysis && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/12 flex items-center justify-center">
              <Activity className="w-7 h-7 text-white/30" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/55">Awaiting signal</p>
              <p className="text-xs text-white/40 mt-1.5 leading-relaxed max-w-[180px] mx-auto">
                Share your chart and start Oracle to see live analysis here
              </p>
            </div>
          </div>
        )}

        {/* Session active, no analysis yet */}
        {isSessionActive && !analysis && !isThinking && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-14 h-14 rounded-2xl bg-oracle-green/8 border border-oracle-green/20 flex items-center justify-center"
            >
              <Activity className="w-7 h-7 text-oracle-green/60" />
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-white/70">Oracle is watching</p>
              <p className="text-xs text-white/45 mt-1 leading-relaxed max-w-[180px] mx-auto">
                Ask a question or speak to get instant analysis
              </p>
            </div>
            {/* Sample chips */}
            <div className="flex flex-col gap-1.5 w-full mt-1">
              {['Analyze this chart', 'What do you see?'].map((hint) => (
                <div
                  key={hint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/6 border border-white/12 text-white/55 text-xs font-mono"
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {hint}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thinking state */}
        {isThinking && !analysis && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="text-4xl select-none"
            >
              🔮
            </motion.div>
            <p className="text-xs font-mono text-oracle-green/60 tracking-widest">
              Reading chart...
            </p>
          </div>
        )}

        {/* ─── ANALYSIS CONTENT ─── */}
        <AnimatePresence mode="wait">
          {analysis && (
            <motion.div
              key="analysis-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {/* ── 1. TRADE SIGNAL CARD (dominant) ── */}
              {analysis.recommendation && actionStyle && (
                <motion.div
                  key={action}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-xl border-2 ${actionStyle.border} overflow-hidden bg-black/30`}
                >
                  {/* Coloured header */}
                  <div
                    className={`${actionStyle.headerBg} px-4 py-3 flex items-center justify-between`}
                  >
                    <span
                      className={`text-2xl font-bold font-mono tracking-widest leading-none ${actionStyle.headerText}`}
                    >
                      {actionStyle.label}
                    </span>
                    {analysis.analysis && (
                      <div className={`text-right ${actionStyle.headerText}`}>
                        <p className="text-xs font-mono font-bold opacity-90 leading-none">
                          {analysis.analysis.instrument}
                        </p>
                        <p className="text-[10px] font-mono opacity-60 mt-0.5">
                          {analysis.analysis.timeframe}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Confidence */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-white/60 uppercase tracking-wider">
                          Confidence
                        </span>
                        <span className="text-sm font-bold font-mono text-white">
                          {Math.round(analysis.recommendation.confidence * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.recommendation.confidence * 100}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                          className={`h-full rounded-full ${actionStyle.bar}`}
                        />
                      </div>
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-white/65 leading-relaxed">
                      {analysis.recommendation.reason}
                    </p>

                    {/* Invalidation */}
                    <div className="flex items-start gap-2 pt-2 border-t border-white/8">
                      <AlertTriangle className="w-3 h-3 text-oracle-red/45 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-mono text-white/60 leading-snug">
                        Stop: {analysis.recommendation.invalidation}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── 2. MARKET BIAS ── */}
              {analysis.analysis && trendStyle && (
                <div
                  className={`rounded-lg border ${trendStyle.border} ${trendStyle.bg} px-3 py-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <trendStyle.Icon className={`w-4 h-4 ${trendStyle.color}`} />
                      <span className={`text-sm font-bold font-mono ${trendStyle.color}`}>
                        {trendStyle.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/55 capitalize">
                      {analysis.analysis.trendStrength}
                    </span>
                  </div>
                  {analysis.analysis.bias && (
                    <p className="mt-2 text-xs text-white/75 leading-relaxed">
                      {analysis.analysis.bias}
                    </p>
                  )}
                </div>
              )}

              {/* ── 3. KEY LEVELS ── */}
              {analysis.levels &&
                (analysis.levels.resistance.length > 0 ||
                  analysis.levels.support.length > 0) && (
                  <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-3 space-y-3">
                    <Label>Key Levels</Label>

                    {analysis.levels.resistance.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono text-oracle-red/55 uppercase tracking-wider mb-1.5">
                          Resistance
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.levels.resistance.map((r, i) => (
                            <span
                              key={i}
                              className={`font-mono text-xs px-2.5 py-1 rounded-md bg-oracle-red/10 text-oracle-red border border-oracle-red/20 ${
                                r === analysis.levels?.keyLevel
                                  ? 'ring-1 ring-oracle-red/50 font-bold'
                                  : ''
                              }`}
                            >
                              {formatPrice(r)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.levels.support.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono text-oracle-green/55 uppercase tracking-wider mb-1.5">
                          Support
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.levels.support.map((s, i) => (
                            <span
                              key={i}
                              className={`font-mono text-xs px-2.5 py-1 rounded-md bg-oracle-green/10 text-oracle-green border border-oracle-green/20 ${
                                s === analysis.levels?.keyLevel
                                  ? 'ring-1 ring-oracle-green/50 font-bold'
                                  : ''
                              }`}
                            >
                              {formatPrice(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* ── 4. SIMULATE TRADE ── */}
              {simulateTrade && (
                <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <Label>Simulate Trade</Label>
                    <Target className="w-3.5 h-3.5 text-white/30 mb-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'ENTRY', value: formatPrice(simulateTrade.entry), color: 'text-white/80' },
                      { label: 'STOP', value: simulateTrade.stop ? formatPrice(simulateTrade.stop) : '—', color: 'text-oracle-red/75' },
                      { label: 'TARGET', value: formatPrice(simulateTrade.target), color: 'text-oracle-green/75' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-black/25 rounded-lg p-2 text-center">
                        <p className="text-[8px] font-mono text-white/35 tracking-widest">{label}</p>
                        <p className={`text-[11px] font-mono font-semibold mt-0.5 ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {simulateTrade.rr && (
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/8">
                      <span className="text-[10px] font-mono text-white/45">Risk : Reward</span>
                      <span className={`text-xs font-bold font-mono ${
                        parseFloat(simulateTrade.rr) >= 2 ? 'text-oracle-green' :
                        parseFloat(simulateTrade.rr) >= 1 ? 'text-oracle-yellow' : 'text-oracle-red'
                      }`}>1 : {simulateTrade.rr}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── 5. RISK ── */}
              {analysis.risk && riskStyle && (
                <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Risk</Label>
                    <span className={`text-xs font-bold font-mono ${riskStyle.color}`}>
                      {riskStyle.label}
                    </span>
                  </div>
                  <div className="flex gap-1 mb-2.5">
                    {[1, 2, 3].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          seg <= riskStyle.segs ? riskStyle.fill : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  {analysis.risk.notes && (
                    <p className="text-[11px] text-white/65 leading-relaxed">
                      {analysis.risk.notes}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 6. ORACLE OBSERVATIONS ── */}
        {observations.length > 0 && (
          <div className="space-y-2 pt-1">
            <Label>Oracle Observations</Label>
            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-none">
              <AnimatePresence initial={false}>
                {observations.slice(0, 8).map((obs) => (
                  <motion.div
                    key={obs.id}
                    initial={{ opacity: 0, x: -6, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono ${OBS_TAG_STYLES[obs.tag]}`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-70" />
                    <span className="leading-snug flex-1 min-w-0 truncate">{obs.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── 5. LIVE INDICATORS ── */}
        {isSessionActive && (Object.keys(indicators).length > 0 || indLoading) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label>Live Indicators</Label>
              {indLoading && <Loader2 className="w-3 h-3 text-white/30 animate-spin mb-2" />}
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-mono text-white/45 mb-1">{symbol} · {interval}</p>

              {indicators.rsi !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/60">RSI(14)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          indicators.rsi > 70 ? 'bg-oracle-red' : indicators.rsi < 30 ? 'bg-oracle-green' : 'bg-oracle-blue'
                        }`}
                        style={{ width: `${indicators.rsi}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold font-mono ${
                      indicators.rsi > 70 ? 'text-oracle-red' : indicators.rsi < 30 ? 'text-oracle-green' : 'text-white/70'
                    }`}>
                      {indicators.rsi.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {indicators.macd && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/60">MACD</span>
                  <span className={`text-xs font-mono font-bold ${
                    indicators.macd.histogram > 0 ? 'text-oracle-green' : 'text-oracle-red'
                  }`}>
                    {indicators.macd.histogram > 0 ? '▲' : '▼'} {Math.abs(indicators.macd.histogram).toFixed(2)}
                  </span>
                </div>
              )}

              {indicators.ema20 !== undefined && indicators.ema200 !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/60">EMA Cross</span>
                  <span className={`text-[10px] font-mono font-bold ${
                    indicators.ema20 > indicators.ema200 ? 'text-oracle-green' : 'text-oracle-red'
                  }`}>
                    {indicators.ema20 > indicators.ema200 ? 'GOLDEN ▲' : 'DEATH ▼'}
                  </span>
                </div>
              )}

              {indicators.bb && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/60">BB Width</span>
                  <span className="text-xs font-mono text-white/50">
                    {(((indicators.bb.upper - indicators.bb.lower) / indicators.bb.middle) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 6. VOICE LOG ── */}
        {conversation.length > 0 && (
          <div className="space-y-2 pt-1">
            <Label>Voice Log</Label>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {conversation.slice(-6).map((entry, i) => (
                <div
                  key={i}
                  className={`text-xs rounded-lg px-3 py-2 leading-relaxed ${
                    entry.role === 'ai'
                      ? 'bg-oracle-green/8 border border-oracle-green/20 text-white/80'
                      : 'bg-white/5 border border-white/12 text-white/60'
                  }`}
                >
                  <span className="text-[10px] font-mono mr-1.5 uppercase font-bold opacity-60">
                    {entry.role === 'ai' ? 'Oracle' : 'You'}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
