import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache-aside helper: read `key` from Redis first. On a miss, call
 * `fetcher()`, write the result with `ttlSeconds`, and return it. This is
 * the burst absorber for hot polling routes (room status, leaderboard) so
 * that N simultaneous requests within the TTL window cost one Postgres read.
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();
  await redis.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}

export { redis };
