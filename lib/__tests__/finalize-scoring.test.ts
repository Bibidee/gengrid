import { describe, it, expect } from 'vitest';
import {
  cellValuesToWords,
  computeFinalLeaderboard,
  POINTS_PER_LETTER,
  WORD_BONUS,
  COMPLETION_BONUS,
  type FinalClue,
  type FinalPlayerInput,
} from '../scoring';

// 3x3 mini: 1-across CAT starting (0,0); 1-down CAR starting (0,0).
const CLUES: FinalClue[] = [
  {
    clue_number: 1,
    direction: 'across',
    correct_answer: 'CAT',
    row_start: 0,
    col_start: 0,
    answer_length: 3,
  },
  {
    clue_number: 1,
    direction: 'down',
    correct_answer: 'CAR',
    row_start: 0,
    col_start: 0,
    answer_length: 3,
  },
];

const DURATION = 300;

describe('cellValuesToWords', () => {
  it('assembles across and down words from per-cell values', () => {
    const words = cellValuesToWords(CLUES, {
      '0,0': 'C',
      '0,1': 'A',
      '0,2': 'T',
      '1,0': 'A',
      '2,0': 'R',
    });
    expect(words['1-across']).toBe('CAT');
    expect(words['1-down']).toBe('CAR');
  });

  it('skips missing cells (partial words stay positionally scoreable at best)', () => {
    const words = cellValuesToWords(CLUES, { '0,0': 'C', '0,1': 'A' });
    expect(words['1-across']).toBe('CA');
    expect(words['1-down']).toBe('C');
  });

  it('returns empty words when no cells are filled', () => {
    const words = cellValuesToWords(CLUES, {});
    expect(words['1-across']).toBe('');
    expect(words['1-down']).toBe('');
  });
});

describe('computeFinalLeaderboard', () => {
  const submitter: FinalPlayerInput = {
    id: 'a',
    username: 'alice',
    submission: { score: 500, time_used_seconds: 120, submitted_at: '2026-01-01T00:02:00Z' },
  };
  const partialSyncer: FinalPlayerInput = {
    id: 'b',
    username: 'bob',
    submission: null,
    // 1-across fully correct (word bonus), down = "C" only partial (1 letter).
    synced_cells: { '0,0': 'C', '0,1': 'A', '0,2': 'T' },
  };
  const ghost: FinalPlayerInput = {
    id: 'c',
    username: 'carol',
    submission: null,
    synced_cells: null,
  };

  it('gives every joined player exactly one row: submission, auto-score, or 0', () => {
    const lb = computeFinalLeaderboard(CLUES, [ghost, partialSyncer, submitter], DURATION);

    expect(lb).toHaveLength(3);
    expect(new Set(lb.map((e) => e.player_id)).size).toBe(3);

    const alice = lb.find((e) => e.player_id === 'a')!;
    expect(alice.score).toBe(500);
    expect(alice.time_used_seconds).toBe(120);
    expect(alice.finished_by).toBe('submitted');

    const bob = lb.find((e) => e.player_id === 'b')!;
    // CAT: 3 letters + word bonus; CAR guess "C": 1 positional letter.
    expect(bob.score).toBe(4 * POINTS_PER_LETTER + WORD_BONUS);
    expect(bob.time_used_seconds).toBe(DURATION);
    expect(bob.finished_by).toBe('timeout');

    const carol = lb.find((e) => e.player_id === 'c')!;
    expect(carol.score).toBe(0);
    expect(carol.finished_by).toBe('timeout');
  });

  it('ranks by score desc, then time asc, and assigns 1..n', () => {
    const lb = computeFinalLeaderboard(CLUES, [ghost, partialSyncer, submitter], DURATION);
    expect(lb.map((e) => e.username)).toEqual(['alice', 'bob', 'carol']);
    expect(lb.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it('breaks score+time ties by earlier submitted_at, then username', () => {
    const early: FinalPlayerInput = {
      id: 'e',
      username: 'zed',
      submission: { score: 100, time_used_seconds: 60, submitted_at: '2026-01-01T00:01:00Z' },
    };
    const late: FinalPlayerInput = {
      id: 'l',
      username: 'amy',
      submission: { score: 100, time_used_seconds: 60, submitted_at: '2026-01-01T00:03:00Z' },
    };
    const lb = computeFinalLeaderboard([], [late, early], DURATION);
    expect(lb.map((e) => e.username)).toEqual(['zed', 'amy']);
  });

  it('awards a perfect auto-scored non-submitter the completion bonus too', () => {
    const perfect: FinalPlayerInput = {
      id: 'p',
      username: 'pat',
      synced_cells: { '0,0': 'C', '0,1': 'A', '0,2': 'T', '1,0': 'A', '2,0': 'R' },
    };
    const lb = computeFinalLeaderboard(CLUES, [perfect], DURATION);
    expect(lb[0].score).toBe(6 * POINTS_PER_LETTER + 2 * WORD_BONUS + COMPLETION_BONUS);
  });

  it('returns an empty leaderboard for a room nobody joined', () => {
    expect(computeFinalLeaderboard(CLUES, [], DURATION)).toEqual([]);
  });
});
