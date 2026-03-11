'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Send, Loader2, ChevronRight, RefreshCw, ArrowRight, Eye, Brain, Zap } from 'lucide-react';
import { FloatingOracle } from '@/components/FloatingOracle';
import { motion, AnimatePresence } from 'framer-motion';
import { useOracle } from '@/hooks/useOracle';
import { useIndicators, buildIndicatorContext } from '@/hooks/useIndicators';
import { ScreenShare } from '@/components/ScreenShare';
import { AudioVoice } from '@/components/AudioVoice';
import { ChartOverlay } from '@/components/ChartOverlay';
import { AnalysisSidebar } from '@/components/AnalysisSidebar';
import { TradingViewChart } from '@/components/TradingViewChart';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];
const INTERVALS = ['15m', '1h', '4h', '1d'];
const QUICK_CHIPS = ['Is this a good long?', 'Where is key support?', 'What invalidates this?', 'What is the trend?'];

const FEATURES = [
  {
    Icon: Eye,
    title: 'AI Chart Vision',
    desc: 'Oracle reads your chart using Gemini Vision and detects support, resistance, and patterns in real time.',
    iconCls: 'text-oracle-blue',
    glow: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.18)',
  },
  {
    Icon: Brain,
    title: 'Voice Trading Assistant',
    desc: 'Enable the mic and just speak — Oracle hears everything and responds instantly.',
    iconCls: 'text-oracle-green',
    glow: 'rgba(0,255,136,0.12)',
    border: 'rgba(0,255,136,0.18)',
  },
  {
    Icon: Zap,
    title: 'Real-Time Copilot',
    desc: 'Oracle watches the market with you — highlighting opportunities, flagging risk, tracking key levels.',
    iconCls: 'text-purple-400',
    glow: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.18)',
  },
];

const STEPS = [
  { num: '01', title: 'Share Your Chart', desc: 'Click Share Screen and select your TradingView or exchange window.' },
  { num: '02', title: 'Ask Oracle', desc: 'Enable the mic and just speak. Oracle listens and responds to everything you say.' },
  { num: '03', title: 'Get AI Analysis', desc: 'Oracle reads the chart with Gemini Vision and responds instantly.' },
];

