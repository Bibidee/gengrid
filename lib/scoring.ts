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
