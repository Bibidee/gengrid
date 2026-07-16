'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  startsAt: string | null;
  endsAt: string | null;
  /**
   * Clock-skew correction (ms) to add to Date.now() so the countdown tracks
   * the SERVER clock, not the (possibly wrong) device clock. Computed by the
   * caller from the `server_now` field of API responses via
   * computeClockOffsetMs, refreshed on each poll.
   */
  offsetMs?: number;
  onExpire?: () => void;
  /** Render as a circular HUD ring (arena play header). */
  ring?: boolean;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Purely local countdown UI — ticks every second in the browser, but the
 * only source of truth for "when does time run out" is the server's
 * starts_at/ends_at timestamps, read against server-corrected time.
 * No network calls happen here.
 */
export function Countdown({ startsAt, endsAt, offsetMs = 0, onExpire, ring = false }: Props) {
  const [localNow, setLocalNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = localNow + offsetMs;
  const isExpired = endsAt != null && now >= new Date(endsAt).getTime();

  useEffect(() => {
    if (isExpired && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [isExpired, onExpire]);

  if (!startsAt || !endsAt) return null;

  const startsAtMs = new Date(startsAt).getTime();
  const endsAtMs = new Date(endsAt).getTime();

  if (now < startsAtMs) {
    return (
      <div className="font-arena-mono text-lg font-semibold text-[#94A3B8]">
        Starting in {formatDuration(startsAtMs - now)}
      </div>
    );
  }

  const remaining = endsAtMs - now;
  const urgent = remaining < 30_000;

  if (ring) {
    const total = Math.max(1, endsAtMs - startsAtMs);
    const pct = Math.max(0, Math.min(1, remaining / total));
    const CIRC = 169.6; // 2πr, r=27
    const stroke = pct > 0.5 ? 'url(#gg-tg)' : pct > 0.25 ? '#F6C453' : '#FF6B81';
    return (
      <div className="relative h-16 w-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth="4" />
          <circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90 32 32)"
          />
          <defs>
            <linearGradient id="gg-tg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#67E8F9" />
            </linearGradient>
          </defs>
        </svg>
        <div className="font-arena-mono absolute inset-0 flex items-center justify-center text-sm text-[#F8FAFC]">
          {remaining > 0 ? formatDuration(remaining) : '0:00'}
        </div>
      </div>
    );
  }

  return (
    <div className={`font-arena-mono text-lg font-semibold ${urgent ? 'text-[#FF6B81]' : 'text-[#F8FAFC]'}`}>
      {remaining > 0 ? formatDuration(remaining) : "Time's up"}
    </div>
  );
}
