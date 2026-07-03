'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { Leaderboard, type LeaderboardEntry } from '@/components/Leaderboard';
import { Countdown } from '@/components/Countdown';
import { loadPlayerSession } from '@/lib/player-session';

type View =
  | { kind: 'loading' }
  | { kind: 'not_ended'; ends_at: string | null }
  | { kind: 'finalizing' }
  | { kind: 'final'; entries: LeaderboardEntry[] }
  | { kind: 'error'; message: string };

export default function LeaderboardPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();

  const [view, setView] = useState<View>({ kind: 'loading' });
  const [username, setUsername] = useState<string | undefined>();

  useEffect(() => {
    // localStorage only exists client-side, so this must run in an effect
    // rather than a lazy useState initializer (which would mismatch SSR output).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(loadPlayerSession(roomCode)?.username);
  }, [roomCode]);

  // Poll until the final leaderboard arrives, then stop — it never changes.
  const done = view.kind === 'final' || view.kind === 'error';

  usePolling(
    async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/leaderboard`);
        const data = await res.json();
        if (res.status === 404) {
          setView({ kind: 'error', message: 'Room not found' });
          return;
        }
        if (data.ended === false) {
          setView({ kind: 'not_ended', ends_at: data.ends_at ?? null });
          return;
        }
        if (data.finalizing) {
          setView({ kind: 'finalizing' });
          return;
        }
        if (res.ok && Array.isArray(data.leaderboard)) {
          setView({ kind: 'final', entries: data.leaderboard });
        }
      } catch {
        // transient network error — keep polling
      }
    },
    5000,
    !done
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Leaderboard</h1>
        <p className="mb-6 text-sm text-slate-500">Room {roomCode}</p>

        {view.kind === 'loading' && <p className="text-slate-500">Loading…</p>}

        {view.kind === 'error' && <p className="text-red-600">{view.message}</p>}

        {view.kind === 'not_ended' && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-slate-600">
              The round is still in progress. The leaderboard unlocks when the timer reaches 00:00.
            </p>
            {view.ends_at && (
              <Countdown startsAt={new Date(0).toISOString()} endsAt={view.ends_at} />
            )}
          </div>
        )}

        {view.kind === 'finalizing' && (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
            Calculating final results…
          </div>
        )}

        {view.kind === 'final' && <Leaderboard entries={view.entries} highlightUsername={username} />}
      </div>
    </main>
  );
}