export default function Page() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [interval, setInterval] = useState('4h');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isConnected, sendAudioChunk, sendFrame, sendQuestion, start, stop, latestAnalysis, conversation, latestSpeech, isSpeaking } = useOracle(WS_URL);
  const { data: indicators, loading: indLoading, refresh: refreshIndicators } = useIndicators(symbol, interval, isSessionActive);

  useEffect(() => { if (latestSpeech) setIsThinking(false); }, [latestSpeech]);
  // Clear thinking state on backend error
  useEffect(() => { if (status === 'error') setIsThinking(false); }, [status]);
  // 30-second safety timeout — never stay stuck
  useEffect(() => {
    if (!isThinking) return;
    const t = setTimeout(() => setIsThinking(false), 30_000);
    return () => clearTimeout(t);
  }, [isThinking]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => {
      setContainerSize({ width: e[0].contentRect.width, height: e[0].contentRect.height });
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

  const handleStop = () => { stop(); setIsSessionActive(false); setIsThinking(false); };

  const submitQuestion = useCallback((text: string) => {
    if (!text.trim() || !isSessionActive) return;
    sendQuestion(text.trim(), symbol, interval);
    setIsThinking(true);
  }, [isSessionActive, sendQuestion, symbol, interval]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) { submitQuestion(inputText); setInputText(''); }
  };

  const handleUserSpeech = useCallback((text: string) => {
    if (isSessionActive && !isMuted && !isSpeaking) submitQuestion(text);
  }, [isSessionActive, isMuted, isSpeaking, submitQuestion]);

  const highlights = latestAnalysis?.highlights ?? [];

  // ── LANDING ───────────────────────────────────────────────────────────────
  if (!isSessionActive && !stream) {
    return (
      <div className="min-h-screen bg-oracle-bg text-white overflow-x-hidden font-sans">

        {/* ── Fixed Background ── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden select-none">
          {/* Dot grid */}
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          {/* Ambient glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
            style={{ background: 'radial-gradient(ellipse, rgba(0,255,136,0.055) 0%, transparent 65%)', filter: 'blur(1px)' }} />
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[400px]"
            style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 65%)', filter: 'blur(1px)' }} />
          <div className="absolute bottom-1/3 right-1/5 w-[400px] h-[350px]"
            style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.04) 0%, transparent 65%)', filter: 'blur(1px)' }} />
          {/* Floating candlestick shapes */}
          {[
            { top: '18%', left: '6%',  w: 2, h: 28, body: 16, delay: 0 },
            { top: '42%', left: '10%', w: 2, h: 20, body: 10, delay: 0.8 },
            { top: '65%', left: '4%',  w: 2, h: 34, body: 22, delay: 1.5 },
            { top: '20%', right: '8%', w: 2, h: 26, body: 14, delay: 0.4 },
            { top: '50%', right: '5%', w: 2, h: 32, body: 18, delay: 1.2 },
            { top: '72%', right: '12%',w: 2, h: 22, body: 12, delay: 0.6 },
          ].map((c, i) => (
            <motion.div key={i} className="absolute"
              style={{ top: c.top, left: (c as any).left, right: (c as any).right }}
              animate={{ y: [0, -10, 0], opacity: [0.08, 0.16, 0.08] }}
              transition={{ repeat: Infinity, duration: 5 + i * 0.7, delay: c.delay, ease: 'easeInOut' }}>
              <div style={{ width: c.w, height: c.h, background: 'rgba(0,255,136,0.4)', borderRadius: 1, position: 'relative', margin: '0 auto' }}>
                <div style={{ position: 'absolute', top: Math.floor((c.h - c.body) / 2), left: -2, width: c.w + 4, height: c.body, background: 'rgba(0,255,136,0.5)', borderRadius: 1 }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Navbar ── */}
        <nav className="sticky top-0 z-50 flex items-center px-6 py-4 border-b border-white/[0.05] bg-oracle-bg/85 backdrop-blur-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-8 h-8">
              <motion.div className="absolute inset-0 rounded-full bg-oracle-green/25 blur-md"
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2.5 }} />
              <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.9), rgba(59,130,246,0.7), rgba(168,85,247,0.8))', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
                <div className="w-2 h-2 rounded-full bg-white/85" />
                <div className="absolute top-1 left-1.5 w-2.5 h-1.5 rounded-full bg-white/30 blur-[2px]" />
              </div>
            </div>
            <div>
              <p className="font-black text-white tracking-widest text-sm font-mono leading-none">ORACLE</p>
              <p className="text-[8px] text-white/25 font-mono tracking-widest mt-0.5">AI TRADING COPILOT</p>
            </div>
          </div>

          {/* Center: instrument selectors */}
          <div className="flex-1 flex justify-center items-center gap-2">
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="bg-white/[0.04] border border-white/8 text-white/55 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer">
              {SYMBOLS.map(s => <option key={s} value={s} className="bg-[#090c14]">{s}</option>)}
            </select>
            <select value={interval} onChange={e => setInterval(e.target.value)}
              className="bg-white/[0.04] border border-white/8 text-white/55 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer">
              {INTERVALS.map(i => <option key={i} value={i} className="bg-[#090c14]">{i}</option>)}
            </select>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isConnected ? 'bg-oracle-green' : 'bg-white/15'}`} />
              <span className={`text-[10px] font-mono tracking-widest ${isConnected ? 'text-oracle-green/55' : 'text-white/20'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <ScreenShare onFrame={sendFrame} onStream={setStream} fps={3} quality={0.7} />
            <AudioVoice onAudioChunk={sendAudioChunk} onUserSpeech={handleUserSpeech} />
            <button onClick={handleStart} disabled={!isConnected}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-oracle-green text-black font-black text-sm font-mono tracking-wide transition-all hover:bg-oracle-green/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ boxShadow: isConnected ? '0 0 20px rgba(0,255,136,0.28)' : undefined }}>
              <Play className="w-3.5 h-3.5 fill-current" />
              START
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="relative flex flex-col items-center text-center pt-20 pb-14 px-6">
          {/* Oracle orb */}
          <motion.div className="relative mb-8 w-24 h-24"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="absolute inset-0 rounded-full border border-oracle-green/25"
                animate={{ scale: [1, 1.7 + i * 0.35], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2.8, delay: i * 0.65, ease: 'easeOut' }} />
            ))}
            <div className="absolute inset-5 rounded-full overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #00FF88 0%, #3B82F6 55%, #A855F7 100%)', boxShadow: '0 0 60px rgba(0,255,136,0.4), 0 0 120px rgba(0,255,136,0.12)' }}>
              <div className="absolute top-2 left-3 w-4 h-3 rounded-full bg-white/45 blur-sm" />
              <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-white/15 blur-sm" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-oracle-green/20 bg-oracle-green/[0.07] text-oracle-green text-[10px] font-mono tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-oracle-green animate-pulse" />
              POWERED BY GOOGLE GEMINI
            </div>

            <h1 className="text-5xl sm:text-[64px] font-black tracking-tight leading-[1.06] mb-5">
              <span className="text-white">Your AI </span>
              <span style={{ background: 'linear-gradient(100deg, #00FF88 10%, #3B82F6 60%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Trading
              </span>
              <br />
              <span className="text-white">Copilot.</span>
            </h1>

            <p className="text-white/40 text-lg max-w-[440px] mx-auto leading-relaxed mb-9">
              Share your chart and ask Oracle anything.
              Gemini Vision reads the market — you trade smarter.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={handleStart} disabled={!isConnected}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-oracle-green text-black font-black text-base font-mono tracking-wide transition-all hover:bg-oracle-green/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 0 35px rgba(0,255,136,0.32), 0 2px 8px rgba(0,0,0,0.4)' }}>
                <Play className="w-4 h-4 fill-current" />
                Start Live Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#how-it-works"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 text-white/50 text-base font-mono hover:border-white/20 hover:text-white/75 transition-all">
                How it works
              </a>
            </div>
          </motion.div>
        </section>

        {/* ── Chart preview ── */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-4 items-start">

            {/* Left: live TV chart */}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono text-white/22 tracking-widest mb-2 px-0.5">YOUR CHART</p>
              <div className="rounded-2xl overflow-hidden"
                style={{ height: '320px', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 80px rgba(0,0,0,0.6)' }}>
                <TradingViewChart symbol={symbol} interval={interval} />
              </div>
            </div>

            {/* Right: Oracle output demo */}
            <div className="w-72 shrink-0">
              <p className="text-[9px] font-mono text-white/22 tracking-widest mb-2 px-0.5">ORACLE OUTPUT</p>
              <div className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(255,68,102,0.28)', boxShadow: '0 0 50px rgba(255,68,102,0.08), 0 24px 60px rgba(0,0,0,0.5)' }}>
                {/* Card header */}
                <div className="px-4 py-3.5 flex items-center justify-between"
                  style={{ background: 'linear-gradient(135deg, rgba(255,68,102,0.14) 0%, rgba(255,68,102,0.07) 100%)', borderBottom: '1px solid rgba(255,68,102,0.14)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-oracle-red font-black text-2xl font-mono leading-none">SELL</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-oracle-red/12 border border-oracle-red/22 text-oracle-red text-[8px] font-mono tracking-wide">SIGNAL</span>
                    </div>
                    <p className="text-white/35 text-[9px] font-mono">BTC/USDT · 4H · 65% confidence</p>
                  </div>
                  <div className="relative w-10 h-10">
                    <motion.div className="absolute inset-0 rounded-full bg-oracle-green/20 blur-sm"
                      animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} />
                    <div className="relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.85), rgba(59,130,246,0.65))', boxShadow: '0 0 16px rgba(0,255,136,0.3)' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/85" />
                      <div className="absolute top-1.5 left-2 w-3 h-2 rounded-full bg-white/30 blur-[2px]" />
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="h-px bg-white/[0.04]">
                  <motion.div initial={{ width: 0 }} animate={{ width: '65%' }}
                    transition={{ delay: 0.9, duration: 1.1, ease: 'easeOut' }}
                    className="h-full bg-oracle-red" />
                </div>

                {/* Body */}
                <div className="p-4 space-y-3" style={{ background: 'rgba(13,17,32,0.95)' }}>
                  <p className="text-[11px] text-white/60 leading-relaxed italic border-l-2 border-oracle-red/45 pl-3">
                    "Lower high at 67,200 — rejecting resistance with selling volume. I'd wait for a short setup here."
                  </p>

                  <div className="grid grid-cols-2 gap-2 py-1">
                    {[['RESISTANCE', [['67,200', true], ['67,500', true]]], ['SUPPORT', [['66,000', false], ['65,200', false]]]].map(([label, levels]: any) => (
                      <div key={label}>
                        <p className="text-[8px] font-mono text-white/25 tracking-widest mb-2">{label}</p>
                        {levels.map(([v, isRes]: [string, boolean]) => (
                          <div key={v} className="flex items-center gap-1.5 mb-1">
                            <div className={`w-1 h-1 rounded-full ${isRes ? 'bg-oracle-red/55' : 'bg-oracle-green/55'}`} />
                            <span className={`text-[10px] font-mono ${isRes ? 'text-oracle-red/75' : 'text-oracle-green/75'}`}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[['ENTRY','67,200','text-white/60'],['STOP','67,500','text-oracle-red/70'],['TARGET','66,200','text-oracle-green/70']].map(([l,v,c]) => (
                      <div key={l} className="rounded-lg p-2 text-center" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[7px] font-mono text-white/20 tracking-widest">{l}</p>
                        <p className={`text-[10px] font-mono font-bold mt-0.5 ${c}`}>{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <p className="text-[8px] font-mono text-white/25 tracking-widest shrink-0">RISK</p>
                    <div className="flex-1 flex gap-0.5">
                      {['', '', ''].map((_, i) => (
                        <div key={i} className={`flex-1 h-1.5 rounded-full ${i === 2 ? 'bg-oracle-red' : i === 1 ? 'bg-oracle-red/30' : 'bg-white/[0.06]'}`} />
                      ))}
                    </div>
                    <span className="text-[9px] font-mono text-oracle-red/65 shrink-0">HIGH</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-center mb-12">
            <p className="text-[10px] font-mono text-oracle-green/55 tracking-[0.25em] mb-3">CAPABILITIES</p>
            <h2 className="text-3xl font-bold text-white tracking-tight">Built for serious traders.</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1 }}
                className="group relative rounded-2xl p-6 cursor-default overflow-hidden transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                whileHover={{ borderColor: f.border }}>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% -10%, ${f.glow} 0%, transparent 65%)` }} />
                <div className={`w-11 h-11 rounded-xl mb-5 flex items-center justify-center ${f.iconCls}`}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <f.Icon className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-[15px] mb-2.5">{f.title}</h3>
                <p className="text-white/38 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="px-6 py-20 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-center mb-14">
            <p className="text-[10px] font-mono text-oracle-blue/55 tracking-[0.25em] mb-3">HOW IT WORKS</p>
            <h2 className="text-3xl font-bold text-white tracking-tight">Three steps to AI-powered trading.</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden sm:block absolute top-6 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px bg-gradient-to-r from-white/8 via-white/12 to-white/8" />

            {STEPS.map((s, i) => (
              <motion.div key={s.num}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.12 }}
                className="flex flex-col items-start relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5 relative z-10"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="text-sm font-black font-mono text-white/50">{s.num}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2.5">{s.title}</h3>
                <p className="text-white/38 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CTA banner ── */}
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="relative rounded-3xl p-10 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.07) 0%, rgba(59,130,246,0.05) 50%, rgba(168,85,247,0.06) 100%)', border: '1px solid rgba(0,255,136,0.12)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,255,136,0.08) 0%, transparent 60%)' }} />
            <p className="text-[10px] font-mono text-oracle-green/55 tracking-[0.25em] mb-4">LIVE NOW</p>
            <h2 className="text-3xl font-bold text-white mb-3">Ready to trade smarter?</h2>
            <p className="text-white/40 text-base mb-8 max-w-sm mx-auto">
              Share your chart and let Oracle watch the market with you.
            </p>
            <button onClick={handleStart} disabled={!isConnected}
              className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl bg-oracle-green text-black font-black text-base font-mono tracking-wide transition-all hover:bg-oracle-green/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 40px rgba(0,255,136,0.3), 0 2px 8px rgba(0,0,0,0.4)' }}>
              <Play className="w-4 h-4 fill-current" />
              Start Live Analysis
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-6 py-8 border-t border-white/[0.05] max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="text-white/18 text-xs font-mono">Built with</span>
            {['Google Gemini', 'TradingView', 'WebRTC', 'Next.js'].map(t => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.07] text-white/30 text-[10px] font-mono">{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.8), rgba(59,130,246,0.6))' }}>
              <div className="w-1 h-1 rounded-full bg-white/80" />
            </div>
            <p className="text-white/15 text-[10px] font-mono tracking-widest">ORACLE AI TRADING COPILOT</p>
          </div>
        </footer>

      </div>
    );
  }

  // ── TRADING DASHBOARD ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-oracle-bg overflow-hidden">
      {/* ─── Top bar ─── */}
      <header className="flex items-center px-5 py-3 border-b border-oracle-border bg-oracle-surface/90 backdrop-blur-sm z-20 shrink-0 gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full bg-oracle-green/20 blur-sm animate-pulse" />
            <div className="relative w-7 h-7 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.85), rgba(59,130,246,0.65))', boxShadow: '0 0 12px rgba(0,255,136,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-white/85" />
            </div>
          </div>
          <div className="leading-none">
            <p className="font-bold text-white tracking-widest text-sm font-mono">ORACLE</p>
            <p className="text-[9px] text-white/25 font-mono tracking-widest mt-0.5 hidden sm:block">AI TRADING COPILOT</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <AnimatePresence mode="wait">
            {isSessionActive && (
              <motion.div key="live-pill"
                initial={{ opacity: 0, scale: 0.85, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs tracking-widest ${
                  isThinking ? 'bg-oracle-blue/10 border-oracle-blue/30 text-oracle-blue' : 'bg-oracle-green/8 border-oracle-green/20 text-oracle-green'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isThinking ? 'bg-oracle-blue' : 'bg-oracle-green'}`} />
                {isThinking ? 'ANALYZING...' : 'ORACLE LIVE'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5">
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="bg-white/5 border border-white/10 text-white/70 text-xs font-mono rounded-md px-2 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer">
            {SYMBOLS.map(s => <option key={s} value={s} className="bg-[#111520]">{s}</option>)}
          </select>
          <select value={interval} onChange={e => setInterval(e.target.value)}
            className="bg-white/5 border border-white/10 text-white/70 text-xs font-mono rounded-md px-2 py-1.5 focus:outline-none focus:border-oracle-green/40 cursor-pointer">
            {INTERVALS.map(i => <option key={i} value={i} className="bg-[#111520]">{i}</option>)}
          </select>
          {isSessionActive && (
            <button onClick={refreshIndicators} disabled={indLoading} title="Refresh indicators"
              className="p-1.5 rounded-md bg-white/5 border border-white/10 text-white/40 hover:text-oracle-green/70 hover:border-oracle-green/30 transition-all disabled:opacity-30">
              <RefreshCw className={`w-3 h-3 ${indLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs mr-1">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isConnected ? 'bg-oracle-green' : 'bg-white/15'}`} />
            <span className={`font-mono text-[10px] tracking-widest ${isConnected ? 'text-oracle-green/60' : 'text-white/20'}`}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <ScreenShare onFrame={sendFrame} onStream={setStream} fps={3} quality={0.7} />
          <AudioVoice onAudioChunk={sendAudioChunk} onUserSpeech={handleUserSpeech} onAudioLevel={setAudioLevel} />
          <FloatingOracle
            conversation={conversation}
            latestSpeech={latestSpeech}
            isThinking={isThinking}
            isSessionActive={isSessionActive}
            audioLevel={audioLevel}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(m => !m)}
          />
          {!isSessionActive ? (
            <button onClick={handleStart} disabled={!isConnected}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-oracle-green text-black font-bold text-sm transition-all hover:bg-oracle-green/90 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed font-mono tracking-wide">
              <Play className="w-3.5 h-3.5 fill-current" />START
            </button>
          ) : (
            <button onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-oracle-red/10 border border-oracle-red/30 text-oracle-red font-bold text-sm hover:bg-oracle-red/20 active:scale-95 transition-all font-mono">
              <Square className="w-3.5 h-3.5 fill-current" />STOP
            </button>
          )}
        </div>
      </header>

      {/* ─── Main content ─── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className={`flex-1 relative bg-black overflow-hidden ${isSessionActive && stream ? 'scan-active' : ''}`} ref={containerRef}>
            {stream ? (
              <>
                <video ref={videoPreviewRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted />
                <ChartOverlay highlights={highlights} containerWidth={containerSize.width} containerHeight={containerSize.height} />
                <AnimatePresence>
                  {isSessionActive && !latestAnalysis && !isThinking && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-oracle-surface/80 border border-oracle-green/20 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-oracle-green animate-pulse" />
                      <span className="text-[11px] font-mono text-oracle-green/70 tracking-wider">Oracle watching...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {isThinking && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-oracle-surface/90 border border-oracle-blue/40 backdrop-blur-sm">
                      <Loader2 className="w-3 h-3 text-oracle-blue animate-spin" />
                      <span className="text-[11px] font-mono text-oracle-blue tracking-wider">Analyzing chart...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isSessionActive && !stream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white/30 text-sm font-mono">Share your trading screen to begin</p>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/25 text-sm font-mono tracking-wide">Share your screen to begin</p>
              </div>
            )}

            <AnimatePresence>
              {latestSpeech && isSessionActive && stream && (
                <motion.div key={latestSpeech}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-5 left-5 right-5 max-w-xl">
                  <div className="bg-oracle-surface/95 border border-oracle-green/20 backdrop-blur-md rounded-2xl px-4 py-3.5 shadow-2xl shadow-black/60">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.8), rgba(59,130,246,0.6))' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                      </div>
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
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                className="shrink-0 border-t border-oracle-border bg-oracle-surface">
                <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none flex-nowrap">
                  {QUICK_CHIPS.map(chip => (
                    <button key={chip} onClick={() => submitQuestion(chip)} disabled={isThinking}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8 text-white/40 text-xs font-mono hover:border-oracle-green/35 hover:text-oracle-green/75 hover:bg-oracle-green/5 transition-all disabled:opacity-25 disabled:cursor-not-allowed">
                      <ChevronRight className="w-2.5 h-2.5 shrink-0" />{chip}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleFormSubmit} className="flex items-center gap-3 px-4 py-3">
                  <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    placeholder="Ask Oracle about the chart... or use your voice"
                    disabled={isThinking}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/18 focus:outline-none focus:border-oracle-green/35 disabled:opacity-40 font-mono tracking-wide transition-colors" />
                  <button type="submit" disabled={!inputText.trim() || isThinking}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-oracle-green/8 border border-oracle-green/25 text-oracle-green text-sm font-mono hover:bg-oracle-green/15 transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0">
                    {isThinking ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:block">Thinking</span></> : <><Send className="w-4 h-4" /><span className="hidden sm:block">Ask</span></>}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right sidebar ─── */}
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
