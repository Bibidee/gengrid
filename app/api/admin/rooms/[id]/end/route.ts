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

  const { error } = await supabaseServer
    .from('rooms')
    .update({ status: 'finished', ends_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Failed to end room' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
