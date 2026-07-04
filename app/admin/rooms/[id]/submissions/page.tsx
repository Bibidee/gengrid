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

const TROPHIES: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: 'text-amber-500' },
  2: { icon: '🥈', color: 'text-slate-400' },
  3: { icon: '🥉', color: 'text-orange-700' },
};

function usernameOf(s: Submission) {
  return (Array.isArray(s.player_sessions) ? s.player_sessions[0]?.username : s.player_sessions?.username) ?? '—';
}

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

  function exportCsv() {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ['rank', 'player', 'score', 'correct_words', 'total_words', 'correct_letters', 'total_letters', 'time_used_seconds', 'submitted_at'],
      ...submissions.map((s, i) => [
        i + 1,
        usernameOf(s),
        s.score,
        s.correct_words,
        s.total_words,
        s.correct_letters,
        s.total_letters,
        s.time_used_seconds,
        s.submitted_at,
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gengrid-leaderboard-${params.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Leaderboard</h1>
          <button
            type="button"
            onClick={exportCsv}
            disabled={submissions.length === 0}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Player</th>
                  <th className="px-4 py-2 text-right">Score</th>
                  <th className="px-4 py-2 text-right">Words</th>
                  <th className="px-4 py-2 text-right">Letters</th>
                  <th className="px-4 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => {
                  const trophy = TROPHIES[i + 1];
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className={`px-4 py-2 font-semibold ${trophy?.color ?? 'text-slate-400'}`}>
                        {trophy ? `${trophy.icon} ` : ''}
                        {i + 1}
                      </td>
                      <td className="px-4 py-2">{usernameOf(s)}</td>
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
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
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
