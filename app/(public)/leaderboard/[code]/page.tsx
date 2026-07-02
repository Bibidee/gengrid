'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { Leaderboard, type LeaderboardEntry } from '@/components/Leaderboard';
import { loadPlayerSession } from '@/lib/player-session';

const POLL_WINDOW_MS = 90_000;

export default function LeaderboardPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [caller, setCaller] = useState<{ rank: number; username: string; score: number | null } | undefined>();
  const [username, setUsername] = useState<string | undefined>();
  const [pollingEnabled, setPollingEnabled] = useState(true);

  useEffect(() => {
    // localStorage only exists client-side, so this must run in an effect
    // rather than a lazy useState initializer (which would mismatch SSR output).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(loadPlayerSession(roomCode)?.username);
    const timeout = setTimeout(() => setPollingEnabled(false), POLL_WINDOW_MS);
    return () => clearTimeout(timeout);
  }, [roomCode]);

  usePolling(
    async () => {
      const session = loadPlayerSession(roomCode);
      const qs = session ? `?session_token=${encodeURIComponent(session.session_token)}` : '';
      const res = await fetch(`/api/rooms/${roomCode}/leaderboard${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.leaderboard ?? []);
      setCaller(data.caller);
    },
    5000,
    pollingEnabled
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Leaderboard</h1>
        <p className="mb-6 text-sm text-slate-500">Room {roomCode}</p>
        <Leaderboard entries={entries} caller={caller} highlightUsername={username} />
      </div>
    </main>
  );
}
