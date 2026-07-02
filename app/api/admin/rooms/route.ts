import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { generateRoomCode } from '@/lib/room-code';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseServer
    .from('rooms')
    .select('id, room_name, room_code, puzzle_id, duration_seconds, status, starts_at, ends_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load rooms' }, { status: 500 });

  return NextResponse.json({ rooms: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const room_name = typeof body?.room_name === 'string' ? body.room_name.trim() : '';
  const puzzle_id = typeof body?.puzzle_id === 'string' ? body.puzzle_id : '';
  const duration_seconds = Number(body?.duration_seconds);
  const room_code = typeof body?.room_code === 'string' && body.room_code.trim() ? body.room_code.trim().toUpperCase() : null;

  if (!room_name || !puzzle_id || !Number.isFinite(duration_seconds) || duration_seconds <= 0) {
    return NextResponse.json(
      { error: 'room_name, puzzle_id, and a positive duration_seconds are required' },
      { status: 400 }
    );
  }

  const { data: puzzle, error: puzzleError } = await supabaseServer
    .from('puzzles')
    .select('id, status')
    .eq('id', puzzle_id)
    .maybeSingle();

  if (puzzleError || !puzzle) return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
  if (puzzle.status !== 'ready') {
    return NextResponse.json({ error: 'Only puzzles with status=ready can be used for a room' }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codeToTry = room_code ?? generateRoomCode();
    const { data: room, error: insertError } = await supabaseServer
      .from('rooms')
      .insert({
        room_name,
        room_code: codeToTry,
        puzzle_id,
        duration_seconds,
        status: 'waiting',
        created_by: auth.adminId,
      })
      .select('id, room_code')
      .single();

    if (!insertError) {
      return NextResponse.json({ id: room.id, room_code: room.room_code }, { status: 201 });
    }
    if (insertError.code === '23505') {
      if (room_code) {
        return NextResponse.json({ error: 'That room code is already in use' }, { status: 409 });
      }
      continue; // regenerate and retry
    }
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Could not generate a unique room code, try again' }, { status: 500 });
}
