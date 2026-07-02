import type { Cell } from '../lib/crossword-derive';
import { deriveSlotsAndNumbering, type Slot } from '../lib/crossword-derive';
import { WORDS_BY_LENGTH, type WordEntry } from './wordbank';

type SlotWithCells = Slot & { cells: Cell[] };

function slotCells(slot: Slot): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < slot.answer_length; i++) {
    cells.push(
      slot.direction === 'across'
        ? { row: slot.row_start, col: slot.col_start + i }
        : { row: slot.row_start + i, col: slot.col_start }
    );
  }
  return cells;
}

export type FilledSlot = Slot & { word: string; clue: string };

/**
 * Backtracking crossword-fill solver with MRV (minimum-remaining-values)
 * ordering: at each step, fills the slot with the fewest matching
 * candidates first, to fail fast. Returns null if no consistent fill
 * exists with the given word bank within `maxCalls` search steps.
 */
export function fillCrossword(
  size: number,
  blackCells: Cell[],
  maxCalls = 300_000
): FilledSlot[] | null {
  const { slots } = deriveSlotsAndNumbering(size, blackCells);
  const withCells: SlotWithCells[] = slots.map((s) => ({ ...s, cells: slotCells(s) }));

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const usedWords = new Set<string>();
  const assignment = new Map<string, WordEntry>(); // slotKey -> word entry

  const slotKey = (s: Slot) => `${s.clue_number}-${s.direction}`;

  function pattern(s: SlotWithCells): string {
    return s.cells.map((c) => grid[c.row][c.col] ?? '.').join('');
  }

  function candidatesFor(s: SlotWithCells): WordEntry[] {
    const pool = WORDS_BY_LENGTH.get(s.answer_length) ?? [];
    const pat = pattern(s);
    return pool.filter((entry) => {
      if (usedWords.has(entry.word)) return false;
      for (let i = 0; i < pat.length; i++) {
        if (pat[i] !== '.' && pat[i] !== entry.word[i]) return false;
      }
      return true;
    });
  }

  let calls = 0;
  let overBudget = false;

  function backtrack(remaining: SlotWithCells[]): boolean {
    calls++;
    if (calls > maxCalls) {
      overBudget = true;
      return false;
    }
    if (remaining.length === 0) return true;

    // MRV: pick the slot with fewest candidates, to fail fast.
    let bestIdx = -1;
    let bestCandidates: WordEntry[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const cands = candidatesFor(remaining[i]);
      if (bestIdx === -1 || cands.length < bestCandidates.length) {
        bestIdx = i;
        bestCandidates = cands;
        if (cands.length === 0) break;
      }
    }
    if (bestCandidates.length === 0) return false;

    const slot = remaining[bestIdx];
    const rest = remaining.slice(0, bestIdx).concat(remaining.slice(bestIdx + 1));

    for (const entry of bestCandidates) {
      const newlySet: Cell[] = [];
      for (let i = 0; i < slot.cells.length; i++) {
        const { row, col } = slot.cells[i];
        if (grid[row][col] === null) {
          grid[row][col] = entry.word[i];
          newlySet.push({ row, col });
        }
      }
      usedWords.add(entry.word);
      assignment.set(slotKey(slot), entry);

      if (backtrack(rest)) return true;

      usedWords.delete(entry.word);
      assignment.delete(slotKey(slot));
      for (const { row, col } of newlySet) grid[row][col] = null;

      if (overBudget) return false;
    }

    return false;
  }

  const solved = backtrack(withCells);
  if (!solved) return null;

  return withCells.map((s) => {
    const entry = assignment.get(slotKey(s))!;
    return { ...s, word: entry.word, clue: entry.clue };
  });
}
