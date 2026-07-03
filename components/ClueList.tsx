'use client';

import { useState } from 'react';
import type { GridClue } from './Grid';

export type PlayClue = GridClue & { clue_text: string };

type Props = {
  clues: PlayClue[];
  selectedClue: GridClue | null;
  onSelect: (clue: PlayClue) => void;
  completed?: Set<string>; // "{clue_number}-{direction}" keys that are fully filled locally
  /** Post-game review: per-clue correct/incorrect booleans (green/red hints). */
  grading?: Record<string, boolean>;
};

export function ClueList({ clues, selectedClue, onSelect, completed, grading }: Props) {
  const across = clues.filter((c) => c.direction === 'across').sort((a, b) => a.clue_number - b.clue_number);
  const down = clues.filter((c) => c.direction === 'down').sort((a, b) => a.clue_number - b.clue_number);
  const [tab, setTab] = useState<'across' | 'down'>('across');

  const renderList = (list: PlayClue[]) =>
    list.map((c) => {
      const key = `${c.clue_number}-${c.direction}`;
      const isSelected = selectedClue?.clue_number === c.clue_number && selectedClue?.direction === c.direction;
      const grade = grading?.[key];
      const gradeClass =
        grade === true ? 'text-green-700' : grade === false ? 'text-red-600' : '';
      return (
        <li key={key}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`w-full rounded px-2 py-1 text-left text-sm ${
              isSelected ? 'bg-amber-200 font-semibold' : 'hover:bg-slate-100'
            } ${
              gradeClass ||
              (completed?.has(key) ? 'text-slate-400 line-through decoration-1' : 'text-slate-800')
            }`}
          >
            <span className="mr-1 font-mono text-xs text-slate-500">{c.clue_number}.</span>
            {c.clue_text}
            {grade === true && <span className="ml-1 text-xs font-bold text-green-600">✓</span>}
            {grade === false && <span className="ml-1 text-xs font-bold text-red-500">✗</span>}
          </button>
        </li>
      );
    });

  return (
    <div>
      {/* Small screens: Across/Down tabs to avoid a very long scroll. */}
      <div className="sm:hidden">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1" role="tablist">
          {(['across', 'down'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1.5 text-xs font-bold uppercase tracking-wide ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <ul className="space-y-0.5">{renderList(tab === 'across' ? across : down)}</ul>
      </div>

      {/* Larger screens: side-by-side columns. */}
      <div className="hidden grid-cols-2 gap-4 sm:grid">
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Across</h3>
          <ul className="space-y-0.5">{renderList(across)}</ul>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Down</h3>
          <ul className="space-y-0.5">{renderList(down)}</ul>
        </div>
      </div>
    </div>
  );
}
