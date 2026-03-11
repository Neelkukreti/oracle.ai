'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const LS_GEMINI = 'oracle_gemini_key';
const LS_ELEVENLABS = 'oracle_elevenlabs_key';
const LS_WS_URL = 'oracle_ws_url';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080/ws');
  const [showGemini, setShowGemini] = useState(false);
  const [showEL, setShowEL] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setGeminiKey(localStorage.getItem(LS_GEMINI) || '');
      setElevenLabsKey(localStorage.getItem(LS_ELEVENLABS) || '');
      setWsUrl(localStorage.getItem(LS_WS_URL) || 'ws://localhost:8080/ws');
      setSaved(false);
    }
  }, [open]);

  const save = () => {
    if (geminiKey.trim()) localStorage.setItem(LS_GEMINI, geminiKey.trim());
    else localStorage.removeItem(LS_GEMINI);
    if (elevenLabsKey.trim()) localStorage.setItem(LS_ELEVENLABS, elevenLabsKey.trim());
    else localStorage.removeItem(LS_ELEVENLABS);
    localStorage.setItem(LS_WS_URL, wsUrl.trim() || 'ws://localhost:8080/ws');
    setSaved(true);
    setTimeout(onClose, 700);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Settings</h2>
            <p className="text-white/40 text-xs mt-0.5">Keys are saved locally in your browser — never sent anywhere else.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gemini API Key */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-white/70 text-sm font-medium">
              Gemini API Key <span className="text-red-400 text-xs ml-1">required</span>
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-oracle-green/70 text-xs hover:text-oracle-green transition-colors"
            >
              Get free key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative">
            <input
              type={showGemini ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-oracle-green/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowGemini(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ElevenLabs Key */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-white/70 text-sm font-medium">
              ElevenLabs API Key <span className="text-white/30 text-xs ml-1">optional — premium TTS voice</span>
            </label>
          </div>
          <div className="relative">
            <input
              type={showEL ? 'text' : 'password'}
              value={elevenLabsKey}
              onChange={(e) => setElevenLabsKey(e.target.value)}
              placeholder="sk_... (leave empty to use browser TTS)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-oracle-green/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowEL(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showEL ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Backend WS URL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-white/70 text-sm font-medium">
            Backend URL <span className="text-white/30 text-xs ml-1">defaults to localhost:8080</span>
          </label>
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://localhost:8080/ws"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-oracle-green/40 font-mono"
          />
          <p className="text-white/25 text-xs">Use <code className="text-white/40">wss://</code> for deployed backends.</p>
        </div>

        <button
          onClick={save}
          disabled={!geminiKey.trim()}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all bg-oracle-green/15 border border-oracle-green/30 text-oracle-green hover:bg-oracle-green/22 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// Helper to read keys from localStorage (safe for SSR)
export function getStoredKeys() {
  if (typeof window === 'undefined') return { geminiKey: '', elevenLabsKey: '', wsUrl: '' };
  return {
    geminiKey: localStorage.getItem(LS_GEMINI) || '',
    elevenLabsKey: localStorage.getItem(LS_ELEVENLABS) || '',
    wsUrl: localStorage.getItem(LS_WS_URL) || '',
  };
}
