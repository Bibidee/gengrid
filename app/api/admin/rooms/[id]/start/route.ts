import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

const COUNTDOWN_SECONDS = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { data: room, error: roomError } = await supabaseServer
    .from('rooms')
    .select('id, duration_seconds, status')
    .eq('id', id)
    .maybeSingle();

  if (roomError || !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.status !== 'waiting') {
    return NextResponse.json({ error: `Cannot start a room in status "${room.status}"` }, { status: 400 });
  }

  const starts_at = new Date(Date.now() + COUNTDOWN_SECONDS * 1000);
  const ends_at = new Date(starts_at.getTime() + room.duration_seconds * 1000);

  const { error } = await supabaseServer
    .from('rooms')
    .update({
      status: 'scheduled',
      starts_at: starts_at.toISOString(),
      ends_at: ends_at.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Failed to start room' }, { status: 500 });

  return NextResponse.json({ starts_at: starts_at.toISOString(), ends_at: ends_at.toISOString() });
}
