'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Template = {
  id: string;
  name: string;
  board_size: number;
  source: 'seed' | 'admin_designed';
  created_at: string;
};

export default function TemplatesPage() {
  const { loading: authLoading } = useAdminSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [boardSize, setBoardSize] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      setLoading(true);
      const qs = new URLSearchParams();
      if (boardSize) qs.set('board_size', boardSize);
      if (source) qs.set('source', source);
      const res = await adminFetch(`/api/admin/templates?${qs.toString()}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
      setLoading(false);
    })();
  }, [authLoading, boardSize, source]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <Link
            href="/admin/templates/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            New Template
          </Link>
        </div>

        <div className="mb-4 flex gap-3">
          <select
            value={boardSize}
            onChange={(e) => setBoardSize(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All sizes</option>
            <option value="11">11x11</option>
            <option value="13">13x13</option>
            <option value="15">15x15</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All sources</option>
            <option value="seed">Seed bank</option>
            <option value="admin_designed">Admin designed</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{t.name}</td>
                    <td className="px-4 py-2">
                      {t.board_size}x{t.board_size}
                    </td>
                    <td className="px-4 py-2 capitalize">{t.source.replace('_', ' ')}</td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No templates found
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
