'use client';

// GenGrid arena sound design (ported from the v4 mockup).
// Pure WebAudio — no assets. Everything is a no-op server-side, and the
// AudioContext is only created/resumed after a user gesture so autoplay
// policies never throw. Mute preference persists in localStorage.

const MUTE_KEY = 'gengrid-muted';

let actx: AudioContext | null = null;
let mutedState: boolean | null = null;
let ambientNodes: { osc: OscillatorNode; g: GainNode }[] = [];
const listeners = new Set<(muted: boolean) => void>();

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isMuted(): boolean {
  if (!isBrowser()) return true;
  if (mutedState === null) {
    mutedState = localStorage.getItem(MUTE_KEY) === '1';
  }
  return mutedState;
}

export function toggleMute(): boolean {
  mutedState = !isMuted();
  try {
    localStorage.setItem(MUTE_KEY, mutedState ? '1' : '0');
  } catch {
    // storage full/blocked — keep in-memory state
  }
  if (mutedState) stopAmbientPad(0.2);
  listeners.forEach((fn) => fn(mutedState!));
  return mutedState;
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ac(): AudioContext | null {
  if (!isBrowser()) return null;
  try {
    if (!actx) actx = new AudioContext();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, delay = 0, gain = 0.05, type: OscillatorType = 'sine') {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // audio unavailable — stay silent
  }
}

/** Countdown tick (3…2…1). */
export function tickSound() {
  tone(880, 0.12, 0, 0.045);
}

/** Match start. */
export function goSound() {
  tone(660, 0.6, 0, 0.06);
}

/** Cell select click. */
export function clickSound() {
  tone(1400, 0.05, 0, 0.02, 'square');
}

/** Submit chord. */
export function chordSound() {
  [523, 659, 784].forEach((f, i) => tone(f, 0.9, i * 0.03, 0.045));
}

/** A player joined the lobby (pitch varies a little per index). */
export function joinTone(i = 0) {
  tone(660 + (i % 6) * 40, 0.25, 0, 0.03);
}

/** Low ambient pad for the lobby. Safe to call repeatedly. */
export function startAmbientPad() {
  if (isMuted()) return;
  const c = ac();
  if (!c || ambientNodes.length > 0) return;
  try {
    [220, 277, 330].forEach((f, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.012, c.currentTime + 1.2 + i * 0.2);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      ambientNodes.push({ osc, g });
    });
  } catch {
    ambientNodes = [];
  }
}

export function stopAmbientPad(fadeSec = 0.4) {
  const c = actx;
  if (!c) {
    ambientNodes = [];
    return;
  }
  ambientNodes.forEach((n) => {
    try {
      n.g.gain.cancelScheduledValues(c.currentTime);
      n.g.gain.setValueAtTime(n.g.gain.value, c.currentTime);
      n.g.gain.linearRampToValueAtTime(0.0001, c.currentTime + fadeSec);
      n.osc.stop(c.currentTime + fadeSec + 0.1);
    } catch {
      // node already stopped
    }
  });
  ambientNodes = [];
}

/**
 * Prime the AudioContext on the first user gesture anywhere on the page.
 * Call once from a top-level client component.
 */
export function primeAudioOnGesture() {
  if (!isBrowser()) return () => {};
  const handler = () => {
    if (!isMuted()) ac();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
}
