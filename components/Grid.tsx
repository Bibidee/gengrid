'use client';

import { useId } from 'react';

export type GridClue = {
  clue_number: number;
  direction: 'across' | 'down';
  row_start: number;
  col_start: number;
  answer_length: number;
};

type Props = {
  size: number;
  blackCells: [number, number][];
  clueNumbers: Record<string, number>;
  clues: GridClue[];
  values: Record<string, string>; // "row,col" -> single letter
  onChange: (row: number, col: number, letter: string) => void;
  selectedClue: GridClue | null;
  onSelectCell: (row: number, col: number) => void;
};

export function Grid({ size, blackCells, clueNumbers, values, onChange, selectedClue, onSelectCell }: Props) {
  const instanceId = useId();
  const black = new Set(blackCells.map(([r, c]) => `${r},${c}`));

  const isInSelectedClue = (r: number, c: number) => {
    if (!selectedClue) return false;
    if (selectedClue.direction === 'across') {
      return r === selectedClue.row_start && c >= selectedClue.col_start && c < selectedClue.col_start + selectedClue.answer_length;
    }
    return c === selectedClue.col_start && r >= selectedClue.row_start && r < selectedClue.row_start + selectedClue.answer_length;
  };

  function cellId(r: number, c: number) {
    return `gengrid-cell-${instanceId}-${r}-${c}`;
  }

  function focusCell(r: number, c: number) {
    document.getElementById(cellId(r, c))?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    if (e.key === 'ArrowRight') focusCell(r, c + 1);
    else if (e.key === 'ArrowLeft') focusCell(r, c - 1);
    else if (e.key === 'ArrowUp') focusCell(r - 1, c);
    else if (e.key === 'ArrowDown') focusCell(r + 1, c);
    else if (e.key === 'Backspace' && !values[`${r},${c}`]) {
      if (selectedClue?.direction === 'across') focusCell(r, c - 1);
      else focusCell(r - 1, c);
    }
  }

  return (
    <div
      className="inline-grid border-2 border-slate-800 bg-slate-800 gap-px select-none"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: size }).map((_, r) =>
        Array.from({ length: size }).map((__, c) => {
          const key = `${r},${c}`;
          if (black.has(key)) {
            return <div key={key} className="aspect-square w-8 sm:w-9 bg-slate-900" />;
          }
          const number = clueNumbers[key];
          const highlighted = isInSelectedClue(r, c);
          return (
            <div
              key={key}
              className={`relative aspect-square w-8 sm:w-9 ${highlighted ? 'bg-amber-100' : 'bg-white'}`}
            >
              {number && <span className="absolute left-0.5 top-0 text-[9px] leading-none text-slate-500">{number}</span>}
              <input
                id={cellId(r, c)}
                value={values[key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();
                  onChange(r, c, v);
                  if (v) {
                    if (selectedClue?.direction === 'down') focusCell(r + 1, c);
                    else focusCell(r, c + 1);
                  }
                }}
                onFocus={() => onSelectCell(r, c)}
                onKeyDown={(e) => handleKeyDown(e, r, c)}
                maxLength={1}
                autoComplete="off"
                inputMode="text"
                aria-label={`Row ${r + 1}, column ${c + 1}`}
                className="h-full w-full bg-transparent text-center text-sm font-semibold uppercase outline-none focus:bg-amber-200"
              />
            </div>
          );
        })
      )}
    </div>
  );
}
