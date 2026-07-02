import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const { error } = await supabaseServer.from('templates').select('id').limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
