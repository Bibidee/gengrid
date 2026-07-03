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
    .from('submissions')
    .select(
      'id, player_id, submitted_answers, score, correct_letters, correct_words, total_letters, total_words, submitted_at, time_used_seconds, player_sessions(username)'
    )
    .eq('room_id', id)
    .order('score', { ascending: false })
    .order('time_used_seconds', { ascending: true })
    .order('submitted_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });

  return NextResponse.json({ submissions: data });
}
