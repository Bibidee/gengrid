import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hashSessionToken } from '@/lib/session-token';
import { computeRoomStatus, type RoomStatus } from '@/lib/room-status';
import { finalizeRoom } from '@/lib/finalize';
import { gradeSubmission, type SubmittedAnswers } from '@/lib/scoring';

// Post-game board review: returns the CALLER'S OWN submitted answers only,
// and only after the room has finished. Never other players' answers.
// Correct answers are revealed ONLY here, ONLY for clues the caller got
// wrong — a deliberate post-game exception; live rooms never leak answers.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room_code = code.trim().toUpperCase();
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('session_token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 401 });
  }

  const tokenHash = hashSessionToken(sessionToken);

  const { data: player, error: playerError } = await supabaseServer
    .from('player_sessions')
    .select(
      'id, username, rooms!inner(id, room_code, status, starts_at, ends_at, puzzle_id, duration_seconds)'
    )
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const room = Array.isArray(player.rooms) ? player.rooms[0] : player.rooms;
  if (!room || room.room_code !== room_code) {
    return NextResponse.json({ error: 'Session does not match this room' }, { status: 403 });
  }

  const effective = computeRoomStatus({
    status: room.status as RoomStatus,
    starts_at: room.starts_at,
    ends_at: room.ends_at,
  });

  if (effective !== 'finished') {
    // Refuse before the end — no answers of any kind leak mid-round.
    return NextResponse.json(
      { error: 'Board review unlocks after the round ends', ended: false },
      { status: 425 }
    );
  }

  // Ensure finalization ran (it persists submissions rows for non-submitters).
  await finalizeRoom({
    id: room.id,
    status: room.status,
    starts_at: room.starts_at,
    ends_at: room.ends_at,
    puzzle_id: room.puzzle_id,
    duration_seconds: room.duration_seconds,
  });

  const { data: submission } = await supabaseServer
    .from('submissions')
    .select('submitted_answers, score, correct_words, total_words')
    .eq('player_id', player.id)
    .maybeSingle();

  const submitted: SubmittedAnswers =
    (submission?.submitted_answers as SubmittedAnswers | null) ?? {};

  // Per-clue correct/incorrect booleans (server-side read of correct_answer
  // stays inside lib/scoring.ts). The room is finished (checked above), so
  // the correct word is also revealed — but only for WRONG clues.
  let grading: Record<string, boolean> = {};
  const corrections: Record<string, string> = {};
  if (room.puzzle_id) {
    const { data: clues } = await supabaseServer
      .from('puzzle_clues')
      .select('clue_number, direction, correct_answer')
      .eq('puzzle_id', room.puzzle_id);
    grading = gradeSubmission(clues ?? [], submitted);
    for (const clue of clues ?? []) {
      const key = `${clue.clue_number}-${clue.direction}`;
      if (grading[key] === false) {
        corrections[key] = String(clue.correct_answer).trim().toUpperCase();
      }
    }
  }

  return NextResponse.json({
    username: player.username,
    submitted_answers: submitted,
    grading,
    corrections,
    score: submission?.score ?? 0,
    correct_words: submission?.correct_words ?? null,
    total_words: submission?.total_words ?? null,
  });
}
