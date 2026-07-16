'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Grid, type GridClue } from '@/components/Grid';
import { ClueList, type PlayClue } from '@/components/ClueList';
import { Countdown } from '@/components/Countdown';
import { usePolling } from '@/lib/use-polling';
import { computeClockOffsetMs } from '@/lib/clock';
import { tickSound, goSound, clickSound, chordSound } from '@/lib/sound';
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
// Anti-cheat: leaving the game screen (switching tabs/apps) for longer than
// this auto-submits the player's answers as-is when they return.
const AWAY_LIMIT_MS = 45_000;

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
  const [timedOut, setTimedOut] = useState(false);
  // Manual submit asks for confirmation first; auto-submits (timer expiry,
  // away timeout) skip the prompt.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  // Cosmetic 3-2-1-GO overlay shown only when the player arrives within ~5s
  // of the round's server-authoritative start. Never affects timing.
  const [overlayText, setOverlayText] = useState<string | null>(null);
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
        const offset = playData.server_now
          ? computeClockOffsetMs(playData.server_now)
          : status.server_now
            ? computeClockOffsetMs(status.server_now)
            : 0;
        if (playData.server_now) setClockOffsetMs(computeClockOffsetMs(playData.server_now));

        // 3-2-1-GO reveal (client-side only): fires only for players who
        // land here within ~5s of the skew-corrected start; rejoiners
        // mid-round skip it. The round timer keeps running underneath.
        if (playData.starts_at && !hasSubmitted(roomCode)) {
          const sinceStart = Date.now() + offset - new Date(playData.starts_at).getTime();
          // Window covers lobby poll interval + status cache TTL so everyone
          // arriving off the redirect gets the sequence; later rejoins skip it.
          if (sinceStart >= -1000 && sinceStart < 8000) {
            const steps: Array<[string, number]> = [
              ['3', 0],
              ['2', 900],
              ['1', 1800],
              ['GO', 2700],
            ];
            for (const [label, delay] of steps) {
              setTimeout(() => {
                setOverlayText(label);
                if (label === 'GO') goSound();
                else tickSound();
              }, delay);
            }
            setTimeout(() => setOverlayText(null), 3500);
          }
        }
        if (playData.clues.length > 0) {
          // Start on the first across clue (payload order is not guaranteed).
          const sorted = [...playData.clues].sort(
            (a: PlayClue, b: PlayClue) => a.clue_number - b.clue_number
          );
          setSelectedClue(sorted.find((c: PlayClue) => c.direction === 'across') ?? sorted[0]);
        }

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

  // Cell-tap selection with crossword conventions: re-tapping the selected
  // cell toggles direction; moving within the current word keeps it; a fresh
  // cell prefers the word starting there (across first), then any word
  // passing through it. Plain array order caused crossing down words to
  // steal the selection from across clues.
  const lastCellRef = useRef<string | null>(null);
  const handleSelectCell = useCallback(
    (r: number, c: number) => {
      if (!puzzle) return;
      const key = `${r},${c}`;
      clickSound();
      const passesThrough = (cl: GridClue) =>
        cl.direction === 'across'
          ? cl.row_start === r && c >= cl.col_start && c < cl.col_start + cl.answer_length
          : cl.col_start === c && r >= cl.row_start && r < cl.row_start + cl.answer_length;

      const candidates = puzzle.clues.filter(passesThrough);
      if (candidates.length === 0) return;

      setSelectedClue((current) => {
        // Re-tap on the same cell: switch to the crossing word if there is one.
        if (lastCellRef.current === key && current && passesThrough(current)) {
          const crossing = candidates.find((cl) => cl.direction !== current.direction);
          lastCellRef.current = key;
          return crossing ?? current;
        }
        lastCellRef.current = key;
        // Moving within the currently selected word keeps it (so typing
        // focus-advance never flips direction mid-word).
        if (current && passesThrough(current)) return current;
        const acrossStart = candidates.find(
          (cl) => cl.direction === 'across' && cl.row_start === r && cl.col_start === c
        );
        const downStart = candidates.find(
          (cl) => cl.direction === 'down' && cl.row_start === r && cl.col_start === c
        );
        const across = candidates.find((cl) => cl.direction === 'across');
        const down = candidates.find((cl) => cl.direction === 'down');
        return acrossStart ?? downStart ?? across ?? down ?? current;
      });
    },
    [puzzle]
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
      chordSound();
      setSubmitted(true);
      markSubmitted(roomCode);
      setSubmitting(false);
    }
  }, [submitting, roomCode, submittedAnswers]);

  // Away-timeout: if the player leaves this screen (other tab, another app,
  // phone locked) past AWAY_LIMIT_MS, auto-submit what they have on return.
  // Browsers throttle hidden-tab timers, so we timestamp on hide and measure
  // on return rather than counting down while hidden.
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!puzzle) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_LIMIT_MS && !submittedRef.current) {
        setTimedOut(true);
        handleSubmit();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [puzzle, handleSubmit]);

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
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-[#FF6B81]">{error}</p>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-arena-mono text-sm text-[#94A3B8]">Loading puzzle…</p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div className="kicker">{timedOut ? 'Timed Out' : 'Answers Locked'}</div>
        <h1 className="font-sg text-2xl font-semibold tracking-tight text-[#F8FAFC]">
          {timedOut ? 'You were away too long.' : 'You submitted your crossword.'}
        </h1>
        <p className="max-w-sm font-light text-[#94A3B8]">
          {timedOut
            ? 'You left the game screen for over 45 seconds, so your answers were submitted as-is.'
            : 'Waiting for the round to end. Leaderboard unlocks when the timer reaches 00:00.'}
        </p>
        <div className="glass-card px-8 py-4">
          <Countdown startsAt={puzzle.starts_at} endsAt={puzzle.ends_at} offsetMs={clockOffsetMs} onExpire={handleExpire} />
        </div>
        <button
          type="button"
          onClick={() => setShowBoard((s) => !s)}
          className="text-sm font-semibold text-[#94A3B8] underline decoration-dotted hover:text-[#F8FAFC]"
        >
          {showBoard ? 'Hide your board' : 'View your board'}
        </button>
        {showBoard && (
          <div className="cw-glass-frame max-w-full overflow-x-auto">
            {/* Locked view of the player's own answers — no grading, no
                scores; correctness only appears post-game on the review page. */}
            <Grid
              size={puzzle.board_size}
              blackCells={puzzle.black_cells}
              clueNumbers={puzzle.clue_numbers}
              clues={puzzle.clues}
              values={values}
              onChange={() => {}}
              selectedClue={null}
              onSelectCell={() => {}}
              readOnly
            />
          </div>
        )}
        <p className="font-arena-mono text-xs text-[#5B7194]">Room {roomCode}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24 sm:pb-8">
      {overlayText && (
        <div className="cd-overlay">
          <div key={overlayText} className={`cd-num${overlayText === 'GO' ? ' go' : ''}`}>
            {overlayText}
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(6,8,22,0.85)] px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 pr-12">
          <div className="min-w-0">
            <h1 className="font-sg truncate text-base font-semibold text-[#F8FAFC] sm:text-xl">{puzzle.title}</h1>
            <p className="font-arena-mono text-[11px] text-[#7A8DB0]">
              Room <span className="font-semibold text-[#67E8F9]">{roomCode}</span>
              {puzzle.theme ? ` · ${puzzle.theme}` : ''}
            </p>
          </div>
          <Countdown startsAt={puzzle.starts_at} endsAt={puzzle.ends_at} offsetMs={clockOffsetMs} onExpire={handleExpire} ring />
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="min-w-0">
            <div className="cw-glass-frame max-w-full overflow-x-auto">
              <Grid
                size={puzzle.board_size}
                blackCells={puzzle.black_cells}
                clueNumbers={puzzle.clue_numbers}
                clues={puzzle.clues}
                values={values}
                onChange={handleChange}
                selectedClue={selectedClue}
                onSelectCell={handleSelectCell}
              />
            </div>

            {selectedClue && (
              <div className="mt-3 rounded-xl border border-[rgba(124,58,237,0.28)] bg-[rgba(124,58,237,0.14)] px-3 py-2 text-sm text-[#F8FAFC]">
                <span className="font-arena-mono mr-1 text-xs font-bold text-[#9D60FF]">
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
          onClick={() => setConfirmOpen(true)}
          disabled={submitting}
          className="btn-arena-primary hidden self-start px-7 py-2.5 sm:block"
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>

      {/* Confirm-before-submit: only the Yes button fires the real submit. */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,22,0.85)] px-6 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-sm px-7 py-6 text-center"
          >
            <p className="kicker mb-3">Submit Answers</p>
            <h2 className="font-sg mb-2 text-lg font-semibold text-[#F8FAFC]">
              Have you filled all the boxes?
            </h2>
            <p className="mb-6 text-sm text-[#94A3B8]">
              Once you submit, your answers are locked — you can&apos;t change them. Are you sure
              you want to submit?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  handleSubmit();
                }}
                className="btn-arena-primary px-8 py-2.5"
              >
                Yes, submit
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn-arena-ghost px-8 py-2.5"
              >
                No, keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Always-accessible submit on small screens; sits below content so it
          never covers the grid. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(6,8,22,0.9)] px-4 py-3 backdrop-blur-md sm:hidden">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={submitting}
          className="btn-arena-primary w-full px-6 py-3"
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </main>
  );
}
