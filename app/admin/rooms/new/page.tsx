'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';
import { generateRoomCode } from '@/lib/room-code';

type Puzzle = { id: string; title: string; board_size: number };

export default function NewRoomPage() {
  const { loading: authLoading } = useAdminSession();
  const router = useRouter();

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [puzzleId, setPuzzleId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState(generateRoomCode());
  const [duration, setDuration] = useState(600);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const res = await adminFetch('/api/admin/puzzles?status=ready');
      const data = await res.json();
      setPuzzles(data.puzzles ?? []);
    })();
  }, [authLoading]);

  async function handleCreate() {
    if (!roomName.trim() || !puzzleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/rooms', {
        method: 'POST',
        body: JSON.stringify({
          room_name: roomName.trim(),
          puzzle_id: puzzleId,
          duration_seconds: duration,
          room_code: roomCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create room');
        return;
      }
      router.push(`/admin/rooms/${data.id}/control`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">New Room</h1>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Room name</label>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ready puzzle</label>
            <select
              value={puzzleId}
              onChange={(e) => setPuzzleId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a puzzle…</option>
              {puzzles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.board_size}x{p.board_size})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Duration (seconds)</label>
            <input
              type="number"
              min={60}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Room code</label>
            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase tracking-widest"
              />
              <button
                onClick={() => setRoomCode(generateRoomCode())}
                className="rounded-md bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                Regenerate
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={!roomName.trim() || !puzzleId || saving}
            className="rounded-md bg-slate-900 px-6 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create room'}
          </button>
        </div>
      </main>
    </div>
  );
}
