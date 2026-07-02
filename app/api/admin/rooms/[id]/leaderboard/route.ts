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
    .from('player_sessions')
    .select('id, username, score, time_used_seconds, submitted_at, status, joined_at')
    .eq('room_id', id)
    .order('score', { ascending: false, nullsFirst: false })
    .order('time_used_seconds', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });

  return NextResponse.json({ leaderboard: data });
}
