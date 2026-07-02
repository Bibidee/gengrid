import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hashSessionToken } from '@/lib/session-token';
import { scoreSubmission, type SubmittedAnswers } from '@/lib/scoring';

function scoreSummary(row: {
  score: number;
  correct_letters: number;
  correct_words: number;
  total_letters: number;
  total_words: number;
  time_used_seconds: number;
}) {
  return {
    score: row.score,
    correct_letters: row.correct_letters,
    correct_words: row.correct_words,
    total_letters: row.total_letters,
    total_words: row.total_words,
    time_used_seconds: row.time_used_seconds,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionToken = typeof body?.session_token === 'string' ? body.session_token : '';
  const submittedAnswers: SubmittedAnswers =
    body?.submitted_answers && typeof body.submitted_answers === 'object' ? body.submitted_answers : {};

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 401 });
  }

  const tokenHash = hashSessionToken(sessionToken);

  const { data: player, error: playerError } = await supabaseServer
    .from('player_sessions')
    .select('id, room_id, joined_at, rooms!inner(id, ends_at, starts_at, puzzle_id)')
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const room = Array.isArray(player.rooms) ? player.rooms[0] : player.rooms;
  if (!room) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Idempotent retry: if this player already submitted, return their
  // existing score rather than erroring or double-scoring — even if the
  // retry happens to arrive after ends_at.
  const { data: existing, error: existingError } = await supabaseServer
    .from('submissions')
    .select('score, correct_letters, correct_words, total_letters, total_words, time_used_seconds')
    .eq('player_id', player.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to check existing submission' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(scoreSummary(existing));
  }

  // Server-clock-only lateness check for genuinely new submissions.
  if (room.ends_at && Date.now() > new Date(room.ends_at).getTime()) {
    return NextResponse.json({ error: 'Submission window has closed' }, { status: 409 });
  }

  const { data: clues, error: cluesError } = await supabaseServer
    .from('puzzle_clues')
    .select('clue_number, direction, correct_answer')
    .eq('puzzle_id', room.puzzle_id);

  if (cluesError || !clues) {
    return NextResponse.json({ error: 'Failed to load puzzle' }, { status: 500 });
  }

  const result = scoreSubmission(clues, submittedAnswers);

  const startsAtMs = room.starts_at ? new Date(room.starts_at).getTime() : Date.now();
  const time_used_seconds = Math.max(0, Math.round((Date.now() - startsAtMs) / 1000));

  const { error: insertError } = await supabaseServer.from('submissions').insert({
    room_id: room.id,
    player_id: player.id,
    submitted_answers: submittedAnswers,
    score: result.score,
    correct_letters: result.correct_letters,
    correct_words: result.correct_words,
    total_letters: result.total_letters,
    total_words: result.total_words,
    time_used_seconds,
  });

  if (insertError) {
    // Unique-violation race: another request for the same player just won.
    if (insertError.code === '23505') {
      const { data: raceExisting } = await supabaseServer
        .from('submissions')
        .select('score, correct_letters, correct_words, total_letters, total_words, time_used_seconds')
        .eq('player_id', player.id)
        .maybeSingle();
      if (raceExisting) return NextResponse.json(scoreSummary(raceExisting));
    }
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  await supabaseServer
    .from('player_sessions')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      score: result.score,
      time_used_seconds,
    })
    .eq('id', player.id);

  return NextResponse.json(scoreSummary({ ...result, time_used_seconds }));
}
