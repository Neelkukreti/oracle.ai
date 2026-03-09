'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, MicOff, WifiOff } from 'lucide-react';

// Errors that are transient / not user-actionable — swallow silently
const SILENT_ERRORS = new Set(['network', 'service-not-allowed', 'no-speech', 'aborted']);

// Backoff delays (ms) indexed by consecutive error count
const BACKOFF = [300, 800, 2000, 5000, 10000];

interface AudioVoiceProps {
  onAudioChunk: (data: string) => void;
  onUserSpeech?: (text: string) => void;
}

export function AudioVoice({ onAudioChunk, onUserSpeech }: AudioVoiceProps) {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [voiceDegraded, setVoiceDegraded] = useState(false); // persistent network issues
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const errorCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMic = async () => {
    try {
      setError(null);
      setVoiceDegraded(false);
      stoppedRef.current = false;
      errorCountRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });

      mediaStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        onAudioChunk(btoa(binary));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      startRecognition();
      setIsMicActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  };

  const scheduleRestart = (recognition: any) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const delay = BACKOFF[Math.min(errorCountRef.current, BACKOFF.length - 1)];
    retryTimerRef.current = setTimeout(() => {
      if (!stoppedRef.current && mediaStreamRef.current) {
        try { recognition.start(); } catch {}
      }
    }, delay);
  };

  const startRecognition = () => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition || !onUserSpeech) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      errorCountRef.current = 0; // successful start resets backoff
      setVoiceDegraded(false);
    };

    recognition.onresult = (e: any) => {
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      }
      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();
        setLastTranscript(text);
        onUserSpeech(text);
      }
    };

    recognition.onerror = (e: any) => {
      if (SILENT_ERRORS.has(e.error)) {
        // Count consecutive network-type errors to detect persistent degradation
        if (e.error === 'network' || e.error === 'service-not-allowed') {
          errorCountRef.current++;
          if (errorCountRef.current >= 3) setVoiceDegraded(true);
        }
        return;
      }
      // Surface non-transient errors (not-allowed, audio-capture, etc.)
      setError(`Voice: ${e.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!stoppedRef.current && mediaStreamRef.current) {
        scheduleRestart(recognition);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopMic = () => {
    stoppedRef.current = true;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsMicActive(false);
    setIsListening(false);
    setLastTranscript('');
    setVoiceDegraded(false);
    setError(null);
    errorCountRef.current = 0;
  };

  useEffect(() => () => stopMic(), []);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={isMicActive ? stopMic : startMic}
        title={voiceDegraded ? 'Voice degraded — type instead' : undefined}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
          isMicActive
            ? voiceDegraded
              ? 'bg-oracle-yellow/10 border border-oracle-yellow/30 text-oracle-yellow/80 hover:bg-oracle-yellow/20'
              : 'bg-oracle-green/15 border border-oracle-green/35 text-oracle-green hover:bg-oracle-green/25'
            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
        }`}
      >
        {isMicActive ? (
          voiceDegraded ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
          )
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        {isMicActive
          ? voiceDegraded
            ? 'Voice↓'
            : isListening
            ? 'Listening...'
            : 'Mic On'
          : 'Mic'}
      </button>

      {lastTranscript && !voiceDegraded && (
        <p className="text-[10px] text-oracle-green/65 truncate max-w-[140px]" title={lastTranscript}>
          "{lastTranscript}"
        </p>
      )}

      {error && (
        <p className="text-[10px] text-red-400/80">{error}</p>
      )}
    </div>
  );
}
