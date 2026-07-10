'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Template = { id: string; name: string; board_size: number; source: string };

function NewPuzzleForm() {
  const { loading: authLoading } = useAdminSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [boardSize, setBoardSize] = useState(11);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(searchParams.get('template_id') ?? '');
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const res = await adminFetch(`/api/admin/templates?board_size=${boardSize}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    })();
  }, [authLoading, boardSize]);

  async function handleCreate() {
    if (!title.trim() || !templateId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/puzzles', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), template_id: templateId, theme: theme.trim(), difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create puzzle');
        return;
      }
      router.push(`/admin/puzzles/${data.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">New Puzzle</h1>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Board size</label>
            <div className="flex gap-2">
              {[11, 13, 15].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setBoardSize(size);
                    setTemplateId('');
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    boardSize === size ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'
                  }`}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.source === 'seed' ? 'seed bank' : 'custom'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Theme (optional)</label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Difficulty (optional)</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={!title.trim() || !templateId || saving}
            className="rounded-md bg-slate-900 px-6 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create draft & continue'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function NewPuzzlePage() {
  return (
    <Suspense fallback={null}>
      <NewPuzzleForm />
    </Suspense>
  );
}
