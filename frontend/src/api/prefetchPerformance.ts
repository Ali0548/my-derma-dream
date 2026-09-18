import { reportsApi, type CompactReport } from './reports';
import {
  cacheMatchesYear,
  peekYearReportCache,
  readYearReportCache,
  writeYearReportCache,
} from './reportCache';
import type { QueryClient } from '@tanstack/react-query';

export function performanceBaseQueryKey(dateFrom: string, dateTo: string) {
  return ['performance-base', dateFrom, dateTo] as const;
}

/**
 * Load the full-year compact pack once. Prefer memory → IndexedDB → network.
 */
export async function loadYearPerformanceBase(
  dateFrom: string,
  dateTo: string,
): Promise<CompactReport> {
  const mem = peekYearReportCache();
  if (cacheMatchesYear(mem, dateFrom, dateTo)) return mem;

  const idb = await readYearReportCache();
  if (cacheMatchesYear(idb, dateFrom, dateTo)) return idb;

  const res = await reportsApi.performanceBase({ dateFrom, dateTo });
  const payload = res.data;
  await writeYearReportCache(payload);
  return payload;
}

/** Warm React Query + IndexedDB as soon as the admin shell mounts. */
export async function prefetchYearPerformance(queryClient: QueryClient) {
  const filters = await queryClient.ensureQueryData({
    queryKey: ['report-filters'],
    queryFn: async () => (await reportsApi.filters()).data,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!filters.dateMin || !filters.dateMax) return;

  await queryClient.ensureQueryData({
    queryKey: performanceBaseQueryKey(filters.dateMin, filters.dateMax),
    queryFn: () => loadYearPerformanceBase(filters.dateMin!, filters.dateMax!),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
