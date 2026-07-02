import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { data, error } = await supabaseServer
    .from('rooms')
    .select('id, room_name, room_code, puzzle_id, duration_seconds, status, starts_at, ends_at, puzzles(title)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  return NextResponse.json(data);
}
