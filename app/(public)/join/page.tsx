'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { savePlayerSession } from '@/lib/player-session';

export default function JoinPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: roomCode, username }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to join room');
        return;
      }

      savePlayerSession({
        session_token: data.session_token,
        player_id: data.player_id,
        username: username.trim(),
        room_code: roomCode.trim().toUpperCase(),
      });

      router.push(`/lobby/${roomCode.trim().toUpperCase()}`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-900">Join a game</h1>

        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="e.g. validator42"
          />
        </div>

        <div>
          <label htmlFor="roomCode" className="mb-1 block text-sm font-medium text-slate-700">
            Room code
          </label>
          <input
            id="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={7}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-slate-500"
            placeholder="e.g. AB3CDE"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
      </form>
    </main>
  );
}
