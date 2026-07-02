'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePolling } from '@/lib/use-polling';
import { loadPlayerSession } from '@/lib/player-session';

type StatusPayload = {
  status: 'waiting' | 'scheduled' | 'live' | 'finished';
  room_name: string;
  player_count: number;
  starts_at: string | null;
  ends_at: string | null;
};

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();
  const router = useRouter();

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadPlayerSession(roomCode)) {
      router.replace('/join');
    }
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
      if (data.status === 'scheduled' || data.status === 'live') {
        router.replace(`/play/${roomCode}`);
      }
    } catch {
      setError('Network error');
    }
  }, 5000);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">{status?.room_name ?? 'Waiting room'}</h1>
      <p className="text-slate-500">Room code: <span className="font-mono font-semibold">{roomCode}</span></p>

      {error && <p className="text-red-600">{error}</p>}

      <div className="rounded-lg border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-sm text-slate-500">Players waiting</p>
        <p className="text-4xl font-black text-slate-900">{status?.player_count ?? '—'}</p>
      </div>

      <p className="text-sm text-slate-400">The game will start automatically once the admin begins the room.</p>
    </main>
  );
}
