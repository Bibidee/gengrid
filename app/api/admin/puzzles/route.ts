import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let query = supabaseServer
    .from('puzzles')
    .select('id, title, theme, board_size, difficulty, status, created_at')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to load puzzles' }, { status: 500 });

  return NextResponse.json({ puzzles: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const template_id = typeof body?.template_id === 'string' ? body.template_id : '';
  const theme = typeof body?.theme === 'string' ? body.theme.trim() : null;
  const difficulty = typeof body?.difficulty === 'string' ? body.difficulty.trim() : null;

  if (!title || !template_id) {
    return NextResponse.json({ error: 'title and template_id are required' }, { status: 400 });
  }

  const { data: template, error: templateError } = await supabaseServer
    .from('templates')
    .select('id, board_size, rows, cols, clue_slots')
    .eq('id', template_id)
    .maybeSingle();

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const { data: puzzle, error: puzzleError } = await supabaseServer
    .from('puzzles')
    .insert({
      title,
      theme,
      board_size: template.board_size,
      rows: template.rows,
      cols: template.cols,
      template_id: template.id,
      difficulty,
      status: 'draft',
      created_by: auth.adminId,
    })
    .select('id')
    .single();

  if (puzzleError) return NextResponse.json({ error: 'Failed to create puzzle' }, { status: 500 });

  // Pre-populate one empty clue row per slot from the template so the
  // puzzle-edit form has something to fill in.
  type ClueSlot = {
    clue_number: number;
    direction: 'across' | 'down';
    row_start: number;
    col_start: number;
    answer_length: number;
  };
  const slots = template.clue_slots as ClueSlot[];
  const clueRows = slots.map((s) => ({
    puzzle_id: puzzle.id,
    clue_number: s.clue_number,
    direction: s.direction,
    row_start: s.row_start,
    col_start: s.col_start,
    answer_length: s.answer_length,
    clue_text: '',
    correct_answer: '',
  }));

  const { error: cluesError } = await supabaseServer.from('puzzle_clues').insert(clueRows);
  if (cluesError) return NextResponse.json({ error: 'Failed to create clue slots' }, { status: 500 });

  return NextResponse.json({ id: puzzle.id }, { status: 201 });
}
