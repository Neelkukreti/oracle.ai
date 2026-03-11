// Web Audio API tone generator — no external files needed

function playTone(freq: number, durationSec: number, volume = 0.1, type: OscillatorType = 'sine') {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSec + 0.05);
    osc.onended = () => ctx.close();
  } catch {}
}

// "Hey Oracle" detected — upward two-tone activation chime
export function playWakeBeep() {
  playTone(880, 0.12, 0.09);
  setTimeout(() => playTone(1100, 0.14, 0.07), 110);
}

// Oracle finished speaking — soft downward ready tone
export function playReadyBeep() {
  playTone(660, 0.14, 0.07);
  setTimeout(() => playTone(550, 0.18, 0.055), 130);
}
