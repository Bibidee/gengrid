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
    .from('templates')
    .select('id, name, board_size, rows, cols, grid_layout, clue_slots, source')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  return NextResponse.json(data);
}
