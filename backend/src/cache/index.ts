import { env } from '../config/env.js';
import { LayeredCache } from './layered.cache.js';
import type { CacheStore } from './memory.cache.js';

/** Memory + disk. Report responses survive restarts until rules change. */
export const cache: CacheStore = new LayeredCache();

/** Reports stay warm for a week unless a rule/recalc invalidates them. */
export const REPORT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export const CacheKeys = {
  usersList: 'users:list',
  user: (id: string) => `users:${id}`,
} as const;

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = env.CACHE_TTL_SECONDS,
): Promise<{ data: T; fromCache: boolean }> {
  const hit = await cache.get<T>(key);
  if (hit !== null) {
    return { data: hit, fromCache: true };
  }

  const data = await loader();
  await cache.set(key, data, ttlSeconds);
  return { data, fromCache: false };
}

export { type CacheStore } from './memory.cache.js';
