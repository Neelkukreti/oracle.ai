'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Monitor, MonitorOff } from 'lucide-react';

interface ScreenShareProps {
  onFrame: (data: string, width: number, height: number) => void;
  onStream?: (stream: MediaStream | null) => void;
  fps?: number;
  quality?: number;
}

export function ScreenShare({ onFrame, onStream, fps = 3, quality = 0.7 }: ScreenShareProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64Data = dataUrl.split(',')[1];
    onFrame(base64Data, canvas.width, canvas.height);
  }, [onFrame, quality]);

  const startCapture = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: fps } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const interval = window.setInterval(captureFrame, 1000 / fps);
      intervalRef.current = interval;
      setIsSharing(true);
      onStream?.(stream);

      stream.getVideoTracks()[0].addEventListener('ended', () => stopCapture());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start screen sharing');
    }
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsSharing(false);
    onStream?.(null);
  };

  useEffect(() => () => stopCapture(), []);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={isSharing ? stopCapture : startCapture}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
          isSharing
            ? 'bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30'
            : 'bg-oracle-green/10 border border-oracle-green/30 text-oracle-green hover:bg-oracle-green/20'
        }`}
      >
        {isSharing ? (
          <>
            <MonitorOff className="w-4 h-4" />
            Stop Sharing
          </>
        ) : (
          <>
            <Monitor className="w-4 h-4" />
            Share Screen
          </>
        )}
      </button>

      {isSharing && (
        <div className="flex items-center gap-2 text-oracle-green text-xs">
          <span className="w-2 h-2 bg-oracle-green rounded-full animate-pulse" />
          Live @ {fps} FPS
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
