// Pure crossword grid derivation + validation logic.
// Shared by the seed script (Phase 4) and the live Grid Designer (Phase 6).
// No I/O of any kind — safe to unit test in isolation.

export type Cell = { row: number; col: number };

export type Direction = 'across' | 'down';

export type Slot = {
  clue_number: number;
  direction: Direction;
  row_start: number;
  col_start: number;
  answer_length: number;
};

export type DerivedGrid = {
  clue_numbers: Record<string, number>; // "row,col" -> number
  slots: Slot[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function buildBlackGrid(size: number, blackCells: Cell[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );
  for (const { row, col } of blackCells) {
    if (row < 0 || row >= size || col < 0 || col >= size) {
      throw new Error(`Black cell (${row},${col}) is out of bounds for size ${size}`);
    }
    grid[row][col] = true;
  }
  return grid;
}

/**
 * Derives clue numbering and clue slots from a black-cell layout, following
 * standard crossword numbering convention: scan in reading order, a cell
 * that starts an across and/or down run of length >= 2 gets the next
 * sequential number (shared across both directions if it starts both).
 */
export function deriveSlotsAndNumbering(size: number, blackCells: Cell[]): DerivedGrid {
  const black = buildBlackGrid(size, blackCells);
  const isWhite = (r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && !black[r][c];

  const clue_numbers: Record<string, number> = {};
  const slots: Slot[] = [];
  let nextNumber = 1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isWhite(r, c)) continue;

      const startsAcross =
        (c === 0 || !isWhite(r, c - 1)) && isWhite(r, c + 1);
      const startsDown =
        (r === 0 || !isWhite(r - 1, c)) && isWhite(r + 1, c);

      if (!startsAcross && !startsDown) continue;

      const number = nextNumber++;
      clue_numbers[`${r},${c}`] = number;

      if (startsAcross) {
        let len = 0;
        let cc = c;
        while (isWhite(r, cc)) {
          len++;
          cc++;
        }
        slots.push({
          clue_number: number,
          direction: 'across',
          row_start: r,
          col_start: c,
          answer_length: len,
        });
      }

      if (startsDown) {
        let len = 0;
        let rr = r;
        while (isWhite(rr, c)) {
          len++;
          rr++;
        }
        slots.push({
          clue_number: number,
          direction: 'down',
          row_start: r,
          col_start: c,
          answer_length: len,
        });
      }
    }
  }

  return { clue_numbers, slots };
}

/**
 * Validates a black-cell layout before it's allowed to be saved as a
 * template. Catches isolated white cells (no valid word passes through
 * them), excessive black-cell density, an all-black grid, and a grid with
 * no derivable slots at all.
 */
export function validateGrid(size: number, blackCells: Cell[]): ValidationResult {
  const errors: string[] = [];
  const black = buildBlackGrid(size, blackCells);
  const isWhite = (r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && !black[r][c];

  const totalCells = size * size;
  const blackCount = blackCells.length;
  const whiteCount = totalCells - blackCount;

  if (whiteCount === 0) {
    errors.push('Grid is fully black — there are no white cells.');
    return { valid: false, errors };
  }

  const blackRatio = blackCount / totalCells;
  if (blackRatio > 0.6) {
    errors.push(
      `Black-cell ratio is ${(blackRatio * 100).toFixed(0)}% — exceeds the 60% maximum.`
    );
  } else if (blackRatio > 0.4) {
    errors.push(
      `Warning: black-cell ratio is ${(blackRatio * 100).toFixed(0)}% — above the recommended 40%.`
    );
  }

  // Isolated white cell check: every white cell must belong to at least one
  // across or down run of length >= 2.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isWhite(r, c)) continue;

      const hasAcrossRun = isWhite(r, c - 1) || isWhite(r, c + 1);
      const hasDownRun = isWhite(r - 1, c) || isWhite(r + 1, c);

      if (!hasAcrossRun && !hasDownRun) {
        errors.push(`Cell (${r},${c}) is isolated — no valid word passes through it.`);
      }
    }
  }

  const { slots } = deriveSlotsAndNumbering(size, blackCells);
  if (slots.length === 0) {
    errors.push('Grid has no derivable clue slots.');
  }

  // Only "hard" errors (not the 40% warning) make the grid invalid.
  const hardErrors = errors.filter((e) => !e.startsWith('Warning:'));

  return { valid: hardErrors.length === 0, errors };
}
