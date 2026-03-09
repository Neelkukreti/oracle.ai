'use client';

import { useState, useEffect, useCallback } from 'react';

export interface IndicatorData {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  ema20?: number;
  ema200?: number;
  bb?: { upper: number; middle: number; lower: number };
  fetchedAt?: number;
}

/** Builds a text block to inject into the Gemini prompt */
export function buildIndicatorContext(symbol: string, interval: string, d: IndicatorData): string {
  const lines: string[] = [`LIVE INDICATOR DATA for ${symbol} (${interval}):`];

  if (d.rsi !== undefined) {
    const tag = d.rsi > 70 ? 'OVERBOUGHT' : d.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
    lines.push(`  RSI(14): ${d.rsi.toFixed(1)} — ${tag}`);
  }

  if (d.macd) {
    const tag = d.macd.histogram > 0 ? 'bullish momentum' : 'bearish momentum';
    lines.push(
      `  MACD: ${d.macd.value.toFixed(2)} | Signal: ${d.macd.signal.toFixed(2)} | Hist: ${d.macd.histogram.toFixed(2)} — ${tag}`
    );
  }

  if (d.ema20 !== undefined && d.ema200 !== undefined) {
    const cross = d.ema20 > d.ema200 ? 'GOLDEN CROSS (EMA20 > EMA200, bullish)' : 'DEATH CROSS (EMA20 < EMA200, bearish)';
    lines.push(`  EMA20: ${d.ema20.toFixed(2)} | EMA200: ${d.ema200.toFixed(2)} — ${cross}`);
  } else if (d.ema20 !== undefined) {
    lines.push(`  EMA20: ${d.ema20.toFixed(2)}`);
  }

  if (d.bb) {
    const width = (((d.bb.upper - d.bb.lower) / d.bb.middle) * 100).toFixed(1);
    lines.push(
      `  BB: Upper ${d.bb.upper.toFixed(2)} | Mid ${d.bb.middle.toFixed(2)} | Lower ${d.bb.lower.toFixed(2)} | Width: ${width}%`
    );
  }

  return lines.join('\n');
}

export function useIndicators(symbol: string, interval: string, active: boolean) {
  const [data, setData] = useState<IndicatorData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active || !symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, interval }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, active]);

  // Fetch on mount + whenever active/symbol/interval changes; refresh every 60 s
  useEffect(() => {
    if (!active) { setData({}); return; }
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [active, refresh]);

  return { data, loading, error, refresh };
}
