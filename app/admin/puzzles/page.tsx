'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Puzzle = {
  id: string;
  title: string;
  board_size: number;
  difficulty: string | null;
  status: 'draft' | 'ready' | 'archived';
  created_at: string;
};

export default function PuzzlesPage() {
  const { loading: authLoading } = useAdminSession();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      setLoading(true);
      const qs = status ? `?status=${status}` : '';
      const res = await adminFetch(`/api/admin/puzzles${qs}`);
      const data = await res.json();
      setPuzzles(data.puzzles ?? []);
      setLoading(false);
    })();
  }, [authLoading, status]);

  if (authLoading) return null;

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    ready: 'bg-green-100 text-green-700',
    archived: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Puzzles</h1>
          <Link
            href="/admin/puzzles/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            New Puzzle
          </Link>
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mb-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="archived">Archived</option>
        </select>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {puzzles.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link href={`/admin/puzzles/${p.id}/edit`} className="text-slate-900 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {p.board_size}x{p.board_size}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {puzzles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No puzzles found
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
