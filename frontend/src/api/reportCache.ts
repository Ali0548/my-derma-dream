import type { CompactReport } from './reports';

const DB_NAME = 'lumora-report-cache';
const STORE = 'reports';
const KEY = 'year-base-v4';

/** Survives route changes; lost on full reload (IndexedDB covers that). */
let memoryYear: CompactReport | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function peekYearReportCache(): CompactReport | null {
  return memoryYear;
}

export async function readYearReportCache(): Promise<CompactReport | null> {
  if (memoryYear) return memoryYear;
  try {
    const db = await openDb();
    const cached = await new Promise<CompactReport | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as CompactReport | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (cached) memoryYear = cached;
    return cached;
  } catch {
    return null;
  }
}

export async function writeYearReportCache(data: CompactReport): Promise<void> {
  memoryYear = data;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* quota / private mode — memory still holds it for this session */
  }
}

export async function clearYearReportCache(): Promise<void> {
  memoryYear = null;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export function cacheMatchesYear(
  data: CompactReport | null | undefined,
  dateFrom: string,
  dateTo: string,
): data is CompactReport {
  if (!data?.range) return false;
  return data.range.dateFrom === dateFrom && data.range.dateTo === dateTo;
}
