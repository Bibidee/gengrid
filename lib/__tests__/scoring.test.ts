import { describe, it, expect } from 'vitest';
import {
  scoreSubmission,
  POINTS_PER_LETTER,
  WORD_BONUS,
  COMPLETION_BONUS,
  type PuzzleClue,
} from '../scoring';

const CLUES: PuzzleClue[] = [
  { clue_number: 1, direction: 'across', correct_answer: 'VALIDATOR' },
  { clue_number: 2, direction: 'down', correct_answer: 'GEN' },
];

describe('scoreSubmission', () => {
  it('awards full credit and completion bonus when everything is correct', () => {
    const result = scoreSubmission(CLUES, {
      '1-across': 'validator',
      '2-down': 'gen',
    });

    expect(result.correct_words).toBe(2);
    expect(result.correct_letters).toBe(12); // 9 + 3
    expect(result.total_words).toBe(2);
    expect(result.total_letters).toBe(12);
    expect(result.score).toBe(
      12 * POINTS_PER_LETTER + 2 * WORD_BONUS + COMPLETION_BONUS
    );
  });

  it('credits only exact-position letters on a partial match, no completion bonus', () => {
    const result = scoreSubmission(CLUES, {
      '1-across': 'VALIDATXR', // 8/9 letters positionally correct
      '2-down': 'GEO', // 2/3 letters positionally correct (G, E)
    });

    expect(result.correct_words).toBe(0);
    expect(result.correct_letters).toBe(10); // 8 + 2
    expect(result.score).toBe(10 * POINTS_PER_LETTER);
  });

  it('handles a missing answer as entirely wrong with no crash', () => {
    const result = scoreSubmission(CLUES, { '1-across': 'VALIDATOR' });
    expect(result.correct_words).toBe(1);
    expect(result.correct_letters).toBe(9);
    expect(result.score).toBe(9 * POINTS_PER_LETTER + WORD_BONUS);
  });

  it('handles submitted answers shorter or longer than the correct answer', () => {
    const result = scoreSubmission(CLUES, {
      '1-across': 'VAL', // short guess, first 3 letters correct
      '2-down': 'GENERAL', // long guess, first 3 letters correct
    });
    expect(result.correct_words).toBe(0); // neither guess equals the full correct answer
    expect(result.correct_letters).toBe(6); // 3 (VAL) + 3 (GEN of GENERAL)
  });
});
