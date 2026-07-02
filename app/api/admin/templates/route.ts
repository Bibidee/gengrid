import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { deriveSlotsAndNumbering, validateGrid, normalizeBlackCells } from '@/lib/crossword-derive';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const boardSize = url.searchParams.get('board_size');
  const source = url.searchParams.get('source');

  let query = supabaseServer
    .from('templates')
    .select('id, name, board_size, rows, cols, source, created_at')
    .order('created_at', { ascending: false });

  if (boardSize) query = query.eq('board_size', Number(boardSize));
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });

  return NextResponse.json({ templates: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const board_size = Number(body?.board_size);
  const black_cells = normalizeBlackCells(body?.black_cells);

  if (!name || ![11, 13, 15].includes(board_size) || !black_cells) {
    return NextResponse.json(
      { error: 'name, board_size (11/13/15), and black_cells are required' },
      { status: 400 }
    );
  }

  // Never trust client-computed slots from the Grid Designer UI — always
  // re-validate and re-derive server-side before saving.
  let derived;
  try {
    const { valid, errors } = validateGrid(board_size, black_cells);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid grid layout', errors }, { status: 400 });
    }
    derived = deriveSlotsAndNumbering(board_size, black_cells);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('templates')
    .insert({
      name,
      board_size,
      rows: board_size,
      cols: board_size,
      // Store black_cells as [row, col] pairs — the format the play payload
      // and seed templates use — regardless of the shape the client sent.
      grid_layout: {
        black_cells: black_cells.map((c) => [c.row, c.col]),
        clue_numbers: derived.clue_numbers,
      },
      clue_slots: derived.slots,
      source: 'admin_designed',
      created_by: auth.adminId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
