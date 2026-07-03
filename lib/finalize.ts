// Single idempotent server-side finalization path for a room.
//
// Exactly one caller "wins" the finalization race via an atomic conditional
// UPDATE on rooms.status (WHERE status <> 'finished'); the winner scores every
// player_session in the room (submissions win, else latest synced answers,
// else 0) and persists score/rank/time onto player_sessions. Everyone else
// reads the persisted result. A Redis snapshot absorbs poll bursts.
//
// NEVER returns correct answers — only scores/ranks.

import { supabaseServer } from './supabase-server';
import { redis } from './redis';
import {
  cellValuesToWords,
  computeFinalLeaderboard,
  scoreSubmission,
  type FinalClue,
  type FinalEntry,
  type FinalPlayerInput,
} from './scoring';

export type RoomForFinalize = {
  id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  puzzle_id: string | null;
  duration_seconds: number;
};

export type FinalizeResult =
  | { state: 'not_ended'; ends_at: string | null }
  | { state: 'finalizing' }
  | { state: 'final'; leaderboard: FinalEntry[] };

const SNAPSHOT_TTL_SECONDS = 6 * 60 * 60;

function snapshotKey(roomId: string) {
  return `final-leaderboard:${roomId}`;
}

export function syncedAnswersKey(playerId: string) {
  return `synced-answers:${playerId}`;
}

export async function finalizeRoom(
  room: RoomForFinalize,
  opts: { force?: boolean } = {}
): Promise<FinalizeResult> {
  // Fast path: finalized snapshot already cached.
  const cached = await redis.get<FinalEntry[]>(snapshotKey(room.id));
  if (cached) return { state: 'final', leaderboard: cached };

  const now = Date.now();
  const endsAtMs = room.ends_at ? new Date(room.ends_at).getTime() : null;
  const ended = room.status === 'finished' || (endsAtMs !== null && now >= endsAtMs);

  if (!ended && !opts.force) {
    return { state: 'not_ended', ends_at: room.ends_at };
  }

  if (room.status !== 'finished') {
    // Atomic race guard: only one concurrent caller flips status to
    // 'finished' and gets a row back; that caller scores everyone.
    const update: Record<string, unknown> = {
      status: 'finished',
      updated_at: new Date(now).toISOString(),
    };
    if (endsAtMs === null || endsAtMs > now) {
      // Force-end (admin) or a room that never had an end time: close it now.
      update.ends_at = new Date(now).toISOString();
    }

    const { data: won, error } = await supabaseServer
      .from('rooms')
      .update(update)
      .eq('id', room.id)
      .neq('status', 'finished')
      .select('id, ends_at');

    if (error) throw new Error(`Failed to acquire finalization lock: ${error.message}`);

    if (won && won.length > 0) {
      const leaderboard = await scoreAndPersist(room);
      await redis.set(snapshotKey(room.id), leaderboard, { ex: SNAPSHOT_TTL_SECONDS });
      return { state: 'final', leaderboard };
    }
    // Lost the race — fall through and read the persisted result.
  }

  // Room is marked finished in the DB. Read persisted ranks.
  const [{ data: players }, { data: subs }] = await Promise.all([
    supabaseServer
      .from('player_sessions')
      .select('id, username, score, rank, time_used_seconds, status')
      .eq('room_id', room.id)
      .order('rank', { ascending: true }),
    supabaseServer
      .from('submissions')
      .select('player_id, correct_words, total_words')
      .eq('room_id', room.id),
  ]);

  const wordsByPlayer = new Map(
    (subs ?? []).map((s) => [s.player_id as string, s])
  );

  const rows = players ?? [];

  if (rows.some((p) => p.rank == null)) {
    // Winner still writing, or a legacy/crashed finalization. Try to take a
    // short Redis NX lock and repair; otherwise report 'finalizing'.
    const lock = await redis.set(`finalize-lock:${room.id}`, '1', { nx: true, ex: 30 });
    if (lock) {
      const leaderboard = await scoreAndPersist(room);
      await redis.set(snapshotKey(room.id), leaderboard, { ex: SNAPSHOT_TTL_SECONDS });
      return { state: 'final', leaderboard };
    }
    return { state: 'finalizing' };
  }

  const leaderboard: FinalEntry[] = rows.map((p) => ({
    player_id: p.id,
    username: p.username,
    score: p.score ?? 0,
    time_used_seconds: p.time_used_seconds ?? room.duration_seconds,
    finished_by: p.status === 'submitted' ? 'submitted' : 'timeout',
    rank: p.rank as number,
    correct_words: wordsByPlayer.get(p.id)?.correct_words ?? null,
    total_words: wordsByPlayer.get(p.id)?.total_words ?? null,
  }));

  await redis.set(snapshotKey(room.id), leaderboard, { ex: SNAPSHOT_TTL_SECONDS });
  return { state: 'final', leaderboard };
}

