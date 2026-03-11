'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ConversationEntry } from '@/hooks/useOracle';

interface FloatingOracleProps {
  conversation: ConversationEntry[];
  latestSpeech: string | null;
  isThinking: boolean;
  isSessionActive: boolean;
  audioLevel: number;
  isMuted: boolean;
  onMuteToggle: () => void;
}

// ── PiP content uses 100% inline styles — guaranteed to render in any window ──
function PiPContent({ conversation, isThinking, isSessionActive, audioLevel, isMuted, onMuteToggle }: FloatingOracleProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastEntries = conversation.slice(-6);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [conversation.length]);

  const BAR_COUNT = 24;

  return (
    <div style={{
      background: '#090c14',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      color: 'white',
      overflow: 'hidden',
    }}>
      {/* Injected keyframes + reset */}
      <style>{`
        @keyframes pip-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pip-spin  { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:2px }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#00FF88,#3B82F6)',
            boxShadow: '0 0 10px rgba(0,255,136,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: '0.15em', fontFamily: 'monospace' }}>ORACLE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isThinking ? (
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #3B82F6', borderTopColor: 'transparent', animation: 'pip-spin 0.75s linear infinite' }} />
          ) : (
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isSessionActive ? '#00FF88' : 'rgba(255,255,255,0.18)',
              animation: isSessionActive ? 'pip-pulse 2s ease-in-out infinite' : 'none',
            }} />
          )}
          <span style={{
            fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.12em',
            color: isThinking ? '#3B82F6' : isSessionActive ? 'rgba(0,255,136,0.7)' : 'rgba(255,255,255,0.22)',
          }}>
            {isThinking ? 'ANALYZING' : isSessionActive ? 'LIVE' : 'IDLE'}
          </span>
          {/* Mute toggle */}
          <button onClick={onMuteToggle} title={isMuted ? 'Unmute mic' : 'Mute mic'} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: isMuted ? 'rgba(255,68,102,0.18)' : 'rgba(255,255,255,0.06)',
            color: isMuted ? '#FF4466' : 'rgba(255,255,255,0.4)',
            flexShrink: 0,
          }}>
            {isMuted ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mic level visualizer ── */}
      <div style={{
        padding: '8px 14px 7px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', gap: 9,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 8, fontFamily: 'monospace', color: isMuted ? 'rgba(255,68,102,0.5)' : 'rgba(255,255,255,0.22)', letterSpacing: '0.1em', width: 20, flexShrink: 0 }}>{isMuted ? 'MUTE' : 'MIC'}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 18 }}>
          {Array.from({ length: BAR_COUNT }, (_, i) => {
            const threshold = (i + 1) / BAR_COUNT;
            const active = audioLevel >= threshold;
            const barColor = audioLevel > 0.78 ? '#FF4466' : audioLevel > 0.45 ? '#F59E0B' : '#00FF88';
            const barH = 28 + i * 2.5;
            return (
              <div key={i} style={{
                flex: 1,
                height: `${barH}%`,
                borderRadius: 1,
                background: active ? barColor : 'rgba(255,255,255,0.055)',
                transition: 'background 0.04s ease',
              }} />
            );
          })}
        </div>
      </div>

      {/* ── Conversation ── */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lastEntries.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center', marginTop: 28, fontFamily: 'monospace', lineHeight: 1.7 }}>
            {isSessionActive ? 'Say "Hey Jack" to begin' : 'Start a session to begin'}
          </p>
        ) : (
          lastEntries.map((entry, i) => (
            <div key={i}>
              <div style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 3, color: entry.role === 'ai' ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.22)' }}>
                {entry.role === 'ai' ? 'ORACLE' : 'YOU'}
              </div>
              <p style={{
                fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word',
                color: entry.role === 'ai' ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.48)',
                padding: entry.role === 'ai' ? '7px 10px' : '3px 0',
                background: entry.role === 'ai' ? 'rgba(0,255,136,0.04)' : 'transparent',
                borderRadius: entry.role === 'ai' ? 8 : 0,
                borderLeft: entry.role === 'ai' ? '2px solid rgba(0,255,136,0.28)' : 'none',
              }}>
                {entry.text}
              </p>
            </div>
          ))
        )}

        {isThinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(59,130,246,0.07)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.18)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', animation: 'pip-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(59,130,246,0.75)', fontFamily: 'monospace' }}>Analyzing chart...</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.1)' }}>ORACLE AI · GOOGLE GEMINI</span>
      </div>
    </div>
  );
}

// ── Icon: picture-in-picture ──
function PiPIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <rect x="12" y="13" width="8" height="6" rx="1" fill="currentColor" stroke="none" opacity="0.6" />
    </svg>
  );
}

export function FloatingOracle(props: FloatingOracleProps) {
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const pipWinRef = useRef<Window | null>(null);

  const openPip = useCallback(async () => {
    // Close if already open
    if (pipWinRef.current) {
      pipWinRef.current.close();
      setPipWin(null);
      setContainer(null);
      pipWinRef.current = null;
      return;
    }

    const W = window as any;

    // ── Document Picture-in-Picture (Chrome 116+) ──
    if (W.documentPictureInPicture) {
      try {
        const pip: Window = await W.documentPictureInPicture.requestWindow({ width: 320, height: 480 });
        pip.document.title = 'Oracle';
        const s = pip.document.createElement('style');
        s.textContent = '* { box-sizing:border-box; margin:0; padding:0; } html,body { height:100%; overflow:hidden; background:#090c14; }';
        pip.document.head.appendChild(s);
        const div = pip.document.createElement('div');
        div.style.height = '100%';
        pip.document.body.appendChild(div);
        pipWinRef.current = pip;
        setPipWin(pip);
        setContainer(div);
        pip.addEventListener('pagehide', () => {
          setPipWin(null);
          setContainer(null);
          pipWinRef.current = null;
        });
        return;
      } catch (e) {
        console.warn('Document PiP failed, falling back to popup:', e);
      }
    }

    // ── Fallback: small always-on-top popup ──
    const popup = window.open('', 'oracle-float',
      'width=320,height=480,toolbar=0,menubar=0,scrollbars=0,location=0,status=0'
    );
    if (!popup) return;
    popup.document.title = 'Oracle';
    popup.document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#090c14;height:100%';
    const div = popup.document.createElement('div');
    div.style.height = '100%';
    popup.document.body.appendChild(div);
    pipWinRef.current = popup;
    setPipWin(popup);
    setContainer(div);
    popup.addEventListener('beforeunload', () => {
      setPipWin(null);
      setContainer(null);
      pipWinRef.current = null;
    });
  }, []);

  const isOpen = !!pipWin;

  return (
    <>
      <button
        onClick={openPip}
        title={isOpen ? 'Close floating Oracle panel' : 'Float Oracle — stays visible on other tabs'}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all border ${
          isOpen
            ? 'bg-oracle-green/10 border-oracle-green/30 text-oracle-green hover:bg-oracle-green/18'
            : 'bg-white/[0.04] border-white/8 text-white/45 hover:bg-white/8 hover:text-white/65'
        }`}
      >
        <PiPIcon />
        {isOpen ? 'Floating' : 'Float'}
      </button>

      {container && createPortal(<PiPContent {...props} />, container)}
    </>
  );
}
