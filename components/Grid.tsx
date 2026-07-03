'use client';

import { useEffect, useId, useState } from 'react';

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
  /** Post-game review: render values without accepting edits. */
  readOnly?: boolean;
  /** Post-game review: faint per-cell correctness tint ("row,col" keys). */
  cellShading?: Record<string, 'correct' | 'wrong'>;
};

export function Grid({ size, blackCells, clueNumbers, values, onChange, selectedClue, onSelectCell, readOnly = false, cellShading }: Props) {
  const instanceId = useId();
  const black = new Set(blackCells.map(([r, c]) => `${r},${c}`));

  // Explicit square WHOLE-pixel sizing computed in JS. iOS Safari mishandles
  // aspect-square + fr columns (cells stretch tall), and fractional CSS calc
  // sizes make the 1px cell separators disappear at some Windows display
  // scaling / browser zoom levels. Integer px cells + real borders (below)
  // render reliably everywhere. 36px default matches desktop; recomputed on
  // mount and resize to fit the viewport minus page padding.
  const [cellPx, setCellPx] = useState(36);
  useEffect(() => {
    const compute = () => {
      const avail = window.innerWidth - 32 - 4; // page padding + grid border
      setCellPx(Math.max(18, Math.min(36, Math.floor(avail / size))));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [size]);

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
      className="inline-grid border-2 border-slate-800 select-none"
      style={{ gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, gridAutoRows: `${cellPx}px` }}
    >
      {Array.from({ length: size }).map((_, r) =>
        Array.from({ length: size }).map((__, c) => {
          const key = `${r},${c}`;
          // Per-cell borders (not gaps) draw the grid lines so they survive
          // fractional display scaling; box-sizing keeps cells square.
          const cellBorder = `border-slate-800 ${c < size - 1 ? 'border-r' : ''} ${r < size - 1 ? 'border-b' : ''}`;
          if (black.has(key)) {
            return <div key={key} className={`bg-slate-900 ${cellBorder}`} />;
          }
          const number = clueNumbers[key];
          const highlighted = isInSelectedClue(r, c);
          const shade = cellShading?.[key];
          const bg = highlighted
            ? 'bg-amber-100'
            : shade === 'correct'
              ? 'bg-green-100'
              : shade === 'wrong'
                ? 'bg-red-100'
                : 'bg-white';
          return (
            <div key={key} className={`relative ${bg} ${cellBorder}`}>
              {number && <span className="absolute left-0.5 top-0 text-[9px] leading-none text-slate-500">{number}</span>}
              <input
                id={cellId(r, c)}
                value={values[key] ?? ''}
                onChange={(e) => {
                  if (readOnly) return;
                  const v = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();
                  onChange(r, c, v);
                  // Advance only within the current word; stop at its last
                  // cell so the selection never jumps to another word on its
                  // own — switching direction is always the player's tap.
                  if (v && selectedClue) {
                    if (selectedClue.direction === 'down') {
                      if (r + 1 < selectedClue.row_start + selectedClue.answer_length) focusCell(r + 1, c);
                    } else if (c + 1 < selectedClue.col_start + selectedClue.answer_length) {
                      focusCell(r, c + 1);
                    }
                  }
                }}
                onFocus={() => onSelectCell(r, c)}
                // onFocus doesn't refire when tapping the already-focused
                // cell, so re-taps (direction toggle) go through pointerdown.
                onPointerDown={() => {
                  if (document.activeElement?.id === cellId(r, c)) onSelectCell(r, c);
                }}
                onKeyDown={(e) => handleKeyDown(e, r, c)}
                readOnly={readOnly}
                maxLength={1}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="next"
                aria-label={`Row ${r + 1}, column ${c + 1}`}
                className={`h-full w-full bg-transparent text-center font-semibold uppercase outline-none ${readOnly ? '' : 'focus:bg-amber-200'}`}
                // font-size >= 16px prevents iOS Safari auto-zoom on focus;
                // touch-action removes double-tap zoom delay on the grid.
                style={{ fontSize: 16, touchAction: 'manipulation' }}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
