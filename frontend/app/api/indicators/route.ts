import { NextRequest, NextResponse } from 'next/server';

// Server-side only — key never reaches the browser bundle
const TAAPI_PROXY_URL = 'https://fedha-functions.azurewebsites.net/api/taapi-proxy';
const TAAPI_PROXY_KEY = process.env.TAAPI_PROXY_KEY || '';

async function fetchIndicator(
  indicator: string,
  symbol: string,
  interval: string,
  extra?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(TAAPI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Proxy-Key': TAAPI_PROXY_KEY,
    },
    body: JSON.stringify({ indicator, exchange: 'binance', symbol, interval, ...extra }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${indicator} ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  if (!TAAPI_PROXY_KEY) {
    return NextResponse.json({ error: 'TAAPI_PROXY_KEY not configured' }, { status: 503 });
  }

  const { symbol, interval } = await req.json();
  if (!symbol || !interval) {
    return NextResponse.json({ error: 'symbol and interval required' }, { status: 400 });
  }

  const [rsiR, macdR, ema20R, ema200R, bbR] = await Promise.allSettled([
    fetchIndicator('rsi', symbol, interval),
    fetchIndicator('macd', symbol, interval),
    fetchIndicator('ema', symbol, interval, { optInTimePeriod: 20 }),
    fetchIndicator('ema', symbol, interval, { optInTimePeriod: 200 }),
    fetchIndicator('bbands', symbol, interval),
  ]);

  const result: Record<string, unknown> = { fetchedAt: Date.now() };

  if (rsiR.status === 'fulfilled') result.rsi = (rsiR.value as any)?.value;

  if (macdR.status === 'fulfilled') {
    const m = macdR.value as any;
    if (m?.valueMACD !== undefined) {
      result.macd = {
        value: m.valueMACD,
        signal: m.valueMACDSignal,
        histogram: m.valueMACDHist,
      };
    }
  }

  if (ema20R.status === 'fulfilled') result.ema20 = (ema20R.value as any)?.value;
  if (ema200R.status === 'fulfilled') result.ema200 = (ema200R.value as any)?.value;

  if (bbR.status === 'fulfilled') {
    const b = bbR.value as any;
    if (b?.valueUpperBand !== undefined) {
      result.bb = {
        upper: b.valueUpperBand,
        middle: b.valueMiddleBand,
        lower: b.valueLowerBand,
      };
    }
  }

  return NextResponse.json(result);
}
