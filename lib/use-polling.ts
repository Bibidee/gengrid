'use client';

import { useEffect, useRef } from 'react';

/**
 * Polls `callback` on `intervalMs`, with a random 0-2000ms jitter applied
 * to EVERY poll (not just the first) to avoid synchronized request bursts
 * across many concurrent clients. Set `enabled=false` to pause.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      callbackRef.current();
      const jitter = Math.random() * 2000;
      timeoutId = setTimeout(tick, intervalMs + jitter);
    };

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [intervalMs, enabled]);
}
