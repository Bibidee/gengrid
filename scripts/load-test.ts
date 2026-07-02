import 'dotenv/config';

// Simulates ~400 concurrent clients hitting POST /api/rooms/join followed
// by GET /api/rooms/[code]/status in a tight window, to sanity-check that
// the Redis-cached status route and Postgres connection pool hold up under
// a burst (see Phase 11 of the build spec).
//
// Usage:
//   ROOM_CODE=AB3CDE npm run load-test
//   BASE_URL=https://gengrid.vercel.app ROOM_CODE=AB3CDE CLIENTS=400 npm run load-test

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOM_CODE = process.env.ROOM_CODE;
const CLIENT_COUNT = Number(process.env.CLIENTS ?? 400);

if (!ROOM_CODE) {
  console.error('Set ROOM_CODE to a real, joinable room code before running the load test.');
  console.error('Example: ROOM_CODE=AB3CDE npm run load-test');
  process.exit(1);
}

type Outcome = { ok: boolean; status: number; ms: number };

async function timed(fn: () => Promise<Response>): Promise<Outcome> {
  const start = Date.now();
  try {
    const res = await fn();
    return { ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start };
  }
}

function summarize(label: string, outcomes: Outcome[]) {
  const ok = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - ok;
  const times = outcomes.map((o) => o.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const statusCounts = outcomes.reduce<Record<number, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n${label}`);
  console.log(`  ok=${ok} failed=${failed} p50=${p50}ms p95=${p95}ms`);
  console.log(`  status codes: ${JSON.stringify(statusCounts)}`);
}

async function main() {
  console.log(`Load test: ${CLIENT_COUNT} concurrent clients against ${BASE_URL}, room ${ROOM_CODE}`);

  // Keep usernames within the join route's 20-character limit.
  const runId = Date.now().toString(36).slice(-5);
  const joinOutcomes = await Promise.all(
    Array.from({ length: CLIENT_COUNT }, (_, i) =>
      timed(() =>
        fetch(`${BASE_URL}/api/rooms/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_code: ROOM_CODE, username: `lt_${runId}_${i}` }),
        })
      )
    )
  );
  summarize('POST /api/rooms/join', joinOutcomes);

  const statusOutcomes = await Promise.all(
    Array.from({ length: CLIENT_COUNT }, () => timed(() => fetch(`${BASE_URL}/api/rooms/${ROOM_CODE}/status`)))
  );
  summarize('GET /api/rooms/[code]/status', statusOutcomes);

  console.log('\nDone. All /status requests within the same ~few-second window should show a single');
  console.log('Postgres read behind the Redis cache — check your Supabase project\'s query logs to confirm.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
