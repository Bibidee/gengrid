import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getCached } from '@/lib/redis';
import { computeRoomStatus } from '@/lib/room-status';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room_code = code.trim().toUpperCase();

  const payload = await getCached(`room-status:${room_code}`, 3, async () => {
    const { data: room, error: roomError } = await supabaseServer
      .from('rooms')
      .select('id, room_name, status, starts_at, ends_at, puzzle_id')
      .eq('room_code', room_code)
      .maybeSingle();

    if (roomError || !room) {
      return null;
    }

    const { count } = await supabaseServer
      .from('player_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id);

    // Latest usernames for the lobby's live-joiners display. Usernames are
    // public within a room — no tokens or ids leave the server here.
    const { data: recent } = await supabaseServer
      .from('player_sessions')
      .select('username, joined_at')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: false })
      .limit(12);

    return {
      status: computeRoomStatus(room),
      room_name: room.room_name,
      player_count: count ?? 0,
      starts_at: room.starts_at,
      ends_at: room.ends_at,
      puzzle_id: room.puzzle_id,
      recent_players: (recent ?? []).map((p) => p.username),
    };
  });

  if (!payload) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // server_now sits OUTSIDE the cache so clients can compute clock-skew
  // offsets from a fresh server timestamp on every poll.
  return NextResponse.json({ ...payload, server_now: new Date().toISOString() });
}
