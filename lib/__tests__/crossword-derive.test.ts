import { describe, it, expect } from 'vitest';
import { deriveSlotsAndNumbering, validateGrid, type Cell } from '../crossword-derive';

// Hand-verified 5x5 grid:
//   . . # . .
//   . . . . .
//   . . . . .
//   . . . . .
//   . . # . .
const GRID_5X5: Cell[] = [
  { row: 0, col: 2 },
  { row: 4, col: 2 },
];

describe('deriveSlotsAndNumbering', () => {
  it('numbers cells and derives slots for a hand-checked 5x5 grid', () => {
    const { clue_numbers, slots } = deriveSlotsAndNumbering(5, GRID_5X5);

    expect(clue_numbers).toEqual({
      '0,0': 1,
      '0,1': 2,
      '0,3': 3,
      '0,4': 4,
      '1,0': 5,
      '1,2': 6,
      '2,0': 7,
      '3,0': 8,
      '4,0': 9,
      '4,3': 10,
    });

    expect(slots).toEqual(
      expect.arrayContaining([
        { clue_number: 1, direction: 'across', row_start: 0, col_start: 0, answer_length: 2 },
        { clue_number: 1, direction: 'down', row_start: 0, col_start: 0, answer_length: 5 },
        { clue_number: 2, direction: 'down', row_start: 0, col_start: 1, answer_length: 5 },
        { clue_number: 3, direction: 'across', row_start: 0, col_start: 3, answer_length: 2 },
        { clue_number: 3, direction: 'down', row_start: 0, col_start: 3, answer_length: 5 },
        { clue_number: 4, direction: 'down', row_start: 0, col_start: 4, answer_length: 5 },
        { clue_number: 5, direction: 'across', row_start: 1, col_start: 0, answer_length: 5 },
        { clue_number: 6, direction: 'down', row_start: 1, col_start: 2, answer_length: 3 },
        { clue_number: 7, direction: 'across', row_start: 2, col_start: 0, answer_length: 5 },
        { clue_number: 8, direction: 'across', row_start: 3, col_start: 0, answer_length: 5 },
        { clue_number: 9, direction: 'across', row_start: 4, col_start: 0, answer_length: 2 },
        { clue_number: 10, direction: 'across', row_start: 4, col_start: 3, answer_length: 2 },
      ])
    );
    expect(slots).toHaveLength(12);
  });

  it('shares one number across both directions when a cell starts both', () => {
    const { clue_numbers } = deriveSlotsAndNumbering(5, GRID_5X5);
    expect(clue_numbers['0,0']).toBe(1);
    expect(clue_numbers['0,3']).toBe(3);
  });
});

describe('validateGrid', () => {
  it('accepts the hand-checked 5x5 grid', () => {
    const result = validateGrid(5, GRID_5X5);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a grid with an isolated white cell', () => {
    // 3x3, black everywhere except the center cell.
    const blackCells: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ];
    const result = validateGrid(3, blackCells);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('isolated'))).toBe(true);
  });

  it('rejects a fully black grid', () => {
    const blackCells: Cell[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        blackCells.push({ row: r, col: c });
      }
    }
    const result = validateGrid(3, blackCells);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fully black'))).toBe(true);
  });

  it('errors when black-cell ratio exceeds 60%', () => {
    // 5x5 grid, 16/25 = 64% black, but arranged so no cell is isolated
    // (every remaining white cell sits in a 3x3 open block).
    const blackCells: Cell[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r >= 3 || c >= 3) blackCells.push({ row: r, col: c });
      }
    }
    const result = validateGrid(5, blackCells);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('60%'))).toBe(true);
  });
});
