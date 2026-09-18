import type { NextFunction, Request, Response } from 'express';
import { cache } from '../cache/index.js';
import { env } from '../config/env.js';

/**
 * Cache GET responses by full URL. Call invalidate from write paths.
 */
export function cacheResponse(keyBuilder: (req: Request) => string, ttlSeconds = env.CACHE_TTL_SECONDS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyBuilder(req);
    const hit = await cache.get<unknown>(key);

    if (hit !== null) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      res.setHeader('X-Cache', 'MISS');
      void cache.set(key, body, ttlSeconds);
      return originalJson(body);
    }) as Response['json'];

    return next();
  };
}
