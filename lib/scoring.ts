// Pure scoring logic. This is the ONLY place `correct_answer` is read.
// No I/O of any kind — safe to unit test in isolation.

import type { Direction } from './crossword-derive';

export type PuzzleClue = {
  clue_number: number;
  direction: Direction;
  correct_answer: string;
};

export type SubmittedAnswers = Record<string, string>; // key: "{clue_number}-{direction}"

export type ScoreResult = {
  score: number;
  correct_letters: number;
  correct_words: number;
  total_letters: number;
  total_words: number;
};

export type ClueGeometry = {
  clue_number: number;
  direction: Direction;
  row_start: number;
  col_start: number;
  answer_length: number;
};

export type FinalClue = PuzzleClue & ClueGeometry;

export type FinalPlayerInput = {
  id: string;
  username: string;
  /** Present when the player submitted before the round ended. */
  submission?: {
    score: number;
    time_used_seconds: number;
    submitted_at: string | null;
  } | null;
  /** Latest server-synced per-cell answers ("r,c" -> letter) for non-submitters. */
  synced_cells?: Record<string, string> | null;
};

export type FinalEntry = {
  player_id: string;
  username: string;
  score: number;
  time_used_seconds: number;
  finished_by: 'submitted' | 'timeout';
  rank: number;
};

/**
 * Converts a per-cell answer map ("row,col" -> letter) into per-clue words
 * keyed "{clue_number}-{direction}", mirroring the client-side assembly.
 */
export function cellValuesToWords(
  clues: ClueGeometry[],
  cells: Record<string, string>
): SubmittedAnswers {
  const out: SubmittedAnswers = {};
  for (const clue of clues) {
    let word = '';
    for (let i = 0; i < clue.answer_length; i++) {
      const r = clue.direction === 'across' ? clue.row_start : clue.row_start + i;
      const c = clue.direction === 'across' ? clue.col_start + i : clue.col_start;
      word += cells[`${r},${c}`] ?? '';
    }
    out[`${clue.clue_number}-${clue.direction}`] = word;
  }
  return out;
}

/**
 * Pure end-of-round leaderboard computation. Every player who joined gets
 * exactly one row: early submitters keep their submission score; everyone
 * else is auto-scored from their latest synced answers (or 0 if none) with
 * the full round duration as their time.
 */
export function computeFinalLeaderboard(
  clues: FinalClue[],
  players: FinalPlayerInput[],
  durationSeconds: number
): FinalEntry[] {
  const scored = players.map((p) => {
    if (p.submission) {
      return {
        player_id: p.id,
        username: p.username,
        score: p.submission.score,
        time_used_seconds: p.submission.time_used_seconds,
        finished_by: 'submitted' as const,
        submitted_at: p.submission.submitted_at,
      };
    }
    const words = p.synced_cells ? cellValuesToWords(clues, p.synced_cells) : {};
    const result = scoreSubmission(clues, words);
    return {
      player_id: p.id,
      username: p.username,
      score: result.score,
      time_used_seconds: durationSeconds,
      finished_by: 'timeout' as const,
      submitted_at: null as string | null,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.time_used_seconds !== b.time_used_seconds) return a.time_used_seconds - b.time_used_seconds;
    const aSub = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
    const bSub = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
    if (aSub !== bSub) return aSub - bSub;
    return a.username.localeCompare(b.username);
  });

  return scored.map(({ submitted_at: _submitted_at, ...entry }, i) => ({ ...entry, rank: i + 1 }));
}

export const POINTS_PER_LETTER = 10;
export const WORD_BONUS = 25;
export const COMPLETION_BONUS = 100;

function normalize(word: string): string {
  return word.trim().toUpperCase();
}

export function scoreSubmission(
  clues: PuzzleClue[],
  submitted: SubmittedAnswers
): ScoreResult {
  let correct_letters = 0;
  let correct_words = 0;
  let total_letters = 0;
  let letterPoints = 0;
  let wordBonusPoints = 0;

  for (const clue of clues) {
    const key = `${clue.clue_number}-${clue.direction}`;
    const correct = normalize(clue.correct_answer);
    const guess = normalize(submitted[key] ?? '');

    total_letters += correct.length;

    if (guess === correct) {
      correct_words += 1;
      correct_letters += correct.length;
      letterPoints += correct.length * POINTS_PER_LETTER;
      wordBonusPoints += WORD_BONUS;
      continue;
    }

    // Partial match: credit only exact-position letter matches.
    const len = Math.min(guess.length, correct.length);
    for (let i = 0; i < len; i++) {
      if (guess[i] === correct[i]) {
        correct_letters += 1;
        letterPoints += POINTS_PER_LETTER;
      }
    }
  }

  const total_words = clues.length;
  const completionBonus = total_words > 0 && correct_words === total_words ? COMPLETION_BONUS : 0;

  return {
    score: letterPoints + wordBonusPoints + completionBonus,
    correct_letters,
    correct_words,
    total_letters,
    total_words,
  };
}
