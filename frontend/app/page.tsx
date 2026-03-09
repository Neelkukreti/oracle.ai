'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Send, Loader2, ChevronRight, Monitor, Mic2, Brain, Zap, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOracle } from '@/hooks/useOracle';
import { useIndicators, buildIndicatorContext } from '@/hooks/useIndicators';
import { ScreenShare } from '@/components/ScreenShare';
import { AudioVoice } from '@/components/AudioVoice';
import { ChartOverlay } from '@/components/ChartOverlay';
import { AnalysisSidebar } from '@/components/AnalysisSidebar';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];
const INTERVALS = ['15m', '1h', '4h', '1d'];

const QUICK_CHIPS = [
  'Is this a good long?',
  'Where is key support?',
  'What invalidates this?',
  'What is the trend?',
];

export default function Page() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [interval, setInterval] = useState('4h');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isConnected,
    sendAudioChunk,
    sendFrame,
    sendQuestion,
    start,
    stop,
    latestAnalysis,
    conversation,
    latestSpeech,
  } = useOracle(WS_URL);

  const { data: indicators, loading: indLoading, refresh: refreshIndicators } = useIndicators(
    symbol,
    interval,
    isSessionActive
  );

  useEffect(() => {
    if (latestSpeech) setIsThinking(false);
  }, [latestSpeech]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      setContainerSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = stream;
      if (stream) videoPreviewRef.current.play().catch(() => {});
    }
  }, [stream]);

  const handleStart = () => {
    start();
    setIsSessionActive(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleStop = () => {
    stop();
    setIsSessionActive(false);
    setIsThinking(false);
  };

  const submitQuestion = useCallback(
    (text: string) => {
      if (!text.trim() || !isSessionActive) return;
      sendQuestion(text.trim(), symbol, interval);
      setIsThinking(true);
    },
    [isSessionActive, sendQuestion, symbol, interval]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      submitQuestion(inputText);
      setInputText('');
    }
  };

  const handleUserSpeech = useCallback(
    (text: string) => {
      if (isSessionActive) submitQuestion(text);
    },
    [isSessionActive, submitQuestion]
  );

  const highlights = latestAnalysis?.highlights ?? [];

  return (
    <div className="flex flex-col h-screen bg-oracle-bg overflow-hidden">
      {/* ─── Top bar ─── */}
      <header className="flex items-center px-5 py-3 border-b border-oracle-border bg-oracle-surface/90 backdrop-blur-sm z-20 shrink-0 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xl select-none">🔮</span>
          <div className="leading-none">
            <p className="font-bold text-white tracking-widest text-sm font-mono">ORACLE</p>
            <p className="text-[9px] text-white/25 font-mono tracking-widest mt-0.5 hidden sm:block">
              AI TRADING COPILOT
            </p>
          </div>
        </div>

        {/* Center status pill */}
        <div className="flex-1 flex justify-center">
          <AnimatePresence mode="wait">
            {isSessionActive && (
              <motion.div
                key="live-pill"
                initial={{ opacity: 0, scale: 0.85, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs tracking-widest ${
                  isThinking
                    ? 'bg-oracle-blue/10 border-oracle-blue/30 text-oracle-blue'
                    : 'bg-oracle-green/8 border-oracle-green/20 text-oracle-green'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isThinking ? 'bg-oracle-blue' : 'bg-oracle-green'
                  }`}
                />
                {isThinking ? 'ANALYZING...' : 'ORACLE LIVE'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Instrument selector (server-side indicators, not a key leak) */}
        <div className="flex items-center gap-1.5">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-white/5 border border-white/10 text-white/70 text-xs font-mono rounded-md px-2 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s} className="bg-[#111520]">{s}</option>
            ))}
          </select>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="bg-white/5 border border-white/10 text-white/70 text-xs font-mono rounded-md px-2 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer"
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i} className="bg-[#111520]">{i}</option>
            ))}
          </select>
          {isSessionActive && (
            <button
              onClick={refreshIndicators}
              disabled={indLoading}
              title="Refresh indicators"
              className="p-1.5 rounded-md bg-white/5 border border-white/10 text-white/40 hover:text-oracle-green/70 hover:border-oracle-green/30 transition-all disabled:opacity-30"
            >
              <RefreshCw className={`w-3 h-3 ${indLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs mr-1">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                isConnected ? 'bg-oracle-green' : 'bg-white/15'
              }`}
            />
            <span
              className={`font-mono text-[10px] tracking-widest ${
                isConnected ? 'text-oracle-green/60' : 'text-white/20'
              }`}
            >
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <ScreenShare onFrame={sendFrame} onStream={setStream} fps={3} quality={0.7} />
          <AudioVoice onAudioChunk={sendAudioChunk} onUserSpeech={handleUserSpeech} />

          {!isSessionActive ? (
            <button
              onClick={handleStart}
              disabled={!isConnected}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-oracle-green text-black font-bold text-sm transition-all hover:bg-oracle-green/90 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed font-mono tracking-wide"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              START
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-oracle-red/10 border border-oracle-red/30 text-oracle-red font-bold text-sm hover:bg-oracle-red/20 active:scale-95 transition-all font-mono"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              STOP
            </button>
          )}
        </div>
      </header>

      {/* ─── Main content ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart viewer */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div
            className={`flex-1 relative bg-black overflow-hidden ${
              isSessionActive && stream ? 'scan-active' : ''
            }`}
            ref={containerRef}
          >
            {stream ? (
              <>
                <video
                  ref={videoPreviewRef}
                  className="absolute inset-0 w-full h-full object-contain"
                  playsInline
                  muted
                />
                <ChartOverlay
                  highlights={highlights}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />

                {/* "Oracle watching" badge */}
                <AnimatePresence>
                  {isSessionActive && !latestAnalysis && !isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-oracle-surface/80 border border-oracle-green/20 backdrop-blur-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-oracle-green animate-pulse" />
                      <span className="text-[11px] font-mono text-oracle-green/70 tracking-wider">
                        Oracle watching...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Analyzing badge */}
                <AnimatePresence>
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-oracle-surface/90 border border-oracle-blue/40 backdrop-blur-sm"
                    >
                      <Loader2 className="w-3 h-3 text-oracle-blue animate-spin" />
                      <span className="text-[11px] font-mono text-oracle-blue tracking-wider">
                        Analyzing chart...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* "Share screen first" overlay when session active but no stream */}
                {isSessionActive && !stream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white/30 text-sm font-mono">
                      Share your trading screen to begin
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* ─── Landing / Empty state ─── */
              <div className="absolute inset-0 overflow-y-auto scrollbar-none">
                {/* Ambient glow */}
                <div
                  className="absolute top-1/2 left-1/3 w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)',
                    animation: 'oracle-breathe 4s ease-in-out infinite',
                  }}
                />

                <div className="relative min-h-full flex items-center px-8 py-10 gap-10 max-w-5xl mx-auto">
                  {/* ── Left column: intro ── */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="flex-1 min-w-0"
                  >
                    {/* Crystal ball */}
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                      className="text-5xl mb-5 select-none"
                    >
                      🔮
                    </motion.div>

                    <h1 className="text-3xl font-bold text-white leading-tight">
                      Watching the market{' '}
                      <span className="text-oracle-green">live.</span>
                    </h1>
                    <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-xs">
                      Oracle reads your screen using Gemini multimodal AI — spots key levels,
                      reads price action, and answers your voice questions instantly.
                    </p>

                    {/* Feature grid */}
                    <div className="grid grid-cols-2 gap-2 mt-7 text-left">
                      {[
                        { Icon: Monitor, label: 'Screen-aware', desc: 'Sees your live chart via screen share', color: 'text-oracle-green' },
                        { Icon: Brain,   label: 'Gemini Live',  desc: 'Multimodal vision + language model',  color: 'text-oracle-blue' },
                        { Icon: Mic2,    label: 'Voice-native', desc: 'Ask questions by speaking naturally', color: 'text-oracle-yellow' },
                        { Icon: Zap,     label: 'Adapts live',  desc: 'Instantly updates when you switch charts', color: 'text-oracle-green' },
                      ].map(({ Icon, label, desc, color }, i) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.07 }}
                          className="flex items-start gap-2.5 bg-white/6 border border-white/12 rounded-xl px-3 py-2.5"
                        >
                          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                          <div>
                            <p className="text-[11px] font-semibold text-white/90">{label}</p>
                            <p className="text-[10px] text-white/55 mt-0.5 leading-snug">{desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* How to start */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-6 flex items-center gap-2 text-xs text-white/55 font-mono"
                    >
                      <span className="px-2.5 py-1 rounded bg-white/8 border border-white/15 text-white/75">1. Share Screen</span>
                      <ChevronRight className="w-3 h-3 text-white/30" />
                      <span className="px-2.5 py-1 rounded bg-white/8 border border-white/15 text-white/75">2. Click START</span>
                      <ChevronRight className="w-3 h-3 text-white/30" />
                      <span className="px-2.5 py-1 rounded bg-white/8 border border-white/15 text-white/75">3. Ask Oracle</span>
                    </motion.div>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.65 }}
                      className="mt-4 text-[10px] text-white/35 font-mono tracking-widest"
                    >
                      TRADINGVIEW · BINANCE · BYBIT · ANY CHART
                    </motion.p>
                  </motion.div>

                  {/* ── Right column: demo preview card ── */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
                    className="w-72 shrink-0"
                  >
                    {/* Label */}
                    <p className="text-[10px] font-mono text-white/35 tracking-widest mb-3 text-center">
                      EXAMPLE ORACLE ANALYSIS
                    </p>

                    {/* Trade signal card */}
                    <div className="rounded-2xl border border-oracle-red/40 overflow-hidden shadow-xl shadow-oracle-red/5">
                      {/* Colored header */}
                      <div className="bg-oracle-red px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold text-xl font-mono tracking-wide">SELL</p>
                          <p className="text-white/70 text-[10px] font-mono mt-0.5">BTC/USDT · 4H</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/90 text-[11px] font-mono">CONFIDENCE</p>
                          <p className="text-white font-bold text-lg font-mono">65%</p>
                        </div>
                      </div>

                      {/* Confidence bar */}
                      <div className="bg-black/40 h-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '65%' }}
                          transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
                          className="h-full bg-oracle-red"
                        />
                      </div>

                      <div className="bg-oracle-surface/80 p-4 space-y-4">
                        {/* Oracle speech */}
                        <div className="flex items-start gap-2.5 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
                          <span className="text-sm select-none shrink-0">🔮</span>
                          <p className="text-[11px] text-white/80 leading-relaxed italic">
                            "Lower high structure forming at 67,200 resistance — price rejecting
                            the level with increasing selling volume. Bearish."
                          </p>
                        </div>

                        {/* Key levels */}
                        <div>
                          <p className="text-[9px] font-mono text-white/40 tracking-widest mb-2">KEY LEVELS</p>
                          <div className="flex gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-oracle-red/12 border border-oracle-red/25 text-oracle-red/80">
                              R: 68,000
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-oracle-red/12 border border-oracle-red/25 text-oracle-red/80">
                              R: 67,200
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-oracle-green/12 border border-oracle-green/25 text-oracle-green/80">
                              S: 66,000
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono ring-1 ring-oracle-red/60 bg-oracle-red/8 text-oracle-red font-bold">
                              KEY: 67,200
                            </span>
                          </div>
                        </div>

                        {/* Reasoning */}
                        <div>
                          <p className="text-[9px] font-mono text-white/40 tracking-widest mb-2">SIGNALS</p>
                          <ul className="space-y-1">
                            {['Lower high structure', 'Price rejected resistance', 'Selling volume increasing'].map((r) => (
                              <li key={r} className="flex items-center gap-2 text-[11px] text-white/65">
                                <span className="w-1 h-1 rounded-full bg-oracle-red/70 shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Simulate trade row */}
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          {[
                            { label: 'ENTRY', value: '67,200', color: 'text-white/80' },
                            { label: 'STOP', value: '67,500', color: 'text-oracle-red/80' },
                            { label: 'TARGET', value: '66,200', color: 'text-oracle-green/80' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-black/25 rounded-lg p-2 text-center">
                              <p className="text-[8px] font-mono text-white/35 tracking-widest">{label}</p>
                              <p className={`text-[11px] font-mono font-semibold mt-0.5 ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Risk */}
                        <div>
                          <p className="text-[9px] font-mono text-white/40 tracking-widest mb-1.5">RISK LEVEL</p>
                          <div className="flex gap-1">
                            {(['LOW', 'MED', 'HIGH'] as const).map((lvl) => (
                              <div
                                key={lvl}
                                className={`flex-1 h-1.5 rounded-full transition-colors ${
                                  lvl === 'HIGH' ? 'bg-oracle-red' : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-[10px] text-oracle-red/80 font-mono mt-1">HIGH — RSI approaching overbought</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-[9px] text-white/25 font-mono text-center mt-2.5">
                      Oracle produces this for every question you ask
                    </p>
                  </motion.div>
                </div>
              </div>
            )}

            {/* ─── Oracle speech bubble ─── */}
            <AnimatePresence>
              {latestSpeech && isSessionActive && stream && (
                <motion.div
                  key={latestSpeech}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-5 left-5 right-5 max-w-xl"
                >
                  <div className="bg-oracle-surface/95 border border-oracle-green/20 backdrop-blur-md rounded-2xl px-4 py-3.5 shadow-2xl shadow-black/60">
                    <div className="flex items-start gap-3">
                      <span className="text-base shrink-0 mt-0.5 select-none">🔮</span>
                      <p className="text-sm text-white/85 leading-relaxed">{latestSpeech}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Question input bar ─── */}
          <AnimatePresence>
            {isSessionActive && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="shrink-0 border-t border-oracle-border bg-oracle-surface"
              >
                {/* Quick chips */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none flex-nowrap">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        submitQuestion(chip);
                      }}
                      disabled={isThinking}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8 text-white/40 text-xs font-mono hover:border-oracle-green/35 hover:text-oracle-green/75 hover:bg-oracle-green/5 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Text input */}
                <form onSubmit={handleFormSubmit} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask Oracle about the chart... or use your voice"
                      disabled={isThinking}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/18 focus:outline-none focus:border-oracle-green/35 disabled:opacity-40 font-mono tracking-wide transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isThinking}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-oracle-green/8 border border-oracle-green/25 text-oracle-green text-sm font-mono hover:bg-oracle-green/15 transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                  >
                    {isThinking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:block">Thinking</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:block">Ask</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right: Analysis sidebar ─── */}
        <div className="w-80 shrink-0 border-l border-oracle-border bg-oracle-surface overflow-hidden">
          <AnalysisSidebar
            analysis={latestAnalysis}
            conversation={conversation}
            isSessionActive={isSessionActive}
            latestSpeech={latestSpeech}
            isThinking={isThinking}
            indicators={indicators}
            symbol={symbol}
            interval={interval}
            indLoading={indLoading}
          />
        </div>
      </div>
    </div>
  );
}
