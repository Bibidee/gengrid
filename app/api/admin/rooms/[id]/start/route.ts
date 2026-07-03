import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

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

  // Immediate start: the game begins the moment the admin clicks Start.
  // Everyone derives their countdown from these shared server timestamps,
  // so the start is simultaneous across devices ('scheduled' is now unused,
  // but readers stay tolerant of it).
  const starts_at = new Date();
  const ends_at = new Date(starts_at.getTime() + room.duration_seconds * 1000);

  const { error } = await supabaseServer
    .from('rooms')
    .update({
      status: 'live',
      starts_at: starts_at.toISOString(),
      ends_at: ends_at.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Failed to start room' }, { status: 500 });

  return NextResponse.json({ starts_at: starts_at.toISOString(), ends_at: ends_at.toISOString() });
}
