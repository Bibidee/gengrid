import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateSessionToken, hashSessionToken } from '@/lib/session-token';
import { computeRoomStatus } from '@/lib/room-status';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const roomCodeRaw = typeof body?.room_code === 'string' ? body.room_code : '';
  const usernameRaw = typeof body?.username === 'string' ? body.username : '';

  const room_code = roomCodeRaw.trim().toUpperCase();
  const username = usernameRaw.trim();

  if (!room_code || !username) {
    return NextResponse.json({ error: 'room_code and username are required' }, { status: 400 });
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: 'username must be 2-20 characters' }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabaseServer
    .from('rooms')
    .select('id, status, starts_at, ends_at')
    .eq('room_code', room_code)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ error: 'Failed to look up room' }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const effectiveStatus = computeRoomStatus(room);
  if (effectiveStatus === 'finished') {
    return NextResponse.json({ error: 'This room has already finished' }, { status: 409 });
  }

  const { data: existing, error: existingError } = await supabaseServer
    .from('player_sessions')
    .select('id')
    .eq('room_id', room.id)
    .eq('username', username)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to check username' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ error: 'Username already taken in this room' }, { status: 409 });
  }

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  const { data: player, error: insertError } = await supabaseServer
    .from('player_sessions')
    .insert({
      room_id: room.id,
      username,
      session_token_hash: tokenHash,
      status: 'joined',
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Username already taken in this room' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }

  return NextResponse.json({
    player_id: player.id,
    session_token: token,
  });
}
