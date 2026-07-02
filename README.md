# GenGrid

Live, room-based crossword competitions for the GenLayer community. Players
join with a username + room code, solve a themed crossword against a
server-authoritative countdown, and appear on a live leaderboard. Admins run
everything from a Supabase-authenticated dashboard, including a Grid
Designer for building brand-new grid shapes.

Stack: Next.js (App Router, TypeScript) on Vercel, Supabase (Postgres +
Auth) for storage, Upstash Redis as a burst-absorbing cache in front of the
hot polling routes. No websockets, no player accounts, no on-chain logic.

## Setup

1. Copy `.env.example` to `.env.local` and fill in four values:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your
     Supabase project's API settings. The anon key is used only by the
     admin login form.
   - `SUPABASE_SERVICE_ROLE_KEY` — from the same page. Server-only, never
     bundled to the client.
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — from an Upstash
     Redis database's REST API tab.
2. Run the SQL migration at `supabase/migrations/0001_init.sql` against
   your Supabase project (SQL Editor, or `supabase db push` with the CLI).
3. Create at least one admin: sign a user up in Supabase Auth, then insert
   a matching row into `admin_profiles` with that user's `id`.
4. Install dependencies and seed the template bank:
   ```bash
   npm install
   npm run seed
   ```
   This inserts 30 crossword templates (10 per board size: 11x11, 13x13,
   15x15) plus 3 fully-filled, ready-to-play demo puzzles — one per size,
   auto-filled by a backtracking crossword solver against a GenLayer/tech
   word bank (`scripts/wordbank.ts`).
5. Run the dev server:
   ```bash
   npm run dev
   ```

## Testing

```bash
npm run test    # unit tests for crossword-derive.ts and scoring.ts
npm run build   # production build + type check
```

## Load test

Simulates ~400 concurrent clients hitting `/api/rooms/join` then
`/api/rooms/[code]/status` in a tight window, to sanity-check the Redis
cache and Postgres connection pool under a burst. Requires a real,
joinable room code (create one from the admin dashboard first):

```bash
ROOM_CODE=AB3CDE npm run load-test
# against a deployed instance:
BASE_URL=https://your-app.vercel.app ROOM_CODE=AB3CDE CLIENTS=400 npm run load-test
```

## Keeping Supabase awake

Supabase's free tier pauses a project after 7 days of no activity. `GET
/api/health` does a trivial read against the `templates` table — point a
weekly GitHub Actions cron (or any external uptime pinger) at it:

```yaml
# .github/workflows/keepalive.yml
on:
  schedule:
    - cron: '0 12 * * 1' # every Monday
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -f https://your-app.vercel.app/api/health
```

## Grid Designer vs. the seed bank

`/admin/puzzles/new` lets you pick any template from one shared pool —
there's no separate "designed" silo. To add a brand-new grid shape instead
of using one of the 30 seeded layouts, go to `/admin/templates/new`: pick a
board size, click cells to toggle them black/white, and the derived clue
numbering + slot list update live (debounced ~200ms) via
`/api/admin/templates/preview`. The layout is re-validated and
re-derived **server-side** on save — the browser's computed slots are
never trusted directly.
