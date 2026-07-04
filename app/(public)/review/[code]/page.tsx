'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Grid, type GridClue } from '@/components/Grid';
import { ClueList, type PlayClue } from '@/components/ClueList';
import { loadPlayerSession } from '@/lib/player-session';

type LayoutPayload = {
  id: string;
  title: string;
  theme: string | null;
  board_size: number;
  black_cells: [number, number][];
  clue_numbers: Record<string, number>;
  clues: PlayClue[];
};

type ReviewPayload = {
  username: string;
  submitted_answers: Record<string, string>; // "{n}-{direction}" -> word
  grading: Record<string, boolean>;
  corrections: Record<string, string>; // correct word for WRONG clues only
  score: number;
  correct_words: number | null;
  total_words: number | null;
};

export default function ReviewPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();
  const router = useRouter();

  const [layout, setLayout] = useState<LayoutPayload | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [selectedClue, setSelectedClue] = useState<GridClue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadPlayerSession(roomCode);
    if (!session) {
      router.replace('/join');
      return;
    }

    (async () => {
      try {
        const reviewRes = await fetch(
          `/api/rooms/${roomCode}/review?session_token=${encodeURIComponent(session.session_token)}`
        );
        const reviewData = await reviewRes.json();
        if (reviewRes.status === 425) {
          setError('Board review unlocks after the round ends.');
          return;
        }
        if (!reviewRes.ok) {
          setError(reviewData.error ?? 'Failed to load your board');
          return;
        }

        const statusRes = await fetch(`/api/rooms/${roomCode}/status`);
        const status = await statusRes.json();
        if (!statusRes.ok || !status.puzzle_id) {
          setError('Room not found');
          return;
        }
        const layoutRes = await fetch(
          `/api/puzzles/${status.puzzle_id}/play?session_token=${encodeURIComponent(session.session_token)}`
        );
        const layoutData = await layoutRes.json();
        if (!layoutRes.ok) {
          setError(layoutData.error ?? 'Failed to load puzzle layout');
          return;
        }

        setReview(reviewData);
        setLayout(layoutData);
      } catch {
        setError('Network error loading your board');
      }
    })();
  }, [roomCode, router]);

  // Expand per-clue words back into per-cell letters for the grid.
  const cellValues = useMemo(() => {
    if (!layout || !review) return {};
    const out: Record<string, string> = {};
    for (const clue of layout.clues) {
      const word = review.submitted_answers[`${clue.clue_number}-${clue.direction}`] ?? '';
      for (let i = 0; i < clue.answer_length && i < word.length; i++) {
        const r = clue.direction === 'across' ? clue.row_start : clue.row_start + i;
        const c = clue.direction === 'across' ? clue.col_start + i : clue.col_start;
        if (word[i]) out[`${r},${c}`] = word[i];
      }
    }
    return out;
  }, [layout, review]);

  // Faint correctness tint per cell: green if the letter belongs to at least
  // one fully-correct word (green wins at crossings), red if it only belongs
  // to wrong words.
  const cellShading = useMemo(() => {
    if (!layout || !review) return {};
    const out: Record<string, 'correct' | 'wrong'> = {};
    const passes: Array<'wrong' | 'correct'> = ['wrong', 'correct'];
    for (const want of passes) {
      for (const clue of layout.clues) {
        const grade = review.grading[`${clue.clue_number}-${clue.direction}`];
        if ((grade === true ? 'correct' : 'wrong') !== want) continue;
        for (let i = 0; i < clue.answer_length; i++) {
          const r = clue.direction === 'across' ? clue.row_start : clue.row_start + i;
          const c = clue.direction === 'across' ? clue.col_start + i : clue.col_start;
          out[`${r},${c}`] = want;
        }
      }
    }
    return out;
  }, [layout, review]);

  // Tapping a word on the read-only grid jumps to its clue (across preferred
  // at crossings; ClueList follows the selection and switches tab on mobile).
  const handleSelectCell = (r: number, c: number) => {
    if (!layout) return;
    const match = layout.clues.find(
      (cl) =>
        (cl.direction === 'across' && cl.row_start === r && c >= cl.col_start && c < cl.col_start + cl.answer_length) ||
        (cl.direction === 'down' && cl.col_start === c && r >= cl.row_start && r < cl.row_start + cl.answer_length)
    );
    if (match) setSelectedClue(match);
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[#FF6B81]">{error}</p>
        <Link href={`/leaderboard/${roomCode}`} className="text-sm text-[#9CA3B8] underline">
          Back to leaderboard
        </Link>
      </main>
    );
  }

  if (!layout || !review) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-arena-mono text-sm text-[#9CA3B8]">Loading your board…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(11,9,20,0.85)] px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 pr-12">
          <div className="min-w-0">
            <h1 className="font-sg truncate text-base font-semibold text-[#F8FAFC] sm:text-xl">
              Your board — {layout.title}
            </h1>
            <p className="font-arena-mono text-[11px] text-[#8E87A8]">
              {review.username} · Room <span className="font-semibold text-[#6EE7F9]">{roomCode}</span>
              {review.correct_words != null && review.total_words != null
                ? ` · ${review.correct_words}/${review.total_words} words correct · ${review.score} pts`
                : ` · ${review.score} pts`}
            </p>
          </div>
          <Link
            href={`/leaderboard/${roomCode}`}
            className="btn-arena-ghost shrink-0 px-3 py-1.5 text-xs no-underline"
          >
            Leaderboard
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="min-w-0">
            <div className="cw-glass-frame max-w-full overflow-x-auto">
              <Grid
              size={layout.board_size}
              blackCells={layout.black_cells}
              clueNumbers={layout.clue_numbers}
              clues={layout.clues}
              values={cellValues}
              onChange={() => {}}
              selectedClue={selectedClue}
              onSelectCell={handleSelectCell}
              readOnly
              cellShading={cellShading}
              />
            </div>
            <p className="mt-2 text-xs text-[#64607A]">
              Read-only view of the answers you submitted.
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <ClueList
              clues={layout.clues}
              selectedClue={selectedClue}
              onSelect={setSelectedClue}
              grading={review.grading}
              corrections={review.corrections}
              submittedWords={review.submitted_answers}
              followSelection
            />
          </div>
        </div>
      </div>
    </main>
  );
}
