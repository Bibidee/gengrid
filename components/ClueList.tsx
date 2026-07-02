'use client';

import type { GridClue } from './Grid';

export type PlayClue = GridClue & { clue_text: string };

type Props = {
  clues: PlayClue[];
  selectedClue: GridClue | null;
  onSelect: (clue: PlayClue) => void;
  completed: Set<string>; // "{clue_number}-{direction}" keys that are fully filled locally
};

export function ClueList({ clues, selectedClue, onSelect, completed }: Props) {
  const across = clues.filter((c) => c.direction === 'across').sort((a, b) => a.clue_number - b.clue_number);
  const down = clues.filter((c) => c.direction === 'down').sort((a, b) => a.clue_number - b.clue_number);

  const renderList = (list: PlayClue[]) =>
    list.map((c) => {
      const key = `${c.clue_number}-${c.direction}`;
      const isSelected = selectedClue?.clue_number === c.clue_number && selectedClue?.direction === c.direction;
      return (
        <li key={key}>
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`w-full rounded px-2 py-1 text-left text-sm ${
              isSelected ? 'bg-amber-200 font-semibold' : 'hover:bg-slate-100'
            } ${completed.has(key) ? 'text-slate-400 line-through decoration-1' : 'text-slate-800'}`}
          >
            <span className="mr-1 font-mono text-xs text-slate-500">{c.clue_number}.</span>
            {c.clue_text}
          </button>
        </li>
      );
    });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Across</h3>
        <ul className="space-y-0.5">{renderList(across)}</ul>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Down</h3>
        <ul className="space-y-0.5">{renderList(down)}</ul>
      </div>
    </div>
  );
}
