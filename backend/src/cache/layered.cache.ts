import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MemoryCache, type CacheStore } from './memory.cache.js';

type DiskEnvelope = {
  expiresAt: number;
  value: unknown;
};

/**
 * Memory + disk cache. Survives API restarts so report hits stay off the DB
 * until rules change (delByPrefix) or TTL expires.
 */
export class LayeredCache implements CacheStore {
  private readonly memory = new MemoryCache();
  private readonly dir: string;
  private ready: Promise<void>;

  constructor(dir = path.join(process.cwd(), '.report-cache')) {
    this.dir = dir;
    this.ready = fs.mkdir(this.dir, { recursive: true }).then(() => undefined);
  }

  private fileFor(key: string) {
    const hash = createHash('sha256').update(key).digest('hex');
    return path.join(this.dir, `${hash}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const mem = await this.memory.get<T>(key);
    if (mem !== null) return mem;

    await this.ready;
    try {
      const raw = await fs.readFile(this.fileFor(key), 'utf8');
      const parsed = JSON.parse(raw) as DiskEnvelope;
      if (Date.now() > parsed.expiresAt) {
        await fs.unlink(this.fileFor(key)).catch(() => undefined);
        return null;
      }
      await this.memory.set(key, parsed.value as T, Math.max(1, Math.floor((parsed.expiresAt - Date.now()) / 1000)));
      return parsed.value as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    await this.memory.set(key, value, ttlSeconds);
    await this.ready;
    const envelope: DiskEnvelope = {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    };
    await fs.writeFile(this.fileFor(key), JSON.stringify(envelope), 'utf8');
  }

  async del(key: string): Promise<void> {
    await this.memory.del(key);
    await this.ready;
    await fs.unlink(this.fileFor(key)).catch(() => undefined);
  }

  async delByPrefix(prefix: string): Promise<void> {
    await this.memory.delByPrefix(prefix);
    await this.ready;
    // Disk keys are hashed — wipe the whole report cache dir for report: prefix.
    if (prefix.startsWith('report:')) {
      const files = await fs.readdir(this.dir).catch(() => [] as string[]);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.unlink(path.join(this.dir, f)).catch(() => undefined)),
      );
      return;
    }
  }

  async clear(): Promise<void> {
    await this.memory.clear();
    await this.ready;
    const files = await fs.readdir(this.dir).catch(() => [] as string[]);
    await Promise.all(files.map((f) => fs.unlink(path.join(this.dir, f)).catch(() => undefined)));
  }
}
