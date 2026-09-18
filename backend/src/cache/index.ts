import { env } from '../config/env.js';
import { MemoryCache, type CacheStore } from './memory.cache.js';

export const cache: CacheStore = new MemoryCache();

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

export { type CacheStore };
