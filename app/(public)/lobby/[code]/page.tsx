'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { loadPlayerSession } from '@/lib/player-session';
import { startMusic, stopMusic, joinTone } from '@/lib/sound';

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
    // GenGrid theme song while waiting; stops when the match starts (unmount)
    // and obeys the global mute toggle.
    startMusic();
    return () => stopMusic();
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      <div className="kicker mb-2">Arena · {roomCode}</div>
      <h1 className="font-sg mb-8 text-3xl font-semibold tracking-tight text-[#F8FAFC]">
        {status?.room_name ?? 'Competitors Assembling'}
      </h1>

      {error && <p className="mb-4 text-[#FF6B81]">{error}</p>}

      <div className="orbit-stage mb-7">
        <div className="orbit-ring" />
        <div className="orbit-ring r2" />
        <div className="orbit-core">
          <span className="font-sg bg-gradient-to-br from-[#A79BFF] via-[#D9A8FF] to-[#6EE7F9] bg-clip-text text-2xl font-bold text-transparent">
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

      <p className="font-arena-mono mb-1.5 text-xs tracking-[0.1em] text-[#9CA3B8]">
        {status ? `${status.player_count} competitor${status.player_count === 1 ? '' : 's'} in the arena` : '···'}
      </p>
      <p className="font-arena-mono flex items-center justify-center gap-2 text-[0.66rem] tracking-[0.1em] text-[#64607A]">
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
      <p className="mt-8 max-w-sm text-xs text-[#64607A]">
        The match starts automatically once the admin begins the room.
      </p>
    </main>
  );
}
