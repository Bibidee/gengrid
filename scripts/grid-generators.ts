import type { Cell } from '../lib/crossword-derive';
import { validateGrid, deriveSlotsAndNumbering } from '../lib/crossword-derive';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * A fully-open (or near-open) NxN grid with `k` interior "notches" — single
 * black cells, each in a distinct row and distinct column, positioned with
 * enough buffer (>=2 cells) on every side that they never create a
 * sub-length-2 run or an isolated cell. Each notch splits exactly one
 * across run and one down run into two, adding exactly 2 slots. Base slot
 * count (k=0) is 2*size; with k notches it's 2*size + 2*k.
 */
export function generateOpenNotchGrid(size: number, k: number, variantSeed: number): Cell[] {
  const valid = range(2, size - 3);
  if (k > valid.length) {
    throw new Error(`Cannot place ${k} non-conflicting notches in a ${size}x${size} grid`);
  }
  const rows = seededShuffle(valid, variantSeed * 2 + 1).slice(0, k);
  const cols = seededShuffle(valid, variantSeed * 2 + 2).slice(0, k);
  const cells: Cell[] = rows.map((row, i) => ({ row, col: cols[i] }));
  return cells;
}

/**
 * A denser, "real crossword" style grid with short-to-medium word lengths
 * (mostly 3-8), generated from a simple linear formula and then auto-fixed
 * so it always passes validateGrid: any white cell left isolated by the
 * formula is blackened (a black cell has no run-length constraint), and if
 * that pushes density over budget the caller can lower `bias`.
 */
export function generateDenseGrid(size: number, modA: number, modB: number, modM: number, bias: number): Cell[] {
  const black: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((modA * r + modB * c) % modM < bias) {
        black[r][c] = true;
      }
    }
  }

  // Runs of length 2, or longer than maxRunLength, are hard to fill (too few
  // words share letters with whatever crosses them, or the word bank has
  // too few entries at that length). Fix both by blackening one endpoint
  // cell of the offending run — this removes that entry outright rather
  // than cascading into a merge, and any isolation it causes is cleaned up
  // by re-running the isolation fixer in the outer loop below.
  const maxRunLength = 9;
  function fixRunLengths(): boolean {
    const cells: Cell[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (black[r][c]) cells.push({ row: r, col: c });
      }
    }
    const { slots } = deriveSlotsAndNumbering(size, cells);
    for (const s of slots) {
      if (s.answer_length === 2) {
        // Blacken the second cell of the 2-run.
        const r = s.direction === 'across' ? s.row_start : s.row_start + 1;
        const c = s.direction === 'across' ? s.col_start + 1 : s.col_start;
        black[r][c] = true;
        return true;
      }
      if (s.answer_length > maxRunLength) {
        // Blacken a cell past the max length to cap the run.
        const r = s.direction === 'across' ? s.row_start : s.row_start + maxRunLength;
        const c = s.direction === 'across' ? s.col_start + maxRunLength : s.col_start;
        black[r][c] = true;
        return true;
      }
    }
    return false;
  }

  let outerChanged = true;
  while (outerChanged) {
    outerChanged = false;
    if (fixRunLengths()) outerChanged = true;

    const cells: Cell[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (black[r][c]) cells.push({ row: r, col: c });
      }
    }
    const result = validateGrid(size, cells);
    for (const err of result.errors) {
      const m = err.match(/^Cell \((\d+),(\d+)\) is isolated/);
      if (m) {
        const r = Number(m[1]);
        const c = Number(m[2]);
        if (!black[r][c]) {
          black[r][c] = true;
          outerChanged = true;
        }
      }
    }
  }

  const cells: Cell[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (black[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

export function slotStats(size: number, blackCells: Cell[]) {
  const { slots } = deriveSlotsAndNumbering(size, blackCells);
  const lengths = slots.map((s) => s.answer_length).sort((a, b) => a - b);
  const histogram: Record<number, number> = {};
  for (const l of lengths) histogram[l] = (histogram[l] ?? 0) + 1;
  return {
    count: slots.length,
    min: lengths[0],
    max: lengths[lengths.length - 1],
    histogram,
    ratio: blackCells.length / (size * size),
  };
}
