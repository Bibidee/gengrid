import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { deriveSlotsAndNumbering, validateGrid, type Cell } from '../lib/crossword-derive';

// Seeds the "GenLayer Community 16Q" 15x15 puzzle: places the 16 community
// questions' answers scrabble-style (only word cells are white, everything
// else black), so the derived slots correspond 1:1 to the 16 answers.
// Run: npx tsx scripts/seed-genlayer-16q.ts

const SIZE = 15;

type Q = { clue: string; answer: string };

const QUESTIONS: Q[] = [
  { clue: 'The first flagship protocol built on GenLayer.', answer: 'RALLY' },
  { clue: 'GenLayer is building the Adjudication Layer for the ______ Economy.', answer: 'AGENTIC' },
  { clue: 'The free NFT collection launching on July 7.', answer: 'WINGSTON' },
  { clue: "GenLayer's CEO and Co-founder. (First name only)", answer: 'DAVID' },
  { clue: 'The co-founder who wrote "How to Stop AI Labs From Deciding for You." (First name only)', answer: 'ALBERT' },
  { clue: 'The GenLayer Portal role that unlocks after meeting higher community requirements.', answer: 'BRAIN' },
  { clue: 'GenLayer recently celebrated 1 million on-chain ________.', answer: 'DECISIONS' },
  { clue: 'The daily AI discussion hosted by Bolucrypt in the main chat.', answer: 'GENTOPIC' },
  { clue: 'This open-source project from GenLayer Labs decides which LLM should run each step.', answer: 'UNHARDCODED' },
  { clue: 'The Portal role that comes before Brain.', answer: 'SYNAPSE' },
  { clue: 'The consensus mechanism GenLayer uses to reach subjective decisions is called Optimistic ________.', answer: 'DEMOCRACY' },
  { clue: 'The free Rally NFT will mint on which blockchain?', answer: 'ETHEREUM' },
  { clue: 'The new Rally feature that groups projects, campaigns, and creators together.', answer: 'COMMUNITIES' },
  { clue: "GenLayer's intelligent contracts run on the ______ VM.", answer: 'GENVM' },
  { clue: 'Prediction market used by GenLayer to benchmark the Intelligent Oracle.', answer: 'POLYMARKET' },
  { clue: "GenLayer's mascot, featured in community events.", answer: 'MOCHI' },
];

type Dir = 'across' | 'down';
type Placement = { q: Q; row: number; col: number; dir: Dir };

// Mulberry32 PRNG for reproducible retries.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let bestDepth = 0;

function tryLayout(seed: number): Placement[] | null {
  const rand = rng(seed);
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const placements: Placement[] = [];

  const at = (r: number, c: number) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE ? grid[r][c] : undefined;

  // Scrabble placement rules: crossings must match; the cells before/after
  // the word are empty; non-crossing cells have no perpendicular neighbors
  // (which would create unintended runs the deriver would pick up).
  function canPlace(word: string, row: number, col: number, dir: Dir): number {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const endR = row + dr * (word.length - 1);
    const endC = col + dc * (word.length - 1);
    if (row < 0 || col < 0 || endR >= SIZE || endC >= SIZE) return -1;
    if (at(row - dr, col - dc) != null || at(endR + dr, endC + dc) != null) return -1;

    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = at(r, c);
      if (cell != null) {
        if (cell !== word[i]) return -1;
        crossings++;
      } else {
        // perpendicular neighbors must be empty for fresh cells
        if (at(r - dc, c - dr) != null || (at(r + dc, c + dr) != null)) return -1;
      }
    }
    // Full overlap (every cell already filled) means the word lies exactly on
    // top of its duplicate — same slot twice. Reject it.
    if (crossings === word.length) return -1;
    return crossings;
  }

  function place(q: Q, row: number, col: number, dir: Dir) {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < q.answer.length; i++) {
      grid[row + dr * i][col + dc * i] = q.answer[i];
    }
    placements.push({ q, row, col, dir });
  }

  function unplace(q: Q, row: number, col: number, dir: Dir, newlySet: Cell[]) {
    for (const { row: r, col: c } of newlySet) grid[r][c] = null;
    placements.pop();
  }

  // Longest first, shuffled among equal lengths.
  const order = [...QUESTIONS]
    .map((q) => ({ q, k: q.answer.length + rand() * 3 }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.q);

  // First word horizontally near the middle.
  const first = order[0];
  place(first, Math.floor(SIZE / 2), Math.floor((SIZE - first.answer.length) / 2), 'across');

  let calls = 0;
  const MAX_CALLS = 30_000;

  function backtrack(idx: number): boolean {
    if (idx > bestDepth) bestDepth = idx;
    if (idx >= order.length) return true;
    if (++calls > MAX_CALLS) return false;
    const q = order[idx];

    // Candidate spots that cross an existing letter; more crossings first
    // (denser interlock leaves more room for later words), random tiebreak.
    const spots: { row: number; col: number; dir: Dir; score: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = grid[r][c];
        if (cell == null) continue;
        for (let i = 0; i < q.answer.length; i++) {
          if (q.answer[i] !== cell) continue;
          for (const dir of ['across', 'down'] as Dir[]) {
            const row = dir === 'down' ? r - i : r;
            const col = dir === 'across' ? c - i : c;
            const crossings = canPlace(q.answer, row, col, dir);
            if (crossings > 0) spots.push({ row, col, dir, score: crossings + rand() });
          }
        }
      }
    }
    spots.sort((a, b) => b.score - a.score);

    // Fallback: standalone placements (word islands, like a criss-cross
    // book puzzle) — only tried after every crossing spot fails, so the
    // solver still prefers an interlocked grid.
    const standalone: { row: number; col: number; dir: Dir; score: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        for (const dir of ['across', 'down'] as Dir[]) {
          if (canPlace(q.answer, r, c, dir) === 0) standalone.push({ row: r, col: c, dir, score: rand() });
        }
      }
    }
    standalone.sort((a, b) => b.score - a.score);
    spots.push(...standalone.slice(0, 12));

    for (const spot of spots) {
      const dr = spot.dir === 'down' ? 1 : 0;
      const dc = spot.dir === 'across' ? 1 : 0;
      const newlySet: Cell[] = [];
      for (let i = 0; i < q.answer.length; i++) {
        const r = spot.row + dr * i;
        const c = spot.col + dc * i;
        if (grid[r][c] == null) newlySet.push({ row: r, col: c });
      }
      place(q, spot.row, spot.col, spot.dir);
      if (backtrack(idx + 1)) return true;
      unplace(q, spot.row, spot.col, spot.dir, newlySet);
      if (calls > MAX_CALLS) return false;
    }
    return false;
  }

  return backtrack(1) ? placements : null;
}

