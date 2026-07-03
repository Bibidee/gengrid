// Client clock skew correction.
//
// Device clocks can be minutes off, so any countdown computed as
// `ends_at - Date.now()` is wrong on those devices. Every status/play/
// leaderboard response includes the server's current time (`server_now`);
// the client computes an offset at receipt and derives all countdowns from
// corrected time. The server-side 425 leaderboard gate remains the source
// of truth regardless.

/**
 * Offset (ms) to ADD to the local clock to approximate the server clock:
 * correctedNow = Date.now() + offset.
 */
export function computeClockOffsetMs(
  serverNowIso: string | null | undefined,
  localNowMs: number = Date.now()
): number {
  if (!serverNowIso) return 0;
  const serverMs = new Date(serverNowIso).getTime();
  if (Number.isNaN(serverMs)) return 0;
  return serverMs - localNowMs;
}

/** Server-corrected "now" in ms. */
export function correctedNowMs(offsetMs: number, localNowMs: number = Date.now()): number {
  return localNowMs + offsetMs;
}

/** Milliseconds remaining until an ISO deadline, using corrected time. */
export function remainingMs(
  endsAtIso: string,
  offsetMs: number,
  localNowMs: number = Date.now()
): number {
  return new Date(endsAtIso).getTime() - correctedNowMs(offsetMs, localNowMs);
}
