'use client';

import { useEffect, useState } from 'react';
import type { GridClue } from './Grid';

export type PlayClue = GridClue & { clue_text: string };

type Props = {
  clues: PlayClue[];
  selectedClue: GridClue | null;
  onSelect: (clue: PlayClue) => void;
  completed?: Set<string>; // "{clue_number}-{direction}" keys that are fully filled locally
  /** Post-game review: per-clue correct/incorrect booleans (green/red hints). */
  grading?: Record<string, boolean>;
  /** Post-game review: correct words for WRONG clues, revealed via a toggle. */
  corrections?: Record<string, string>;
  /** Post-game review: the caller's submitted word per clue (for "You: …"). */
  submittedWords?: Record<string, string>;
  /** Scroll the selected clue into view when selection comes from the grid. */
  followSelection?: boolean;
};

export function ClueList({ clues, selectedClue, onSelect, completed, grading, corrections, submittedWords, followSelection = false }: Props) {
  const across = clues.filter((c) => c.direction === 'across').sort((a, b) => a.clue_number - b.clue_number);
  const down = clues.filter((c) => c.direction === 'down').sort((a, b) => a.clue_number - b.clue_number);
  const [tab, setTab] = useState<'across' | 'down'>('across');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // When a grid tap changes the selection, bring its clue into view (and on
  // mobile switch to the matching Across/Down tab first).
  useEffect(() => {
    if (!followSelection || !selectedClue) return;
    setTab(selectedClue.direction);
    // Look the elements up after the tab switch has rendered. The list is
    // rendered twice (mobile tabs / desktop columns); scrolling the hidden
    // copy is a no-op, so scroll both.
    requestAnimationFrame(() => {
      for (const variant of ['m', 'd']) {
        document
          .getElementById(`clue-${variant}-${selectedClue.clue_number}-${selectedClue.direction}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }, [followSelection, selectedClue]);

  const renderList = (list: PlayClue[], variant: 'm' | 'd') =>
    list.map((c) => {
      const key = `${c.clue_number}-${c.direction}`;
      const isSelected = selectedClue?.clue_number === c.clue_number && selectedClue?.direction === c.direction;
      const grade = grading?.[key];
      const gradeClass =
        grade === true ? 'text-[#4ADE80]' : grade === false ? 'text-[#FF6B81]' : '';
      const correction = grade === false ? corrections?.[key] : undefined;
      const isRevealed = revealed.has(key);
      return (
        <li key={key} id={`clue-${variant}-${key}`}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`w-full rounded-md px-2 py-1 text-left text-sm ${
              isSelected ? 'bg-[rgba(139,124,255,0.22)] font-semibold' : 'hover:bg-[rgba(139,124,255,0.08)]'
            } ${
              gradeClass ||
              (completed?.has(key) ? 'text-[#64607A] line-through decoration-1' : 'text-[#C7CCDD]')
            }`}
          >
            <span className="font-arena-mono mr-1 text-xs text-[#A79BFF]">{c.clue_number}.</span>
            {c.clue_text}
            {grade === true && <span className="ml-1 text-xs font-bold text-[#4ADE80]">✓</span>}
            {grade === false && <span className="ml-1 text-xs font-bold text-[#FF6B81]">✗</span>}
          </button>
          {correction && (
            <div className="px-2 pb-1">
              {isRevealed ? (
                <p className="text-xs">
                  <span className="text-[#9CA3B8]">
                    You: <span className="font-arena-mono">{submittedWords?.[key]?.trim() || '—'}</span>
                  </span>
                  <span className="mx-1 text-[#64607A]">→</span>
                  <span className="font-arena-mono font-semibold text-[#4ADE80]">{correction}</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setRevealed((prev) => {
                      const next = new Set(prev);
                      next.add(key);
                      return next;
                    })
                  }
                  className="text-xs font-semibold text-[#9CA3B8] underline decoration-dotted hover:text-[#F8FAFC]"
                >
                  Show answer
                </button>
              )}
            </div>
          )}
        </li>
      );
    });

  return (
    <div>
      {/* Small screens: Across/Down tabs to avoid a very long scroll. */}
      <div className="sm:hidden">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-md bg-[rgba(255,255,255,0.055)] p-1" role="tablist">
          {(['across', 'down'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`font-sg rounded px-2 py-1.5 text-xs font-bold uppercase tracking-wide ${
                tab === t ? 'bg-[rgba(139,124,255,0.25)] text-[#F8FAFC]' : 'text-[#64607A]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <ul className="space-y-0.5">{renderList(tab === 'across' ? across : down, 'm')}</ul>
      </div>

      {/* Larger screens: side-by-side columns. */}
      <div className="hidden grid-cols-2 gap-4 sm:grid">
        <div>
          <h3 className="font-sg mb-1 text-xs font-bold uppercase tracking-wide text-[#8E87A8]">Across</h3>
          <ul className="space-y-0.5">{renderList(across, 'd')}</ul>
        </div>
        <div>
          <h3 className="font-sg mb-1 text-xs font-bold uppercase tracking-wide text-[#8E87A8]">Down</h3>
          <ul className="space-y-0.5">{renderList(down, 'd')}</ul>
        </div>
      </div>
    </div>
  );
}
