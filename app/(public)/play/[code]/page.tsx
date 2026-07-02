'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Grid, type GridClue } from '@/components/Grid';
import { ClueList, type PlayClue } from '@/components/ClueList';
import { Countdown } from '@/components/Countdown';
import { loadPlayerSession, saveAnswers, loadAnswers } from '@/lib/player-session';

type PlayPayload = {
  id: string;
  title: string;
  theme: string | null;
  board_size: number;
  black_cells: [number, number][];
  clue_numbers: Record<string, number>;
  clues: PlayClue[];
  starts_at: string | null;
  ends_at: string | null;
};

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const roomCode = params.code.toUpperCase();
  const router = useRouter();

  const [puzzle, setPuzzle] = useState<PlayPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedClue, setSelectedClue] = useState<GridClue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const session = loadPlayerSession(roomCode);
    if (!session) {
      router.replace('/join');
      return;
    }
    // localStorage only exists client-side, so restoring saved answers must
    // happen in an effect rather than a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(loadAnswers(roomCode));

    (async () => {
      try {
        const statusRes = await fetch(`/api/rooms/${roomCode}/status`);
        const status = await statusRes.json();
        if (!statusRes.ok || !status.puzzle_id) {
          setError('This room has no puzzle assigned yet');
          return;
        }

        const playRes = await fetch(
          `/api/puzzles/${status.puzzle_id}/play?session_token=${encodeURIComponent(session.session_token)}`
        );
        const playData = await playRes.json();
        if (!playRes.ok) {
          setError(playData.error ?? 'Failed to load puzzle');
          return;
        }
        setPuzzle(playData);
        if (playData.clues.length > 0) setSelectedClue(playData.clues[0]);
      } catch {
        setError('Network error loading puzzle');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const handleChange = useCallback(
    (row: number, col: number, letter: string) => {
      setValues((prev) => {
        const next = { ...prev, [`${row},${col}`]: letter };
        saveAnswers(roomCode, next);
        return next;
      });
    },
    [roomCode]
  );

  const submittedAnswers = useMemo(() => {
    if (!puzzle) return {};
    const out: Record<string, string> = {};
    for (const clue of puzzle.clues) {
      let word = '';
      for (let i = 0; i < clue.answer_length; i++) {
        const r = clue.direction === 'across' ? clue.row_start : clue.row_start + i;
        const c = clue.direction === 'across' ? clue.col_start + i : clue.col_start;
        word += values[`${r},${c}`] ?? '';
      }
      out[`${clue.clue_number}-${clue.direction}`] = word;
    }
    return out;
  }, [puzzle, values]);

  const completed = useMemo(() => {
    const set = new Set<string>();
    for (const clue of puzzle?.clues ?? []) {
      const word = submittedAnswers[`${clue.clue_number}-${clue.direction}`] ?? '';
      if (word.length === clue.answer_length) set.add(`${clue.clue_number}-${clue.direction}`);
    }
    return set;
  }, [submittedAnswers, puzzle]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    const session = loadPlayerSession(roomCode);
    if (!session) return;
    setSubmitting(true);
    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token, submitted_answers: submittedAnswers }),
      });
    } finally {
      setSubmitted(true);
      setSubmitting(false);
      router.push(`/leaderboard/${roomCode}`);
    }
  }, [submitting, submitted, roomCode, submittedAnswers, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading puzzle…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{puzzle.title}</h1>
            {puzzle.theme && <p className="text-sm text-slate-500">{puzzle.theme}</p>}
          </div>
          <Countdown startsAt={puzzle.starts_at} endsAt={puzzle.ends_at} onExpire={handleSubmit} />
        </header>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="overflow-x-auto">
            <Grid
              size={puzzle.board_size}
              blackCells={puzzle.black_cells}
              clueNumbers={puzzle.clue_numbers}
              clues={puzzle.clues}
              values={values}
              onChange={handleChange}
              selectedClue={selectedClue}
              onSelectCell={(r, c) => {
                const match = puzzle.clues.find(
                  (cl) =>
                    (cl.direction === 'across' && cl.row_start === r && c >= cl.col_start && c < cl.col_start + cl.answer_length) ||
                    (cl.direction === 'down' && cl.col_start === c && r >= cl.row_start && r < cl.row_start + cl.answer_length)
                );
                if (match) setSelectedClue(match);
              }}
            />
          </div>

          <div className="flex-1">
            <ClueList clues={puzzle.clues} selectedClue={selectedClue} onSelect={setSelectedClue} completed={completed} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || submitted}
          className="self-start rounded-md bg-slate-900 px-6 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {submitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </main>
  );
}