function blackCellsFor(placements: Placement[]): Cell[] {
  const white = new Set<string>();
  for (const p of placements) {
    const dr = p.dir === 'down' ? 1 : 0;
    const dc = p.dir === 'across' ? 1 : 0;
    for (let i = 0; i < p.q.answer.length; i++) {
      white.add(`${p.row + dr * i},${p.col + dc * i}`);
    }
  }
  const black: Cell[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!white.has(`${r},${c}`)) black.push({ row: r, col: c });
    }
  }
  return black;
}

function printGrid(placements: Placement[]) {
  const grid: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill('■'));
  for (const p of placements) {
    const dr = p.dir === 'down' ? 1 : 0;
    const dc = p.dir === 'across' ? 1 : 0;
    for (let i = 0; i < p.q.answer.length; i++) {
      grid[p.row + dr * i][p.col + dc * i] = p.q.answer[i];
    }
  }
  console.log(grid.map((row) => row.join(' ')).join('\n'));
}

async function main() {
  // Search seeds until a layout places all 20 words and passes validation
  // with every derived slot matching one placement exactly.
  let found: { placements: Placement[]; black: Cell[]; seed: number } | null = null;

  for (let seed = 1; seed <= 800 && !found; seed++) {
    if (seed % 100 === 0) console.log(`  …seed ${seed}, best depth ${bestDepth}/${QUESTIONS.length}`);
    const placements = tryLayout(seed);
    if (!placements || placements.length !== QUESTIONS.length) continue;

    const black = blackCellsFor(placements);
    const { valid, errors } = validateGrid(SIZE, black);
    if (!valid) {
      if (seed <= 3) console.log(`  seed ${seed}: invalid grid: ${errors.join('; ')}`);
      continue;
    }

    const { slots } = deriveSlotsAndNumbering(SIZE, black);
    if (slots.length !== placements.length) {
      if (seed <= 3) console.log(`  seed ${seed}: ${slots.length} slots vs ${placements.length} placements`);
      continue;
    }
    const key = (r: number, c: number, d: Dir) => `${r},${c},${d}`;
    const byPos = new Map(placements.map((p) => [key(p.row, p.col, p.dir), p]));
    const allMatch = slots.every((s) => {
      const p = byPos.get(key(s.row_start, s.col_start, s.direction));
      return p && p.q.answer.length === s.answer_length;
    });
    if (!allMatch) continue;

    found = { placements, black, seed };
  }

  if (!found) throw new Error(`No valid layout found — best depth ${bestDepth}/${QUESTIONS.length} words placed.`);

  console.log(`Layout found (seed ${found.seed}), black ratio ${(found.black.length / (SIZE * SIZE) * 100).toFixed(0)}%:\n`);
  printGrid(found.placements);

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { clue_numbers, slots } = deriveSlotsAndNumbering(SIZE, found.black);

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .insert({
      name: 'GenLayer Community 15x15 — 16 Questions',
      board_size: SIZE,
      rows: SIZE,
      cols: SIZE,
      grid_layout: { black_cells: found.black.map((c) => [c.row, c.col]), clue_numbers },
      clue_slots: slots,
      source: 'seed',
    })
    .select('id')
    .single();
  if (templateError) throw new Error(`Insert template failed: ${templateError.message}`);

  const { data: puzzle, error: puzzleError } = await supabase
    .from('puzzles')
    .insert({
      title: 'GenLayer Community 16Q',
      theme: 'GenLayer Community',
      board_size: SIZE,
      rows: SIZE,
      cols: SIZE,
      template_id: template.id,
      difficulty: 'medium',
      status: 'ready',
    })
    .select('id')
    .single();
  if (puzzleError) throw new Error(`Insert puzzle failed: ${puzzleError.message}`);

  const key = (r: number, c: number, d: Dir) => `${r},${c},${d}`;
  const byPos = new Map(found.placements.map((p) => [key(p.row, p.col, p.dir), p]));
  const clueRows = slots.map((s) => {
    const p = byPos.get(key(s.row_start, s.col_start, s.direction))!;
    return {
      puzzle_id: puzzle.id,
      clue_number: s.clue_number,
      direction: s.direction,
      row_start: s.row_start,
      col_start: s.col_start,
      answer_length: s.answer_length,
      clue_text: p.q.clue,
      correct_answer: p.q.answer,
    };
  });

  const { error: cluesError } = await supabase.from('puzzle_clues').insert(clueRows);
  if (cluesError) throw new Error(`Insert puzzle_clues failed: ${cluesError.message}`);

  console.log(`\nSeeded puzzle "${puzzle.id}" (GenLayer Community 16Q) with ${clueRows.length} clues, status=ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
