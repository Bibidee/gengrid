import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getCached } from '@/lib/redis';
import { hashSessionToken } from '@/lib/session-token';

const TOP_N = 20;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room_code = code.trim().toUpperCase();
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('session_token');

  const { data: room, error: roomError } = await supabaseServer
    .from('rooms')
    .select('id')
    .eq('room_code', room_code)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const top = await getCached(`leaderboard:${room.id}`, 3, async () => {
    const { data } = await supabaseServer
      .from('player_sessions')
      .select('id, username, score, time_used_seconds, submitted_at')
      .eq('room_id', room.id)
      .eq('status', 'submitted')
      .order('score', { ascending: false })
      .order('time_used_seconds', { ascending: true })
      .order('submitted_at', { ascending: true })
      .limit(TOP_N);
    return data ?? [];
  });

  const response: {
    leaderboard: typeof top;
    caller?: { rank: number; username: string; score: number | null };
  } = { leaderboard: top };

  if (sessionToken) {
    const tokenHash = hashSessionToken(sessionToken);
    const { data: caller } = await supabaseServer
      .from('player_sessions')
      .select('id, username, score')
      .eq('room_id', room.id)
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    if (caller) {
      const inTop = top.findIndex((p) => p.id === caller.id);
      if (inTop === -1) {
        // Compute the caller's rank among all submitted players without
        // exposing the full player list.
        const { count } = await supabaseServer
          .from('player_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .eq('status', 'submitted')
          .gt('score', caller.score ?? -1);
        response.caller = { rank: (count ?? 0) + 1, username: caller.username, score: caller.score };
      }
    }
  }

  return NextResponse.json(response);
}
