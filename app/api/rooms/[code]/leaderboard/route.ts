import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { computeRoomStatus, type RoomStatus } from '@/lib/room-status';
import { finalizeRoom } from '@/lib/finalize';

// The public leaderboard reveals NOTHING until the room has ended (server
// clock). The first poll after ends_at lazily triggers the idempotent
// finalization, which scores every joined player exactly once.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room_code = code.trim().toUpperCase();

  const { data: room, error: roomError } = await supabaseServer
    .from('rooms')
    .select('id, status, starts_at, ends_at, puzzle_id, duration_seconds')
    .eq('room_code', room_code)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const effective = computeRoomStatus({
    status: room.status as RoomStatus,
    starts_at: room.starts_at,
    ends_at: room.ends_at,
  });

  if (effective !== 'finished') {
    // Not ended yet: no scores, no ranks, no player progress of any kind.
    return NextResponse.json(
      { ended: false, status: effective, ends_at: room.ends_at },
      { status: 425 }
    );
  }

  const result = await finalizeRoom(room);

  if (result.state === 'not_ended') {
    return NextResponse.json(
      { ended: false, status: effective, ends_at: result.ends_at },
      { status: 425 }
    );
  }

  if (result.state === 'finalizing') {
    return NextResponse.json({ ended: true, finalizing: true }, { status: 202 });
  }

  return NextResponse.json({ ended: true, finalizing: false, leaderboard: result.leaderboard });
}
