'use client';

import { useEffect, useRef } from 'react';

const INTERVAL_MAP: Record<string, string> = {
  '15m': '15', '1h': '60', '4h': '240', '1d': 'D',
};

interface TradingViewChartProps {
  symbol: string;
  interval: string;
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerId = 'oracle_tv_chart';
    container.innerHTML = `<div id="${containerId}" style="width:100%;height:100%"></div>`;

    const tvSymbol = `BINANCE:${symbol.replace('/', '')}`;
    const tvInterval = INTERVAL_MAP[interval] ?? '240';

    function initWidget() {
      const el = document.getElementById(containerId);
      if (!(window as any).TradingView?.widget || !el) return;
      new (window as any).TradingView.widget({
        container_id: containerId,
        symbol: tvSymbol,
        interval: tvInterval,
        theme: 'dark',
        style: '1',
        locale: 'en',
        width: '100%',
        height: '100%',
        hide_side_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        enable_publishing: false,
        withdateranges: false,
        hide_volume: false,
        backgroundColor: 'rgba(10, 14, 26, 1)',
      });
    }

    if ((window as any).TradingView?.widget) {
      initWidget();
    } else if (!document.getElementById('tv-script')) {
      const script = document.createElement('script');
      script.id = 'tv-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if ((window as any).TradingView?.widget) { clearInterval(poll); initWidget(); }
      }, 100);
      return () => clearInterval(poll);
    }

    return () => { if (container) container.innerHTML = ''; };
  }, [symbol, interval]);

  return <div ref={containerRef} className="w-full h-full" />;
}
