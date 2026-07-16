'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { loadPlayerSession } from '@/lib/player-session';
import { joinTone } from '@/lib/sound';

type StatusPayload = {
  status: 'waiting' | 'scheduled' | 'live' | 'finished';
  room_name: string;
  player_count: number;
  starts_at: string | null;
  ends_at: string | null;
  recent_players?: string[];
};

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();
  const router = useRouter();

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Names in stable join order (oldest first) for the orbit stage.
  const [players, setPlayers] = useState<string[]>([]);
  const knownRef = useRef<Set<string>>(new Set());
  // Tapped avatar's name (mobile has no hover, so tap reveals a name pill;
  // it auto-hides after a moment).
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealName = (name: string) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealed(name);
    revealTimerRef.current = setTimeout(() => setRevealed(null), 2000);
  };

  useEffect(() => {
    if (!loadPlayerSession(roomCode)) {
      router.replace('/join');
      return;
    }
    // Theme song is owned by ArenaChrome (plays across all player pages).
  }, [roomCode, router]);

  usePolling(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/status`);
      if (!res.ok) {
        setError('Room not found');
        return;
      }
      const data: StatusPayload = await res.json();
      setStatus(data);
      // recent_players arrives newest-first; append unseen names in join
      // order so existing avatars keep their spots and new ones pop in.
      const incoming = [...(data.recent_players ?? [])].reverse();
      const fresh = incoming.filter((n) => !knownRef.current.has(n));
      if (fresh.length > 0) {
        fresh.forEach((n, i) => {
          knownRef.current.add(n);
          joinTone(knownRef.current.size + i);
        });
        setPlayers((prev) => [...prev, ...fresh]);
      }
      if (data.status === 'scheduled' || data.status === 'live') {
        router.replace(`/play/${roomCode}`);
      }
    } catch {
      setError('Network error');
    }
  }, 5000);

  const me = typeof window !== 'undefined' ? loadPlayerSession(roomCode)?.username : undefined;
  const n = Math.max(players.length, 1);

  const rulesCard = (
    <div className="glass-card w-full max-w-xs px-6 py-5 text-left">
      <p className="kicker mb-3">How to Play</p>
      <ol className="space-y-2.5 text-[0.8rem] leading-relaxed text-[#94A3B8]">
        <li><span className="font-semibold text-[#F8FAFC]">1.</span> When the host starts, everyone gets the same crossword at the same time.</li>
        <li><span className="font-semibold text-[#F8FAFC]">2.</span> Tap a square and type. Tap it again to switch between across and down.</li>
        <li><span className="font-semibold text-[#F8FAFC]">3.</span> Beat the clock. Submit before the timer hits 00:00, or your answers submit automatically.</li>
        <li><span className="font-semibold text-[#F8FAFC]">4.</span> Stay on the game screen. Leaving for 45+ seconds locks in your answers as-is.</li>
        <li><span className="font-semibold text-[#F8FAFC]">5.</span> Most correct answers wins. Fastest time breaks ties. Leaderboard unlocks when the round ends.</li>
        <li><span className="font-semibold text-[#F8FAFC]">6.</span> Do not submit per question. Submit only once, when you are done filling the entire board.</li>
      </ol>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      <div className="kicker mb-2">Arena · {roomCode}</div>
      <h1 className="font-sg mb-8 text-3xl font-semibold tracking-tight text-[#F8FAFC]">
        {status?.room_name ?? 'Competitors Assembling'}
      </h1>

      {error && <p className="mb-4 text-[#FF6B81]">{error}</p>}

      <div className="flex items-center justify-center gap-12">
        {/* Rules sit beside the orbit on desktop; on mobile they open from a
            button below (no hover, limited width). */}
        <div className="hidden lg:block">{rulesCard}</div>
        <div>

      <div className="orbit-stage mb-7">
        <div className="orbit-ring" />
        <div className="orbit-ring r2" />
        <div className="orbit-core">
          <span className="font-sg grad-shimmer text-2xl font-bold">
            GG
          </span>
        </div>
        {players.map((name, i) => {
          const angle = ((-90 + (360 / n) * i) * Math.PI) / 180;
          const x = 150 + 108 * Math.cos(angle);
          const y = 150 + 108 * Math.sin(angle);
          return (
            <button
              key={name}
              type="button"
              className={`orbit-avatar${name === me ? ' host' : ''}`}
              style={{ left: x, top: y }}
              title={name}
              onClick={() => revealName(name)}
            >
              {name.charAt(0).toUpperCase()}
              {revealed === name && <span className="orbit-name">{name}</span>}
            </button>
          );
        })}
      </div>

      <p className="font-arena-mono mb-1.5 text-xs tracking-[0.1em] text-[#94A3B8]">
        {status ? `${status.player_count} competitor${status.player_count === 1 ? '' : 's'} in the arena` : '···'}
      </p>
      <p className="font-arena-mono flex items-center justify-center gap-2 text-[0.66rem] tracking-[0.1em] text-[#5B7194]">
        <span className="wait-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
        Waiting for the host to begin
        <span className="wait-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
      {/* Mobile/tablet: no room beside the orbit, so the rules open from a
          button into a temporary overlay. */}
      <button
        type="button"
        onClick={() => setShowRules(true)}
        className="mt-5 rounded-full border border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.12)] px-5 py-2 text-sm font-semibold text-[#F8FAFC] lg:hidden"
      >
        How to play
      </button>
      </div>
      </div>

      <p className="mt-8 max-w-sm text-xs text-[#5B7194]">
        The match starts automatically once the admin begins the room.
      </p>

      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,22,0.8)] px-6 backdrop-blur-sm lg:hidden"
          onClick={() => setShowRules(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            {rulesCard}
            <button
              type="button"
              onClick={() => setShowRules(false)}
              aria-label="Close rules"
              className="absolute right-3 top-3 text-lg text-[#94A3B8]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
