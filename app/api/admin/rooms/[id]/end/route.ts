import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { finalizeRoom } from '@/lib/finalize';

// Admin force-end: closes the room now AND runs the same idempotent
// finalization path used by the lazy leaderboard trigger.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { data: room, error } = await supabaseServer
    .from('rooms')
    .select('id, status, starts_at, ends_at, puzzle_id, duration_seconds')
    .eq('id', id)
    .maybeSingle();

  if (error || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  try {
    const result = await finalizeRoom(room, { force: true });
    return NextResponse.json({ ok: true, state: result.state });
  } catch {
    return NextResponse.json({ error: 'Failed to end room' }, { status: 500 });
  }
}
