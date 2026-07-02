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

  const { data: puzzle, error: puzzleError } = await supabaseServer
    .from('puzzles')
    .select('id, title, theme, board_size, rows, cols, template_id, difficulty, status')
    .eq('id', id)
    .maybeSingle();

  if (puzzleError || !puzzle) return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });

  const { data: clues, error: cluesError } = await supabaseServer
    .from('puzzle_clues')
    .select('id, clue_number, direction, row_start, col_start, answer_length, clue_text, correct_answer')
    .eq('puzzle_id', id)
    .order('clue_number', { ascending: true });

  if (cluesError) return NextResponse.json({ error: 'Failed to load clues' }, { status: 500 });

  return NextResponse.json({ ...puzzle, clues });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const metaUpdate: Record<string, unknown> = {};
  if (typeof body?.title === 'string') metaUpdate.title = body.title.trim();
  if (typeof body?.theme === 'string') metaUpdate.theme = body.theme.trim();
  if (typeof body?.difficulty === 'string') metaUpdate.difficulty = body.difficulty.trim();

  const clueUpdates: Array<{ id: string; clue_text?: string; correct_answer?: string }> =
    Array.isArray(body?.clues) ? body.clues : [];

  for (const c of clueUpdates) {
    if (!c.id) continue;
    const update: Record<string, string> = {};
    if (typeof c.clue_text === 'string') update.clue_text = c.clue_text.trim();
    if (typeof c.correct_answer === 'string') update.correct_answer = c.correct_answer.trim().toUpperCase();
    if (Object.keys(update).length === 0) continue;

    const { error } = await supabaseServer.from('puzzle_clues').update(update).eq('id', c.id).eq('puzzle_id', id);
    if (error) return NextResponse.json({ error: 'Failed to update a clue' }, { status: 500 });
  }

  const requestedStatus = typeof body?.status === 'string' ? body.status : null;
  if (requestedStatus === 'ready') {
    const { data: allClues, error: cluesError } = await supabaseServer
      .from('puzzle_clues')
      .select('clue_text, correct_answer')
      .eq('puzzle_id', id);

    if (cluesError) return NextResponse.json({ error: 'Failed to verify clues' }, { status: 500 });

    const incomplete = (allClues ?? []).some((c) => !c.clue_text?.trim() || !c.correct_answer?.trim());
    if (incomplete) {
      return NextResponse.json(
        { error: 'Every slot needs clue_text and correct_answer before marking ready' },
        { status: 400 }
      );
    }
    metaUpdate.status = 'ready';
  } else if (requestedStatus === 'draft' || requestedStatus === 'archived') {
    metaUpdate.status = requestedStatus;
  }

  if (Object.keys(metaUpdate).length > 0) {
    metaUpdate.updated_at = new Date().toISOString();
    const { error } = await supabaseServer.from('puzzles').update(metaUpdate).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to update puzzle' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
