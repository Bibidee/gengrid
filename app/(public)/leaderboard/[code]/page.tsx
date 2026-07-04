'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { Leaderboard, type LeaderboardEntry } from '@/components/Leaderboard';
import { Countdown } from '@/components/Countdown';
import { loadPlayerSession } from '@/lib/player-session';
import { computeClockOffsetMs } from '@/lib/clock';
import Link from 'next/link';

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
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

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
          if (data.server_now) setClockOffsetMs(computeClockOffsetMs(data.server_now));
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
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <div className="kicker mb-2">Arena · {roomCode}</div>
          <h1 className="font-sg text-3xl font-semibold tracking-tight text-[#F8FAFC]">Final Standings</h1>
        </div>

        {view.kind === 'loading' && (
          <p className="font-arena-mono text-center text-sm text-[#9CA3B8]">Loading…</p>
        )}

        {view.kind === 'error' && <p className="text-center text-[#FF6B81]">{view.message}</p>}

        {view.kind === 'not_ended' && (
          <div className="glass-card flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="font-light text-[#9CA3B8]">
              The round is still in progress. The leaderboard unlocks when the timer reaches 00:00.
            </p>
            {view.ends_at && (
              <Countdown startsAt={new Date(0).toISOString()} endsAt={view.ends_at} offsetMs={clockOffsetMs} />
            )}
          </div>
        )}

        {view.kind === 'finalizing' && (
          <div className="glass-card px-6 py-10 text-center font-light text-[#9CA3B8]">
            Calculating final results…
          </div>
        )}

        {view.kind === 'final' && (
          <>
            {view.entries.length >= 3 && (
              <div className="mb-6 flex items-end justify-center gap-3">
                {[view.entries[1], view.entries[0], view.entries[2]].map((e, i) => {
                  const cls = i === 1 ? 'pc-1 pb-7' : i === 0 ? 'pc-2' : 'pc-3';
                  const medal = i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉';
                  const scoreColor = i === 1 ? 'text-[#F6C453]' : i === 0 ? 'text-[#C0C7D1]' : 'text-[#C08A5A]';
                  const label = i === 1 ? 'Champion' : i === 0 ? '2nd Place' : '3rd Place';
                  return (
                    <div key={e.player_id} className={`podium-card ${cls} max-w-[160px] flex-1 px-3 py-5 text-center`}>
                      <div className="mb-1.5 text-3xl">{medal}</div>
                      <div className="font-arena-mono mb-1 text-[0.58rem] uppercase tracking-[0.14em] text-[#64607A]">
                        {label}
                      </div>
                      <div className="font-sg mb-1 truncate text-base font-semibold text-[#F8FAFC]">{e.username}</div>
                      <div className={`font-arena-mono text-xl font-medium ${scoreColor}`}>{e.score}</div>
                      {e.correct_words != null && e.total_words != null && (
                        <div className="mt-1 text-[0.7rem] text-[#64607A]">
                          {e.correct_words}/{e.total_words} words
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Leaderboard entries={view.entries} highlightUsername={username} />
            {username && (
              <div className="mt-6 text-center">
                <Link href={`/review/${roomCode}`} className="btn-arena-ghost inline-block px-6 py-2.5 text-sm no-underline">
                  View your board
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
