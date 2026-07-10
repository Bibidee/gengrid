'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Room = {
  id: string;
  room_name: string;
  room_code: string;
  status: 'waiting' | 'scheduled' | 'live' | 'finished';
  duration_seconds: number;
  created_at: string;
};

export default function RoomsPage() {
  const { loading: authLoading } = useAdminSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const res = await adminFetch('/api/admin/rooms');
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setLoading(false);
    })();
  }, [authLoading]);

  if (authLoading) return null;

  const statusColor: Record<string, string> = {
    waiting: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-blue-100 text-blue-700',
    live: 'bg-green-100 text-green-700',
    finished: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <Link
            href="/admin/rooms/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            New Room
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link href={`/admin/rooms/${r.id}/control`} className="text-slate-900 hover:underline">
                        {r.room_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono">{r.room_code}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No rooms found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
