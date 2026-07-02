-- GenGrid initial schema
-- Default-deny RLS: all real access goes through Next.js API routes using the
-- Supabase service-role key (which bypasses RLS by design). RLS here is
-- defense-in-depth in case the anon key is ever accidentally used client-side.

create extension if not exists pgcrypto;

create table admin_profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board_size int not null check (board_size in (11, 13, 15)),
  rows int not null,
  cols int not null,
  grid_layout jsonb not null,   -- { black_cells: [[r,c],...], clue_numbers: {"r,c": n, ...} }
  clue_slots jsonb not null,    -- [{ clue_number, direction, row_start, col_start, answer_length }, ...]
  source text not null default 'seed' check (source in ('seed','admin_designed')),
  created_by uuid references admin_profiles(id),
  created_at timestamptz default now()
);

create table puzzles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  theme text,
  board_size int not null,
  rows int not null,
  cols int not null,
  template_id uuid references templates(id),
  difficulty text,
  status text not null default 'draft' check (status in ('draft','ready','archived')),
  created_by uuid references admin_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table puzzle_clues (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid references puzzles(id) on delete cascade,
  clue_number int not null,
  direction text not null check (direction in ('across','down')),
  row_start int not null,
  col_start int not null,
  answer_length int not null,
  clue_text text not null,
  correct_answer text not null,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  room_code text not null unique,
  puzzle_id uuid references puzzles(id),
  duration_seconds int not null,
  status text not null default 'waiting' check (status in ('waiting','scheduled','live','finished')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references admin_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table player_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  username text not null,
  session_token_hash text not null,
  joined_at timestamptz default now(),
  submitted_at timestamptz,
  score int,
  time_used_seconds int,
  rank int,
  status text not null default 'joined' check (status in ('joined','active','submitted')),
  unique (room_id, username)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references player_sessions(id) on delete cascade unique,
  submitted_answers jsonb not null,
  score int not null,
  correct_letters int not null,
  correct_words int not null,
  total_letters int not null,
  total_words int not null,
  submitted_at timestamptz default now(),
  time_used_seconds int not null
);

create index idx_player_sessions_room on player_sessions(room_id);
create index idx_submissions_room on submissions(room_id);
create index idx_rooms_code on rooms(room_code);
create index idx_templates_board_size on templates(board_size);

alter table admin_profiles enable row level security;
alter table templates enable row level security;
alter table puzzles enable row level security;
alter table puzzle_clues enable row level security;
alter table rooms enable row level security;
alter table player_sessions enable row level security;
alter table submissions enable row level security;
-- Default-deny: no policies granted to anon/authenticated roles.
-- All access happens through the service-role key in server routes, bypassing RLS by design.
-- RLS here is defense-in-depth in case the anon key is ever accidentally used client-side.
