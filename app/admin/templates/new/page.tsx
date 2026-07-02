'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { useAdminSession } from '@/lib/use-admin-session';
import { adminFetch } from '@/lib/admin-fetch';

type Slot = {
  clue_number: number;
  direction: 'across' | 'down';
  row_start: number;
  col_start: number;
  answer_length: number;
};

type PreviewResponse = {
  valid: boolean;
  errors: string[];
  clue_numbers: Record<string, number>;
  slots: Slot[];
};

export default function GridDesignerPage() {
  const { loading: authLoading } = useAdminSession();
  const router = useRouter();

  const [boardSize, setBoardSize] = useState(11);
  const [black, setBlack] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleCell(r: number, c: number) {
    setBlack((prev) => {
      const key = `${r},${c}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetGrid(size: number) {
    setBoardSize(size);
    setBlack(new Set());
    setPreview(null);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const black_cells = [...black].map((k) => k.split(',').map(Number));
      const res = await adminFetch('/api/admin/templates/preview', {
        method: 'POST',
        body: JSON.stringify({ board_size: boardSize, black_cells }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && Array.isArray(data.errors) && Array.isArray(data.slots)) {
        setPreview(data);
      } else {
        setPreview({
          valid: false,
          errors: [data?.error ?? 'Preview failed — please try again.'],
          clue_numbers: {},
          slots: [],
        });
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [black, boardSize]);

  async function handleSave() {
    if (!preview?.valid || !name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const black_cells = [...black].map((k) => k.split(',').map(Number));
      const res = await adminFetch('/api/admin/templates', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), board_size: boardSize, black_cells }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save template');
        return;
      }
      router.push(`/admin/puzzles/new?template_id=${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  const hardErrors = preview?.errors.filter((e) => !e.startsWith('Warning:')) ?? [];
  const warnings = preview?.errors.filter((e) => e.startsWith('Warning:')) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Grid Designer</h1>

        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Board size</label>
          {[11, 13, 15].map((size) => (
            <button
              key={size}
              onClick={() => resetGrid(size)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                boardSize === size ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'
              }`}
            >
              {size}x{size}
            </button>
          ))}
          <button onClick={() => setBlack(new Set())} className="ml-auto text-sm text-slate-500 hover:text-slate-900">
            Clear grid
          </button>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div
            className="inline-grid border-2 border-slate-800 bg-slate-800 gap-px"
            style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: boardSize }).map((_, r) =>
              Array.from({ length: boardSize }).map((__, c) => {
                const key = `${r},${c}`;
                const isBlack = black.has(key);
                const number = preview?.clue_numbers[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleCell(r, c)}
                    className={`relative aspect-square w-7 sm:w-8 ${isBlack ? 'bg-slate-900' : 'bg-white hover:bg-amber-50'}`}
                  >
                    {!isBlack && number && (
                      <span className="absolute left-0.5 top-0 text-[8px] leading-none text-slate-500">{number}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Template name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Custom ${boardSize}x${boardSize} — ${new Date().toLocaleDateString()}`}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            {hardErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <ul className="list-disc pl-4">
                  {hardErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <ul className="list-disc pl-4">
                  {warnings.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Derived clues ({preview?.slots.length ?? 0})
              </h3>
              <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 text-sm">
                {(preview?.slots ?? [])
                  .slice()
                  .sort((a, b) => a.clue_number - b.clue_number)
                  .map((s) => (
                    <div key={`${s.clue_number}-${s.direction}`} className="text-slate-600">
                      {s.clue_number}-{s.direction[0].toUpperCase()} ({s.answer_length})
                    </div>
                  ))}
                {(!preview || preview.slots.length === 0) && <p className="text-slate-400">Click cells to design a grid.</p>}
              </div>
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={!preview?.valid || !name.trim() || saving}
              className="rounded-md bg-slate-900 px-6 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
