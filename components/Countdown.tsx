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
export function Countdown({ startsAt, endsAt, offsetMs = 0, onExpire }: Props) {
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
      <div className="text-lg font-mono font-semibold text-slate-700">
        Starting in {formatDuration(startsAtMs - now)}
      </div>
    );
  }

  const remaining = endsAtMs - now;
  const urgent = remaining < 30_000;

  return (
    <div className={`text-lg font-mono font-semibold ${urgent ? 'text-red-600' : 'text-slate-700'}`}>
      {remaining > 0 ? formatDuration(remaining) : "Time's up"}
    </div>
  );
}
