import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { deriveSlotsAndNumbering, validateGrid, type Cell } from '../lib/crossword-derive';

// Seeds the "GenLayer Community 22Q" 15x15 puzzle: places the community
// questions' answers scrabble-style (only word cells are white, everything
// else black), so the derived slots correspond 1:1 to the answers.
// If all 22 can't fit, falls back tier by tier to smaller word sets.
// Run: npx tsx scripts/seed-genlayer-22q.ts [--dry-run]

const SIZE = 15;

type Q = { clue: string; answer: string };

const QUESTIONS: Q[] = [
  { clue: 'Host of the Persian regional quiz.', answer: 'MAHDI' },
  { clue: "GenLayer's quest hub for earning community points.", answer: 'PORTAL' },
  { clue: 'The trust layer built for agent-to-agent commerce. (two words)', answer: 'INTERNETCOURT' },
  { clue: "GenLayer's hosted environment for testing and deploying contracts.", answer: 'STUDIO' },
  { clue: "Bolucrypt's daily AI discussion series.", answer: 'GENTOPIC' },
  { clue: "GenLayer's official mascot.", answer: 'MOCHI' },
  { clue: 'The community game that tests your AI knowledge. (two words)', answer: 'BRAINGAME' },
  { clue: 'Independent participants who evaluate contract outcomes.', answer: 'VALIDATORS' },
  { clue: 'The standard used for agent-to-agent negotiation.', answer: 'A2A' },
  { clue: 'Founder behind "How to Stop AI Labs From Deciding for You."', answer: 'ALBERT' },
  { clue: 'The AI-native blockchain behind Intelligent Contracts.', answer: 'GENLAYER' },
  { clue: 'The community member known as "Muncle Uscles" on Discord.', answer: 'EDGARS' },
  { clue: 'The familiar voice behind most GenLayer AMAs.', answer: 'HILLS' },
  { clue: 'The community member behind "Riddle Me This."', answer: 'MORIARTY' },
  { clue: 'Creator of the latest Argue.fun debate.', answer: 'GLATCHER' },
  { clue: 'Number of founding members backing Internet Court.', answer: '28' },
  { clue: "GenLayer's first flagship protocol.", answer: 'RALLY' },
  { clue: 'The Portal role directly above Synapse.', answer: 'BRAIN' },
  { clue: 'The community member famously linked to a Bentley.', answer: 'VATAN' },
  { clue: 'The missing layer Internet Court brings to agent commerce.', answer: 'ADJUDICATION' },
  { clue: 'The agreement validators reach on an outcome.', answer: 'CONSENSUS' },
  { clue: 'Onchain programs that can reason over subjective information.', answer: 'CONTRACTS' },
];

// Fallback tiers: answers to drop, in order, if the full set won't fit.
// Longest words free the most space; tried cumulatively (tier 2 drops both
// tier 1 words plus its own, etc.).
const DROP_TIERS: string[][] = [
  [], // all 22
  ['INTERNETCOURT', 'ADJUDICATION'], // 20 words
  ['INTERNETCOURT', 'ADJUDICATION', 'VALIDATORS'], // 19
  ['INTERNETCOURT', 'ADJUDICATION', 'VALIDATORS', 'CONSENSUS'], // 18
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

function tryLayout(questions: Q[], seed: number): Placement[] | null {
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
        if (at(r - dc, c - dr) != null || at(r + dc, c + dr) != null) return -1;
      }
    }
    // Full overlap (every cell already filled) — same slot twice. Reject.
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

  function unplace(newlySet: Cell[]) {
    for (const { row: r, col: c } of newlySet) grid[r][c] = null;
    placements.pop();
  }

  // Longest first, shuffled among similar lengths.
  const order = [...questions]
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
    // book puzzle) — only tried after every crossing spot fails.
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
      unplace(newlySet);
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

function searchTier(questions: Q[], maxSeeds: number) {
  for (let seed = 1; seed <= maxSeeds; seed++) {
    if (seed % 200 === 0) console.log(`  …seed ${seed}, best depth ${bestDepth}/${questions.length}`);
    const placements = tryLayout(questions, seed);
    if (!placements || placements.length !== questions.length) continue;

    const black = blackCellsFor(placements);
    const { valid } = validateGrid(SIZE, black);
    if (!valid) continue;

    const { slots } = deriveSlotsAndNumbering(SIZE, black);
    if (slots.length !== placements.length) continue;
    const key = (r: number, c: number, d: Dir) => `${r},${c},${d}`;
    const byPos = new Map(placements.map((p) => [key(p.row, p.col, p.dir), p]));
    const allMatch = slots.every((s) => {
      const p = byPos.get(key(s.row_start, s.col_start, s.direction));
      return p && p.q.answer.length === s.answer_length;
    });
    if (!allMatch) continue;

    return { placements, black, seed };
  }
  return null;
}

async function main() {
  let found: { placements: Placement[]; black: Cell[]; seed: number } | null = null;
  let usedQuestions: Q[] = QUESTIONS;

  for (const drops of DROP_TIERS) {
    const qs = QUESTIONS.filter((q) => !drops.includes(q.answer));
    const letters = qs.reduce((n, q) => n + q.answer.length, 0);
    console.log(`Trying ${qs.length} words (${letters} letters${drops.length ? `, dropped: ${drops.join(', ')}` : ''})…`);
    bestDepth = 0;
    found = searchTier(qs, 600);
    if (found) {
      usedQuestions = qs;
      break;
    }
    console.log(`  no fit at ${qs.length} words (best depth ${bestDepth}).`);
  }

  if (!found) throw new Error('No valid layout found even at the smallest tier.');

  console.log(`\nLayout found (seed ${found.seed}) with ${usedQuestions.length} words, black ratio ${((found.black.length / (SIZE * SIZE)) * 100).toFixed(0)}%:\n`);
  printGrid(found.placements);

  if (process.argv.includes('--dry-run')) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { clue_numbers, slots } = deriveSlotsAndNumbering(SIZE, found.black);
  const n = usedQuestions.length;

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .insert({
      name: `GenLayer Community 15x15 — ${n} Questions`,
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
      title: `GenLayer Community ${n}Q`,
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

  console.log(`\nSeeded puzzle "${puzzle.id}" (GenLayer Community ${n}Q) with ${clueRows.length} clues, status=ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