async function scoreAndPersist(room: RoomForFinalize): Promise<FinalEntry[]> {
  const [{ data: players }, { data: submissions }, { data: clues }] = await Promise.all([
    supabaseServer
      .from('player_sessions')
      .select('id, username, status')
      .eq('room_id', room.id),
    supabaseServer
      .from('submissions')
      .select('player_id, score, time_used_seconds, submitted_at, correct_words, total_words')
      .eq('room_id', room.id),
    room.puzzle_id
      ? supabaseServer
          .from('puzzle_clues')
          .select('clue_number, direction, row_start, col_start, answer_length, correct_answer')
          .eq('puzzle_id', room.puzzle_id)
      : Promise.resolve({ data: [] as FinalClue[] }),
  ]);

  const subByPlayer = new Map(
    (submissions ?? []).map((s) => [s.player_id as string, s])
  );

  const playerRows = players ?? [];

  // Pull latest synced answers for non-submitters from Redis.
  const syncedByPlayer = new Map<string, Record<string, string> | null>();
  await Promise.all(
    playerRows
      .filter((p) => !subByPlayer.has(p.id))
      .map(async (p) => {
        const cells = await redis.get<Record<string, string>>(syncedAnswersKey(p.id));
        syncedByPlayer.set(p.id, cells ?? null);
      })
  );

  const inputs: FinalPlayerInput[] = playerRows.map((p) => {
    const sub = subByPlayer.get(p.id);
    return {
      id: p.id,
      username: p.username,
      submission: sub
        ? {
            score: sub.score,
            time_used_seconds: sub.time_used_seconds,
            submitted_at: sub.submitted_at,
            correct_words: sub.correct_words,
            total_words: sub.total_words,
          }
        : null,
      synced_cells: syncedByPlayer.get(p.id) ?? null,
    };
  });

  const leaderboard = computeFinalLeaderboard(
    (clues ?? []) as FinalClue[],
    inputs,
    room.duration_seconds
  );

  // Persist a submissions row for every auto-scored non-submitter too, so
  // words-correct counts and post-game board review work for everyone.
  // ignoreDuplicates makes this race-safe against a late player submit.
  const finalClues = (clues ?? []) as FinalClue[];
  const autoRows = playerRows
    .filter((p) => !subByPlayer.has(p.id))
    .map((p) => {
      const words = cellValuesToWords(finalClues, syncedByPlayer.get(p.id) ?? {});
      const result = scoreSubmission(finalClues, words);
      return {
        room_id: room.id,
        player_id: p.id,
        submitted_answers: words,
        score: result.score,
        correct_letters: result.correct_letters,
        correct_words: result.correct_words,
        total_letters: result.total_letters,
        total_words: result.total_words,
        time_used_seconds: room.duration_seconds,
      };
    });
  if (autoRows.length > 0) {
    await supabaseServer
      .from('submissions')
      .upsert(autoRows, { onConflict: 'player_id', ignoreDuplicates: true });
  }

  await Promise.all(
    leaderboard.map((entry) =>
      supabaseServer
        .from('player_sessions')
        .update({
          score: entry.score,
          rank: entry.rank,
          time_used_seconds: entry.time_used_seconds,
        })
        .eq('id', entry.player_id)
    )
  );

  return leaderboard;
}
