'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';
import { usePolling } from '@/lib/use-polling';

type RoomDetail = {
  id: string;
  room_name: string;
  room_code: string;
  status: 'waiting' | 'scheduled' | 'live' | 'finished';
  duration_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  puzzles: { title: string } | { title: string }[] | null;
};

type LeaderboardRow = {
  id: string;
  username: string;
  status: 'joined' | 'active' | 'submitted';
  joined_at: string;
};

export default function RoomControlPage() {
  const { loading: authLoading } = useAdminSession();
  const params = useParams<{ id: string }>();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [players, setPlayers] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);

  const loadRoom = useCallback(async () => {
    const res = await adminFetch(`/api/admin/rooms/${params.id}`);
    if (res.ok) setRoom(await res.json());
  }, [params.id]);

  useEffect(() => {
    if (authLoading) return;
    // Initial data fetch on mount, refreshed again after Start/End actions
    // via the same function — standard fetch-on-mount, not derivable state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRoom();
  }, [authLoading, loadRoom]);

  usePolling(
    async () => {
      const res = await adminFetch(`/api/admin/rooms/${params.id}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.leaderboard ?? []);
      }
    },
    4000,
    !authLoading
  );

  async function handleStart() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/rooms/${params.id}/start`, { method: 'POST' });
      await loadRoom();
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/rooms/${params.id}/end`, { method: 'POST' });
      await loadRoom();
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !room) return null;

  const submittedCount = players.filter((p) => p.status === 'submitted').length;
  const puzzleTitle = Array.isArray(room.puzzles) ? room.puzzles[0]?.title : room.puzzles?.title;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold text-slate-900">{room.room_name}</h1>
        <p className="mb-6 text-sm text-slate-500">
          Code <span className="font-mono font-semibold">{room.room_code}</span> · {puzzleTitle} · status{' '}
          <span className="font-semibold">{room.status}</span>
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-500">Players joined</p>
            <p className="text-3xl font-black text-slate-900">{players.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-500">Submitted</p>
            <p className="text-3xl font-black text-slate-900">{submittedCount}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Who&apos;s in the room
          </p>
          {players.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No one has joined yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="font-medium text-slate-900">{p.username}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === 'submitted'
                          ? 'bg-green-100 text-green-700'
                          : p.status === 'active'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleStart}
            disabled={busy || room.status !== 'waiting'}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-40"
          >
            Start room
          </button>
          <button
            onClick={handleEnd}
            disabled={busy || room.status === 'finished'}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            End room
          </button>
          <Link
            href={`/admin/rooms/${room.id}/submissions`}
            className="rounded-md bg-white px-5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            View leaderboard
          </Link>
        </div>
      </main>
    </div>
  );
}
