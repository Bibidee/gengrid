import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hashSessionToken } from '@/lib/session-token';
import { computeRoomStatus } from '@/lib/room-status';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: puzzleId } = await params;
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('session_token');

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 401 });
  }

  const tokenHash = hashSessionToken(sessionToken);

  const { data: player, error: playerError } = await supabaseServer
    .from('player_sessions')
    .select('id, room_id, rooms!inner(id, status, starts_at, ends_at, puzzle_id)')
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const room = Array.isArray(player.rooms) ? player.rooms[0] : player.rooms;
  if (!room || room.puzzle_id !== puzzleId) {
    return NextResponse.json({ error: 'Session does not match this puzzle' }, { status: 403 });
  }

  const effectiveStatus = computeRoomStatus(room);
  if (effectiveStatus === 'waiting') {
    return NextResponse.json({ error: 'Room has not started yet' }, { status: 409 });
  }

  const { data: puzzle, error: puzzleError } = await supabaseServer
    .from('puzzles')
    .select('id, title, theme, board_size, rows, cols, template_id')
    .eq('id', puzzleId)
    .maybeSingle();

  if (puzzleError || !puzzle) {
    return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
  }

  const { data: template, error: templateError } = await supabaseServer
    .from('templates')
    .select('grid_layout')
    .eq('id', puzzle.template_id)
    .maybeSingle();

  if (templateError || !template) {
    return NextResponse.json({ error: 'Puzzle template not found' }, { status: 404 });
  }

  // Explicit column list — never select correct_answer here.
  const { data: clues, error: cluesError } = await supabaseServer
    .from('puzzle_clues')
    .select('clue_number, direction, row_start, col_start, answer_length, clue_text')
    .eq('puzzle_id', puzzleId)
    .order('clue_number', { ascending: true });

  if (cluesError) {
    return NextResponse.json({ error: 'Failed to load clues' }, { status: 500 });
  }

  return NextResponse.json({
    id: puzzle.id,
    title: puzzle.title,
    theme: puzzle.theme,
    board_size: puzzle.board_size,
    rows: puzzle.rows,
    cols: puzzle.cols,
    black_cells: template.grid_layout.black_cells,
    clue_numbers: template.grid_layout.clue_numbers,
    clues,
    starts_at: room.starts_at,
    ends_at: room.ends_at,
  });
}
