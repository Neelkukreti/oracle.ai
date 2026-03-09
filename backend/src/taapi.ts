// Server-side only — TAAPI proxy integration
// Key never leaves the backend; injected via process.env

const PROXY_URL = process.env.TAAPI_PROXY_URL || 'https://fedha-functions.azurewebsites.net/api/taapi-proxy';
const PROXY_KEY = process.env.TAAPI_PROXY_KEY || '';

export interface IndicatorData {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  ema20?: number;
  ema200?: number;
  bb?: { upper: number; middle: number; lower: number };
}

async function fetchOne(
  indicator: string,
  symbol: string,
  interval: string,
  extra?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Proxy-Key': PROXY_KEY },
    body: JSON.stringify({ indicator, exchange: 'binance', symbol, interval, ...extra }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`${indicator}: ${res.status}`);
  return res.json();
}

export async function fetchIndicators(symbol: string, interval: string): Promise<IndicatorData> {
  if (!PROXY_KEY) return {};

  const [rsiR, macdR, ema20R, ema200R, bbR] = await Promise.allSettled([
    fetchOne('rsi', symbol, interval),
    fetchOne('macd', symbol, interval),
    fetchOne('ema', symbol, interval, { optInTimePeriod: 20 }),
    fetchOne('ema', symbol, interval, { optInTimePeriod: 200 }),
    fetchOne('bbands', symbol, interval),
  ]);

  const out: IndicatorData = {};

  if (rsiR.status === 'fulfilled') out.rsi = (rsiR.value as any)?.value;

  if (macdR.status === 'fulfilled') {
    const m = macdR.value as any;
    if (m?.valueMACD !== undefined) {
      out.macd = { value: m.valueMACD, signal: m.valueMACDSignal, histogram: m.valueMACDHist };
    }
  }

  if (ema20R.status === 'fulfilled') out.ema20 = (ema20R.value as any)?.value;
  if (ema200R.status === 'fulfilled') out.ema200 = (ema200R.value as any)?.value;

  if (bbR.status === 'fulfilled') {
    const b = bbR.value as any;
    if (b?.valueUpperBand !== undefined) {
      out.bb = { upper: b.valueUpperBand, middle: b.valueMiddleBand, lower: b.valueLowerBand };
    }
  }

  return out;
}

export function buildIndicatorContext(symbol: string, interval: string, d: IndicatorData): string {
  if (Object.keys(d).length === 0) return '';

  const lines: string[] = [`LIVE INDICATOR DATA for ${symbol} (${interval} chart):`];

  if (d.rsi !== undefined) {
    const tag = d.rsi > 70 ? 'OVERBOUGHT — potential reversal zone' : d.rsi < 30 ? 'OVERSOLD — potential bounce zone' : 'NEUTRAL';
    lines.push(`  RSI(14): ${d.rsi.toFixed(1)} — ${tag}`);
  }

  if (d.macd) {
    const tag = d.macd.histogram > 0 ? 'bullish momentum building' : 'bearish momentum building';
    lines.push(
      `  MACD: ${d.macd.value.toFixed(4)} | Signal: ${d.macd.signal.toFixed(4)} | Histogram: ${d.macd.histogram.toFixed(4)} — ${tag}`
    );
  }

  if (d.ema20 !== undefined && d.ema200 !== undefined) {
    const cross = d.ema20 > d.ema200
      ? 'GOLDEN CROSS (EMA20 above EMA200 = overall bullish structure)'
      : 'DEATH CROSS (EMA20 below EMA200 = overall bearish structure)';
    lines.push(`  EMA20: ${d.ema20.toFixed(2)} | EMA200: ${d.ema200.toFixed(2)} — ${cross}`);
  } else if (d.ema20 !== undefined) {
    lines.push(`  EMA20: ${d.ema20.toFixed(2)}`);
  }

  if (d.bb) {
    const width = (((d.bb.upper - d.bb.lower) / d.bb.middle) * 100).toFixed(2);
    lines.push(
      `  Bollinger Bands: Upper ${d.bb.upper.toFixed(2)} | Mid ${d.bb.middle.toFixed(2)} | Lower ${d.bb.lower.toFixed(2)} | Band width: ${width}% (${parseFloat(width) > 4 ? 'high volatility' : 'low volatility'})`
    );
  }

  return lines.join('\n');
}
