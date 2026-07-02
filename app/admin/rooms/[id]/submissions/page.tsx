'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Submission = {
  id: string;
  player_id: string;
  score: number;
  correct_letters: number;
  correct_words: number;
  total_letters: number;
  total_words: number;
  time_used_seconds: number;
  submitted_at: string;
  player_sessions: { username: string } | { username: string }[] | null;
};

export default function RoomSubmissionsPage() {
  const { loading: authLoading } = useAdminSession();
  const params = useParams<{ id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const res = await adminFetch(`/api/admin/rooms/${params.id}/submissions`);
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
      setLoading(false);
    })();
  }, [authLoading, params.id]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Submissions</h1>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2 text-right">Score</th>
                  <th className="px-4 py-2 text-right">Words</th>
                  <th className="px-4 py-2 text-right">Letters</th>
                  <th className="px-4 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const username = Array.isArray(s.player_sessions)
                    ? s.player_sessions[0]?.username
                    : s.player_sessions?.username;
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{username ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold">{s.score}</td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {s.correct_words}/{s.total_words}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {s.correct_letters}/{s.total_letters}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">{s.time_used_seconds}s</td>
                    </tr>
                  );
                })}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No submissions yet
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
