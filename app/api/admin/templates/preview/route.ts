import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deriveSlotsAndNumbering, validateGrid, normalizeBlackCells } from '@/lib/crossword-derive';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const board_size = Number(body?.board_size);
  const black_cells = normalizeBlackCells(body?.black_cells);

  if (![11, 13, 15].includes(board_size) || !black_cells) {
    return NextResponse.json({ error: 'board_size (11/13/15) and black_cells are required' }, { status: 400 });
  }

  try {
    const { valid, errors } = validateGrid(board_size, black_cells);
    if (!valid) {
      return NextResponse.json({ valid: false, errors, clue_numbers: {}, slots: [] });
    }
    const { clue_numbers, slots } = deriveSlotsAndNumbering(board_size, black_cells);
    return NextResponse.json({ valid: true, errors, clue_numbers, slots });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
