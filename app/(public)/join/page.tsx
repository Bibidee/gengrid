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
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-md px-8 py-10 text-center sm:px-12">
        <h1 className="font-sg text-2xl font-semibold tracking-tight text-[#F8FAFC]">Join a Match</h1>
        <p className="mb-9 mt-2 text-sm font-light text-[#94A3B8]">
          Enter your arena code and competitor name.
        </p>

        <div className="mb-5 text-left">
          <label htmlFor="roomCode" className="input-lbl">
            Arena Code
          </label>
          <input
            id="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={7}
            required
            className="arena-input uppercase tracking-[0.07em]"
            placeholder="AB3CDE"
          />
        </div>

        <div className="text-left">
          <label htmlFor="username" className="input-lbl">
            Competitor Name
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            required
            className="arena-input"
            placeholder="Your name"
          />
        </div>

        {error && <p className="mt-4 text-sm text-[#FF6B81]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-arena-primary mt-8 w-full px-8 py-3.5 text-base"
        >
          {loading ? 'Joining…' : 'Enter Arena →'}
        </button>
      </form>
    </main>
  );
}
