import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { deriveSlotsAndNumbering, validateGrid, type Cell } from '../lib/crossword-derive';
import { generateOpenNotchGrid, generateDenseGrid } from './grid-generators';
import { fillCrossword } from './crossword-fill';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type NotchPlan = { size: number; k: number; seed: number; label: string };

// 9 "open grid + notches" templates per size, tuned to land inside the
// target clue-count range from the build spec (11x11: 18-28, 13x13: 28-40,
// 15x15: 35-55). Slot count = 2*size + 2*k.
const NOTCH_PLANS: NotchPlan[] = [
  // 11x11 -> counts 22,24,24,24,26,26,28,28 (8) + one more at 26 = 9
  { size: 11, k: 0, seed: 100, label: 'Fully Open' },
  { size: 11, k: 1, seed: 101, label: 'Light Notches A' },
  { size: 11, k: 1, seed: 102, label: 'Light Notches B' },
  { size: 11, k: 1, seed: 103, label: 'Light Notches C' },
  { size: 11, k: 2, seed: 104, label: 'Balanced A' },
  { size: 11, k: 2, seed: 105, label: 'Balanced B' },
  { size: 11, k: 2, seed: 106, label: 'Balanced C' },
  { size: 11, k: 3, seed: 107, label: 'Structured A' },
  { size: 11, k: 3, seed: 108, label: 'Structured B' },

  // 13x13 -> k=1..7 each once, plus alt seeds for k=3 and k=5
  { size: 13, k: 1, seed: 200, label: 'Light Notches' },
  { size: 13, k: 2, seed: 201, label: 'Gentle Scatter' },
  { size: 13, k: 3, seed: 202, label: 'Balanced A' },
  { size: 13, k: 3, seed: 203, label: 'Balanced B' },
  { size: 13, k: 4, seed: 204, label: 'Even Spread' },
  { size: 13, k: 5, seed: 205, label: 'Structured A' },
  { size: 13, k: 5, seed: 206, label: 'Structured B' },
  { size: 13, k: 6, seed: 207, label: 'Dense Scatter' },
  { size: 13, k: 7, seed: 208, label: 'Full Structure' },

  // 15x15 -> k=3..11 each once
  { size: 15, k: 3, seed: 300, label: 'Light Notches' },
  { size: 15, k: 4, seed: 301, label: 'Gentle Scatter' },
  { size: 15, k: 5, seed: 302, label: 'Even Spread A' },
  { size: 15, k: 6, seed: 303, label: 'Even Spread B' },
  { size: 15, k: 7, seed: 304, label: 'Balanced A' },
  { size: 15, k: 8, seed: 305, label: 'Balanced B' },
  { size: 15, k: 9, seed: 306, label: 'Structured A' },
  { size: 15, k: 10, seed: 307, label: 'Structured B' },
  { size: 15, k: 11, seed: 308, label: 'Full Structure' },
];

// Dense, real-crossword-style grid used for the one filled demo puzzle per
// size. Found via search in scripts/_tmp_check.ts — lands inside the target
// clue-count range for every size with this exact parameter set.
const DENSE_PARAMS = { modA: 1, modB: 2, modM: 7, bias: 2 };

async function insertTemplate(
  name: string,
  size: number,
  blackCells: Cell[],
  source: 'seed' = 'seed'
) {
  const { valid, errors } = validateGrid(size, blackCells);
  if (!valid) {
    throw new Error(`Template "${name}" failed validation: ${errors.join('; ')}`);
  }
  const { clue_numbers, slots } = deriveSlotsAndNumbering(size, blackCells);

  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      board_size: size,
      rows: size,
      cols: size,
      grid_layout: { black_cells: blackCells.map((c) => [c.row, c.col]), clue_numbers },
      clue_slots: slots,
      source,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Insert template "${name}" failed: ${error.message}`);
  return { id: data.id as string, slots };
}

async function main() {
  console.log('Seeding GenGrid template bank + demo puzzles...');

  let templateCount = 0;
  for (const plan of NOTCH_PLANS) {
    const cells = generateOpenNotchGrid(plan.size, plan.k, plan.seed);
    const name = `Standard ${plan.size}x${plan.size} — ${plan.label}`;
    await insertTemplate(name, plan.size, cells);
    templateCount++;
    console.log(`  + ${name}`);
  }

  for (const size of [11, 13, 15] as const) {
    const cells = generateDenseGrid(size, DENSE_PARAMS.modA, DENSE_PARAMS.modB, DENSE_PARAMS.modM, DENSE_PARAMS.bias);
    const name = `Standard ${size}x${size} — Dense (Demo Puzzle)`;
    const { id: templateId } = await insertTemplate(name, size, cells);
    templateCount++;
    console.log(`  + ${name}`);

    const filled = fillCrossword(size, cells);
    if (!filled) {
      throw new Error(`Could not auto-fill demo puzzle grid for size ${size}`);
    }

    const { data: puzzle, error: puzzleError } = await supabase
      .from('puzzles')
      .insert({
        title: `GenLayer Grid — ${size}x${size} Launch Puzzle`,
        theme: 'GenLayer & Tech Ecosystem',
        board_size: size,
        rows: size,
        cols: size,
        template_id: templateId,
        difficulty: size === 11 ? 'easy' : size === 13 ? 'medium' : 'hard',
        status: 'ready',
      })
      .select('id')
      .single();

    if (puzzleError) throw new Error(`Insert puzzle failed: ${puzzleError.message}`);

    const clueRows = filled.map((f) => ({
      puzzle_id: puzzle.id,
      clue_number: f.clue_number,
      direction: f.direction,
      row_start: f.row_start,
      col_start: f.col_start,
      answer_length: f.answer_length,
      clue_text: f.clue,
      correct_answer: f.word,
    }));

    const { error: cluesError } = await supabase.from('puzzle_clues').insert(clueRows);
    if (cluesError) throw new Error(`Insert puzzle_clues failed: ${cluesError.message}`);

    console.log(`    -> playable puzzle "${puzzle.id}" with ${clueRows.length} clues (status=ready)`);
  }

  console.log(`\nDone. Inserted ${templateCount} templates and 3 ready puzzles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
