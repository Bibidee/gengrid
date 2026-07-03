import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hashSessionToken } from '@/lib/session-token';
import { redis } from '@/lib/redis';
import { syncedAnswersKey } from '@/lib/finalize';

const SYNC_TTL_SECONDS = 6 * 60 * 60;
const MAX_CELLS = 400;

// Periodic (NOT per-keypress) sync of a player's in-progress per-cell
// answers. Finalization uses these for players who never pressed submit.
// Body may arrive via sendBeacon (text/plain), so parse JSON manually.
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as { session_token?: unknown; answers?: unknown };
  const sessionToken = typeof b?.session_token === 'string' ? b.session_token : '';
  const answersRaw =
    b?.answers && typeof b.answers === 'object' && !Array.isArray(b.answers)
      ? (b.answers as Record<string, unknown>)
      : null;

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 401 });
  }
  if (!answersRaw) {
    return NextResponse.json({ error: 'answers object is required' }, { status: 400 });
  }

  // Sanitize: only "r,c" keys with single-letter values, bounded size.
  const answers: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(answersRaw)) {
    if (!/^\d{1,2},\d{1,2}$/.test(key)) continue;
    if (typeof value !== 'string') continue;
    const letter = value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
    if (!letter) continue;
    answers[key] = letter;
    if (++count >= MAX_CELLS) break;
  }

  const tokenHash = hashSessionToken(sessionToken);

  const { data: player, error: playerError } = await supabaseServer
    .from('player_sessions')
    .select('id, status, rooms!inner(id, status, ends_at)')
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const room = Array.isArray(player.rooms) ? player.rooms[0] : player.rooms;

  // After submit or after the round ends, syncs are ignored (submission /
  // finalized snapshot win).
  if (player.status === 'submitted') {
    return NextResponse.json({ ok: true, ignored: 'already_submitted' });
  }
  if (
    room &&
    (room.status === 'finished' ||
      (room.ends_at && Date.now() > new Date(room.ends_at).getTime()))
  ) {
    return NextResponse.json({ ok: true, ignored: 'round_ended' });
  }

  await redis.set(syncedAnswersKey(player.id), answers, { ex: SYNC_TTL_SECONDS });

  // Mark the player as actively playing (best effort).
  if (player.status === 'joined') {
    await supabaseServer
      .from('player_sessions')
      .update({ status: 'active' })
      .eq('id', player.id)
      .eq('status', 'joined');
  }

  return NextResponse.json({ ok: true });
}
