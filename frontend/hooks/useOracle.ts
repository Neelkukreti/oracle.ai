'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ClientMessage, ServerMessage, TradingAnalysis } from '@/lib/types';

export interface ConversationEntry {
  role: 'ai' | 'user';
  text: string;
  timestamp: number;
}

export interface UseOracleReturn {
  isConnected: boolean;
  status: string;
  sendAudioChunk: (data: string) => void;
  sendFrame: (data: string, width: number, height: number) => void;
  sendQuestion: (text: string, symbol?: string, interval?: string) => void;
  start: () => void;
  stop: () => void;
  latestAnalysis: TradingAnalysis | null;
  conversation: ConversationEntry[];
  latestSpeech: string | null;
}

export function useOracle(url: string): UseOracleReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [latestAnalysis, setLatestAnalysis] = useState<TradingAnalysis | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [latestSpeech, setLatestSpeech] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    sessionIdRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pre-load best available voice once (Chrome Google voices > macOS Premium > fallback)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const en = voices.filter((v) => v.lang.startsWith('en'));
      voiceRef.current =
        en.find((v) => v.name === 'Google US English') ||
        en.find((v) => v.name === 'Google UK English Female') ||
        en.find((v) => v.name.includes('(Premium)')) ||
        en.find((v) => v.name.includes('(Enhanced)')) ||
        en.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
        en.find((v) => v.lang === 'en-US') ||
        voices[0] ||
        null;
    };
    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return;

    // Optional: ElevenLabs if key is set
    const ELEVENLABS_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (ELEVENLABS_KEY) {
      try {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        const res = await fetch(
          'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
          {
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
            }),
          }
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play();
          return;
        }
      } catch {}
    }

    // Browser TTS — use pre-loaded Google/Premium voice
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.97;
    utterance.pitch = 1.0;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatus('Connected');
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('Failed to parse server message:', error);
      }
    };

    ws.onerror = () => setStatus('Error');
    ws.onclose = () => {
      setIsConnected(false);
      setStatus('Disconnected');
    };

    return () => ws.close();
  }, [url]);

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case 'analysis':
          setLatestAnalysis(message.data);
          break;

        case 'speech_text': {
          const text = message.text;
          setLatestSpeech(text);
          setConversation((prev) => [
            ...prev,
            { role: 'ai', text, timestamp: Date.now() },
          ]);
          speakText(text);
          break;
        }

        case 'status':
          setStatus(message.status);
          break;

        case 'log':
          if (message.level === 'error') {
            console.error('[Oracle]', message.message);
          }
          break;
      }
    },
    [speakText]
  );

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudioChunk = useCallback(
    (data: string) => sendMessage({ type: 'audio_chunk', data, timestamp: Date.now() }),
    [sendMessage]
  );

  const sendFrame = useCallback(
    (data: string, width: number, height: number) =>
      sendMessage({ type: 'frame', data, width, height, timestamp: Date.now() }),
    [sendMessage]
  );

  const sendQuestion = useCallback(
    (text: string, symbol?: string, interval?: string) => {
      setConversation((prev) => [...prev, { role: 'user', text, timestamp: Date.now() }]);
      sendMessage({ type: 'question', text, timestamp: Date.now(), symbol, interval });
    },
    [sendMessage]
  );

  const start = useCallback(() => {
    setConversation([]);
    setLatestAnalysis(null);
    setLatestSpeech(null);
    sendMessage({ type: 'start', sessionId: sessionIdRef.current });
  }, [sendMessage]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    sendMessage({ type: 'stop', sessionId: sessionIdRef.current });
  }, [sendMessage]);

  return {
    isConnected,
    status,
    sendAudioChunk,
    sendFrame,
    sendQuestion,
    start,
    stop,
    latestAnalysis,
    conversation,
    latestSpeech,
  };
}
