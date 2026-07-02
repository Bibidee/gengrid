'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Clue = {
  id: string;
  clue_number: number;
  direction: 'across' | 'down';
  answer_length: number;
  clue_text: string;
  correct_answer: string;
};

type PuzzleDetail = {
  id: string;
  title: string;
  theme: string | null;
  difficulty: string | null;
  status: 'draft' | 'ready' | 'archived';
  clues: Clue[];
};

export default function EditPuzzlePage() {
  const { loading: authLoading } = useAdminSession();
  const params = useParams<{ id: string }>();

  const [puzzle, setPuzzle] = useState<PuzzleDetail | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const res = await adminFetch(`/api/admin/puzzles/${params.id}`);
      const data = await res.json();
      setPuzzle(data);
      setClues(data.clues ?? []);
    })();
  }, [authLoading, params.id]);

  function updateClue(id: string, field: 'clue_text' | 'correct_answer', value: string) {
    setClues((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function handleSave(newStatus?: 'ready' | 'draft') {
    setSaving(true);
    setMessage(null);
    try {
      const res = await adminFetch(`/api/admin/puzzles/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clues: clues.map((c) => ({ id: c.id, clue_text: c.clue_text, correct_answer: c.correct_answer })),
          ...(newStatus ? { status: newStatus } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Failed to save');
        return;
      }
      setMessage(newStatus === 'ready' ? 'Marked as ready!' : 'Saved');
      if (newStatus) setPuzzle((p) => (p ? { ...p, status: newStatus } : p));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !puzzle) return null;

  const across = clues.filter((c) => c.direction === 'across').sort((a, b) => a.clue_number - b.clue_number);
  const down = clues.filter((c) => c.direction === 'down').sort((a, b) => a.clue_number - b.clue_number);

  const renderClue = (c: Clue) => (
    <div key={c.id} className="mb-2 flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs font-mono text-slate-400">
        {c.clue_number}
        {c.direction[0].toUpperCase()}
      </span>
      <input
        value={c.clue_text}
        onChange={(e) => updateClue(c.id, 'clue_text', e.target.value)}
        placeholder="Clue text"
        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        value={c.correct_answer}
        onChange={(e) => updateClue(c.id, 'correct_answer', e.target.value.toUpperCase())}
        placeholder={`${c.answer_length} letters`}
        maxLength={c.answer_length}
        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm uppercase"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">{puzzle.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
            {puzzle.status}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Across</h2>
            {across.map(renderClue)}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Down</h2>
            {down.map(renderClue)}
          </div>
        </div>

        {message && <p className="mb-4 text-sm text-slate-600">{message}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="rounded-md bg-white px-5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Save draft
          </button>
          <button
            onClick={() => handleSave('ready')}
            disabled={saving}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Mark as ready
          </button>
        </div>
      </main>
    </div>
  );
}
