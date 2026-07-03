'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Grid, type GridClue } from '@/components/Grid';
import { ClueList, type PlayClue } from '@/components/ClueList';
import { Countdown } from '@/components/Countdown';
import { usePolling } from '@/lib/use-polling';
import { computeClockOffsetMs } from '@/lib/clock';
import {
  loadPlayerSession,
  saveAnswers,
  loadAnswers,
  markSubmitted,
  hasSubmitted,
} from '@/lib/player-session';

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
  synced_answers: Record<string, string> | null;
  server_now?: string;
};

const SYNC_INTERVAL_MS = 15_000;
const OFFSET_REFRESH_MS = 30_000;

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
  // server clock minus device clock; countdowns use Date.now() + offset.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  // Refs so sync/beacon handlers always see the latest state without
  // re-registering listeners on every keystroke.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;

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
    if (hasSubmitted(roomCode)) setSubmitted(true);

    (async () => {
      try {
        const statusRes = await fetch(`/api/rooms/${roomCode}/status`);
        const status = await statusRes.json();
        if (statusRes.ok && status.server_now) {
          setClockOffsetMs(computeClockOffsetMs(status.server_now));
        }
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
        if (playData.server_now) setClockOffsetMs(computeClockOffsetMs(playData.server_now));
        if (playData.clues.length > 0) setSelectedClue(playData.clues[0]);

        // Restore fallback: localStorage empty (new device/cleared) but the
        // server has this player's last synced answers.
        const local = loadAnswers(roomCode);
        if (Object.keys(local).length === 0 && playData.synced_answers) {
          setValues(playData.synced_answers);
          saveAnswers(roomCode, playData.synced_answers);
        }
      } catch {
        setError('Network error loading puzzle');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Periodic server sync of in-progress answers (every ~15-17s, never per
  // keystroke), plus a keepalive beacon when the tab hides or unloads.
  useEffect(() => {
    const session = loadPlayerSession(roomCode);
    if (!session) return;

    const payload = () =>
      JSON.stringify({ session_token: session.session_token, answers: valuesRef.current });

    const syncNow = () => {
      if (submittedRef.current) return;
      if (Object.keys(valuesRef.current).length === 0) return;
      fetch('/api/answers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload(),
        keepalive: true,
      }).catch(() => {});
    };

    const beacon = () => {
      if (submittedRef.current) return;
      if (Object.keys(valuesRef.current).length === 0) return;
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/answers/sync', payload());
      } else {
        syncNow();
      }
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const tick = () => {
      syncNow();
      timeoutId = setTimeout(tick, SYNC_INTERVAL_MS + Math.random() * 2000);
    };
    timeoutId = setTimeout(tick, SYNC_INTERVAL_MS + Math.random() * 2000);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') beacon();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', beacon);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', beacon);
    };
  }, [roomCode]);

  // Refresh the clock-skew offset periodically from the status endpoint so a
  // drifting/wrong device clock never desyncs the visible countdown.
  usePolling(
    async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.server_now) setClockOffsetMs(computeClockOffsetMs(data.server_now));
      } catch {
        // transient network error — keep last known offset
      }
    },
    OFFSET_REFRESH_MS,
    puzzle != null
  );

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

  // Early submit only locks this player's answers — it does NOT navigate to
  // the leaderboard. The waiting screen keeps the countdown visible.
  const handleSubmit = useCallback(async () => {
    if (submitting || submittedRef.current) return;
    const session = loadPlayerSession(roomCode);
    if (!session) return;
    setSubmitting(true);
    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token, submitted_answers: submittedAnswers }),
        keepalive: true,
      });
    } finally {
      setSubmitted(true);
      markSubmitted(roomCode);
      setSubmitting(false);
    }
  }, [submitting, roomCode, submittedAnswers]);

  // Timer hit 00:00: auto-submit anyone who hasn't, then everyone moves to
  // the leaderboard (which only unlocks server-side after ends_at).
  const handleExpire = useCallback(async () => {
    if (!submittedRef.current) {
      await handleSubmit();
    }
    router.push(`/leaderboard/${roomCode}`);
  }, [handleSubmit, router, roomCode]);

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

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">You submitted your crossword.</h1>
        <p className="max-w-sm text-slate-600">
          Waiting for the round to end. Leaderboard unlocks when the timer reaches 00:00.
        </p>
        <div className="rounded-lg border border-slate-200 bg-white px-8 py-4 shadow-sm">
          <Countdown startsAt={puzzle.starts_at} endsAt={puzzle.ends_at} offsetMs={clockOffsetMs} onExpire={handleExpire} />
        </div>
        <p className="text-xs text-slate-400">Room {roomCode}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24 sm:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-xl">{puzzle.title}</h1>
            <p className="text-xs text-slate-500">
              Room <span className="font-mono font-semibold">{roomCode}</span>
              {puzzle.theme ? ` · ${puzzle.theme}` : ''}
            </p>
          </div>
          <Countdown startsAt={puzzle.starts_at} endsAt={puzzle.ends_at} offsetMs={clockOffsetMs} onExpire={handleExpire} />
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="min-w-0">
            <div className="max-w-full overflow-x-auto pb-1">
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

            {selectedClue && (
              <div className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-slate-800">
                <span className="mr-1 font-mono text-xs font-bold text-slate-500">
                  {selectedClue.clue_number}
                  {selectedClue.direction === 'across' ? 'A' : 'D'}.
                </span>
                {puzzle.clues.find(
                  (c) => c.clue_number === selectedClue.clue_number && c.direction === selectedClue.direction
                )?.clue_text ?? ''}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <ClueList clues={puzzle.clues} selectedClue={selectedClue} onSelect={setSelectedClue} completed={completed} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="hidden self-start rounded-md bg-slate-900 px-6 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 sm:block"
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>

      {/* Always-accessible submit on small screens; sits below content so it
          never covers the grid. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-6 py-3 font-semibold text-white transition disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </main>
  );
}
