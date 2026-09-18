import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import {
  clearYearReportCache,
  peekYearReportCache,
  readYearReportCache,
} from '../api/reportCache';
import {
  loadYearPerformanceBase,
  performanceBaseQueryKey,
} from '../api/prefetchPerformance';
import { auditApi, type PartnerRuleRow, type RuleEvaluation } from '../api/audit';
import {
  deriveReportView,
  reportsApi,
  type CompactReport,
  type MetricBlock,
  type RoasMode,
} from '../api/reports';
import { ruleEvaluationColumns, ruleEvaluationFilters } from '../components/audit/ruleEvaluationColumns';
import { Button } from '../components/ui/Button';
import { ComponentLoader } from '../components/ui/ComponentLoader';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { Spinner } from '../components/ui/Spinner';

const METRICS: { key: keyof MetricBlock; label: string; hint: string }[] = [
  { key: 'revenue', label: 'Revenue', hint: 'Value of orders in this view' },
  { key: 'spend', label: 'Spend', hint: 'Commission paid to partners' },
  { key: 'roas', label: 'ROAS', hint: 'Revenue ÷ Spend' },
  { key: 'sales', label: 'Sales', hint: 'Number of orders' },
  { key: 'aov', label: 'AOV', hint: 'Revenue ÷ Sales' },
];

const DAY_COL_PX = 84;
const DAY_BUFFER = 8;

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function ratio(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function count(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

function formatMetric(key: keyof MetricBlock, block: MetricBlock | undefined) {
  if (!block) return key === 'sales' ? '0' : '—';
  if (key === 'sales') return count(block.sales);
  if (key === 'roas') return ratio(block.roas);
  if (key === 'aov') return money(block.aov);
  return money(block[key]);
}

function shortDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function emptyMetrics(): MetricBlock {
  return { revenue: 0, spend: 0, roas: null, sales: 0, aov: null };
}

export default function PerformancePage() {
  const queryClient = useQueryClient();

  const filtersQuery = useQuery({
    queryKey: ['report-filters'],
    queryFn: async () => (await reportsApi.filters()).data,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [affiliate, setAffiliate] = useState<SelectOption | null>(null);
  const [subAffiliate, setSubAffiliate] = useState<SelectOption | null>(null);
  const [product, setProduct] = useState<SelectOption | null>(null);
  const [pricePoint, setPricePoint] = useState<SelectOption | null>(null);
  const [roasMode, setRoasMode] = useState<RoasMode>('frontend');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [datesReady, setDatesReady] = useState(false);
  const [whyAffiliate, setWhyAffiliate] = useState<string | null>(null);
  const [whyRuleId, setWhyRuleId] = useState<string | null>(null);
  const [whyOrderId, setWhyOrderId] = useState<string | null>(null);
  const [idbSeed, setIdbSeed] = useState<CompactReport | null>(() => peekYearReportCache());

  useEffect(() => {
    if (idbSeed) return;
    let cancelled = false;
    void readYearReportCache().then((cached) => {
      if (cancelled || !cached) return;
      setIdbSeed(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [idbSeed]);

  useEffect(() => {
    if (!filtersQuery.data || datesReady) return;
    if (filtersQuery.data.dateMin && filtersQuery.data.dateMax) {
      setDateFrom(filtersQuery.data.dateMin);
      setDateTo(filtersQuery.data.dateMax);
      setDatesReady(true);
    }
  }, [filtersQuery.data, datesReady]);

  const yearFrom = filtersQuery.data?.dateMin ?? '';
  const yearTo = filtersQuery.data?.dateMax ?? '';
  const needsServerFilter = Boolean(product || pricePoint);

  const baseQuery = useQuery({
    queryKey: needsServerFilter
      ? (['performance-base', yearFrom, yearTo, product?.value, pricePoint?.value] as const)
      : performanceBaseQueryKey(yearFrom, yearTo),
    queryFn: async () => {
      if (needsServerFilter) {
        const res = await reportsApi.performanceBase({
          dateFrom: yearFrom,
          dateTo: yearTo,
          ...(product ? { product: product.value } : {}),
          ...(pricePoint ? { pricePoint: pricePoint.value } : {}),
        });
        return res.data;
      }
      return loadYearPerformanceBase(yearFrom, yearTo);
    },
    enabled: Boolean(yearFrom && yearTo),
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: !needsServerFilter ? (idbSeed ?? undefined) : undefined,
    initialData: !needsServerFilter && peekYearReportCache() ? peekYearReportCache()! : undefined,
    initialDataUpdatedAt:
      !needsServerFilter && peekYearReportCache() ? Date.now() : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Keep toggles snappy — heavy derive/paint runs as a deferred update
  const deferredDateFrom = useDeferredValue(dateFrom);
  const deferredDateTo = useDeferredValue(dateTo);
  const deferredAffiliate = useDeferredValue(affiliate?.value);
  const deferredSub = useDeferredValue(subAffiliate?.value);
  const deferredRoas = useDeferredValue(roasMode);
  const viewPending =
    deferredDateFrom !== dateFrom ||
    deferredDateTo !== dateTo ||
    deferredAffiliate !== affiliate?.value ||
    deferredSub !== subAffiliate?.value ||
    deferredRoas !== roasMode;

  const view = useMemo(() => {
    if (!baseQuery.data || !deferredDateFrom || !deferredDateTo) return null;
    return deriveReportView(baseQuery.data, {
      dateFrom: deferredDateFrom,
      dateTo: deferredDateTo,
      affiliate: deferredAffiliate,
      subAffiliate: deferredSub,
      roasMode: deferredRoas,
    });
  }, [
    baseQuery.data,
    deferredDateFrom,
    deferredDateTo,
    deferredAffiliate,
    deferredSub,
    deferredRoas,
  ]);

  const days = view?.days ?? [];
  const dayLabels = useMemo(() => days.map(shortDay), [days]);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [dayWindow, setDayWindow] = useState({ start: 0, end: 40 });

  const updateDayWindow = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el || days.length === 0) {
      setDayWindow({ start: 0, end: 0 });
      return;
    }
    const sticky = 18.5 * 16; // partner + metric + total sticky cluster
    const scrollLeft = el.scrollLeft;
    const width = el.clientWidth;
    const start = Math.max(0, Math.floor(scrollLeft / DAY_COL_PX) - DAY_BUFFER);
    const visible = Math.ceil(Math.max(width - sticky, DAY_COL_PX) / DAY_COL_PX) + DAY_BUFFER * 2;
    const end = Math.min(days.length, start + visible);
    setDayWindow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [days.length]);

  useEffect(() => {
    updateDayWindow();
  }, [updateDayWindow, days.length, viewPending]);

  const leftPad = dayWindow.start * DAY_COL_PX;
  const rightPad = Math.max(0, (days.length - dayWindow.end) * DAY_COL_PX);
  const visibleDayIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = dayWindow.start; i < dayWindow.end; i += 1) out.push(i);
    return out;
  }, [dayWindow.start, dayWindow.end]);

  const partnerRulesQuery = useQuery({
    queryKey: ['partner-rules', whyAffiliate, dateFrom, dateTo],
    queryFn: async () =>
      (
        await auditApi.partnerRules(whyAffiliate!, {
          dateFrom,
          dateTo,
        })
      ).data,
    enabled: Boolean(whyAffiliate && dateFrom && dateTo && whyAffiliate !== '(direct)'),
  });

  const winningRulesQuery = useQuery({
    queryKey: ['winning-rules', deferredDateFrom, deferredDateTo],
    queryFn: async () =>
      (await auditApi.winningRulesSummary({ dateFrom: deferredDateFrom, dateTo: deferredDateTo })).data,
    enabled: Boolean(deferredDateFrom && deferredDateTo && baseQuery.data),
    staleTime: 5 * 60_000,
  });

  const winningByAffiliate = useMemo(() => {
    const map = new Map<
      string,
      { primaryRuleId: string; distinctRuleCount: number; primaryOrderCount: number }
    >();
    for (const row of winningRulesQuery.data?.affiliates ?? []) {
      map.set(row.code, {
        primaryRuleId: row.primaryRuleId,
        distinctRuleCount: row.distinctRuleCount,
        primaryOrderCount: row.primaryOrderCount,
      });
    }
    return map;
  }, [winningRulesQuery.data]);

  const winningBySub = useMemo(() => {
    const map = new Map<
      string,
      { primaryRuleId: string; distinctRuleCount: number }
    >();
    for (const row of winningRulesQuery.data?.subs ?? []) {
      map.set(`${row.affiliateCode}::${row.subAffiliateCode}`, {
        primaryRuleId: row.primaryRuleId,
        distinctRuleCount: row.distinctRuleCount,
      });
    }
    return map;
  }, [winningRulesQuery.data]);

  // Auto-open the primary (most-used) rule’s audit when the eye opens
  useEffect(() => {
    if (!partnerRulesQuery.data?.rules.length) return;
    if (whyOrderId) return;
    const primary = partnerRulesQuery.data.rules[0];
    if (primary?.sampleOrderId) {
      setWhyRuleId(primary.ruleId);
      setWhyOrderId(primary.sampleOrderId);
    }
  }, [partnerRulesQuery.data, whyOrderId]);

  const whyAuditQuery = useQuery({
    queryKey: ['audit', whyOrderId],
    queryFn: async () => (await auditApi.byOrderId(whyOrderId!)).data,
    enabled: Boolean(whyOrderId),
  });

  const whyEvaluations = useMemo(() => {
    const rows = [...(whyAuditQuery.data?.resolution.evaluations ?? [])];
    return rows.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (a.matched !== b.matched) return a.matched ? -1 : 1;
      return b.specificityScore - a.specificityScore;
    });
  }, [whyAuditQuery.data]);

  const evaluationColumns = useMemo(() => ruleEvaluationColumns(), []);

  const primaryWinningRule = useMemo(() => {
    return partnerRulesQuery.data?.rules?.[0] ?? null;
  }, [partnerRulesQuery.data]);

  const selectedRule = useMemo(() => {
    const rules = partnerRulesQuery.data?.rules ?? [];
    if (!rules.length) return null;
    if (whyRuleId) return rules.find((r) => r.ruleId === whyRuleId) ?? rules[0];
    return rules[0];
  }, [partnerRulesQuery.data, whyRuleId]);

  const explainingOtherRule = Boolean(
    selectedRule?.ruleId &&
      primaryWinningRule?.ruleId &&
      selectedRule.ruleId !== primaryWinningRule.ruleId,
  );

  const partnerRuleColumns = useMemo<ColumnDef<PartnerRuleRow, unknown>[]>(
    () => [
      {
        id: 'ruleId',
        accessorFn: (r) => r.ruleId || '—',
        header: 'Rule',
        cell: ({ row }) => {
          const isWinner = row.original.ruleId === primaryWinningRule?.ruleId;
          const isViewing = row.original.ruleId === whyRuleId;
          return (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span
                className={
                  isWinner
                    ? 'font-extrabold text-success'
                    : isViewing
                      ? 'font-extrabold text-ink underline decoration-brand/40'
                      : 'font-extrabold text-ink'
                }
              >
                {row.original.ruleId || 'No rule'}
              </span>
              {isWinner ? (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-extrabold text-success">
                  Winner
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'scope',
        accessorFn: (r) =>
          [
            r.product || 'any product',
            r.pricePoint ? `$${r.pricePoint}` : 'any price',
            r.affiliate || 'any affiliate',
            r.subAffiliate || 'any sub',
          ].join(' · '),
        header: 'Scope',
        cell: ({ getValue }) => (
          <span className="text-xs text-ink-soft">{String(getValue())}</span>
        ),
      },
      {
        id: 'cpa',
        accessorFn: (r) =>
          r.cpaType == null
            ? '—'
            : r.cpaType === 'percent'
              ? `${r.cpaValue}%`
              : Number(r.cpaValue).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'USD',
                }),
        header: 'CPA',
      },
      {
        id: 'orderCount',
        accessorKey: 'orderCount',
        header: 'Orders',
        cell: ({ getValue }) => Number(getValue()).toLocaleString(),
      },
      {
        id: 'totalPaid',
        accessorKey: 'totalPaid',
        header: 'Total paid',
        cell: ({ getValue }) =>
          Number(getValue()).toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
      },
      {
        id: 'why',
        header: 'Why',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.ruleId === whyRuleId ? 'primary' : 'secondary'}
            leftIcon={<Eye size={14} />}
            disabled={!row.original.sampleOrderId}
            onClick={() => {
              setWhyRuleId(row.original.ruleId);
              setWhyOrderId(row.original.sampleOrderId);
            }}
          >
            Explain
          </Button>
        ),
      },
    ],
    [whyRuleId, primaryWinningRule?.ruleId],
  );

  const affiliateOptions = useMemo<SelectOption[]>(
    () => (filtersQuery.data?.affiliates ?? []).map((code) => ({ label: code, value: code })),
    [filtersQuery.data],
  );

  const subOptions = useMemo<SelectOption[]>(() => {
    const rows = filtersQuery.data?.subAffiliates ?? [];
    return rows
      .filter((row) => !affiliate || row.affiliateCode === affiliate.value)
      .map((row) => ({ label: `${row.code} · ${row.affiliateCode}`, value: row.code }));
  }, [filtersQuery.data, affiliate]);

  const productOptions = useMemo<SelectOption[]>(
    () => (filtersQuery.data?.products ?? []).map((name) => ({ label: name, value: name })),
    [filtersQuery.data],
  );

  const priceOptions = useMemo<SelectOption[]>(() => {
    const rows = filtersQuery.data?.pricePoints ?? [];
    return rows
      .filter((row) => !product || row.productName === product.value)
      .map((row) => ({
        label: `$${row.pricePoint} · ${row.productName}`,
        value: row.pricePoint,
      }));
  }, [filtersQuery.data, product]);

  const totals = view?.totals ?? emptyMetrics();
  const bootLoading =
    filtersQuery.isLoading || !datesReady || (baseQuery.isLoading && !baseQuery.data && !idbSeed);

  const clearFilters = () => {
    startTransition(() => {
      setAffiliate(null);
      setSubAffiliate(null);
      setProduct(null);
      setPricePoint(null);
      setRoasMode('frontend');
      setExpanded({});
      if (filtersQuery.data?.dateMin && filtersQuery.data?.dateMax) {
        setDateFrom(filtersQuery.data.dateMin);
        setDateTo(filtersQuery.data.dateMax);
      }
    });
  };

  if (bootLoading) {
    return <ComponentLoader label="Loading performance report" rows={5} />;
  }

  if (filtersQuery.isError || baseQuery.isError) {
    return (
      <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
        Could not load the performance report.
        <Button
          className="ml-3"
          size="sm"
          variant="secondary"
          onClick={() => {
            void clearYearReportCache();
            void queryClient.invalidateQueries({ queryKey: ['performance-base'] });
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white/90 p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-deep">
              Partner performance
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
              Compare revenue, spend, and ROAS by day
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Full year is cached once (memory + browser). ROAS, dates, and partner filters
              update from that cache — no reload.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-line bg-foam p-1">
              <button
                type="button"
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
                  roasMode === 'frontend'
                    ? 'bg-brand text-white shadow-soft'
                    : 'text-ink-soft hover:text-ink'
                }`}
                onClick={() => startTransition(() => setRoasMode('frontend'))}
              >
                Front-end ROAS
              </button>
              <button
                type="button"
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
                  roasMode === 'total'
                    ? 'bg-brand text-white shadow-soft'
                    : 'text-ink-soft hover:text-ink'
                }`}
                onClick={() => startTransition(() => setRoasMode('total'))}
              >
                Total ROAS
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={clearFilters} leftIcon={<RefreshCw size={14} />}>
              Reset
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <label className="grid min-w-0 content-start gap-1.5">
            <span className="text-sm font-bold text-ink">From</span>
            <input
              type="date"
              value={dateFrom}
              min={yearFrom || undefined}
              max={dateTo || yearTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="box-border h-11 w-full appearance-none rounded-xl border border-line bg-white px-3.5 text-sm font-semibold leading-none text-ink shadow-soft transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
            />
            <span className="min-h-4 text-xs invisible">.</span>
          </label>
          <label className="grid min-w-0 content-start gap-1.5">
            <span className="text-sm font-bold text-ink">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || yearFrom || undefined}
              max={yearTo || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="box-border h-11 w-full appearance-none rounded-xl border border-line bg-white px-3.5 text-sm font-semibold leading-none text-ink shadow-soft transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
            />
            <span className="min-h-4 text-xs invisible">.</span>
          </label>
          <SearchableSelect
            className="min-w-0"
            label="Affiliate"
            isClearable
            placeholder="All affiliates"
            options={affiliateOptions}
            value={affiliate}
            onChange={(v) => {
              startTransition(() => {
                setAffiliate(v as SelectOption | null);
                setSubAffiliate(null);
              });
            }}
          />
          <SearchableSelect
            className="min-w-0"
            label="Sub-affiliate"
            isClearable
            placeholder="All subs"
            options={subOptions}
            value={subAffiliate}
            onChange={(v) => startTransition(() => setSubAffiliate(v as SelectOption | null))}
          />
          <SearchableSelect
            className="min-w-0"
            label="Product"
            isClearable
            placeholder="All products"
            options={productOptions}
            value={product}
            onChange={(v) => {
              setProduct(v as SelectOption | null);
              setPricePoint(null);
            }}
          />
          <SearchableSelect
            className="min-w-0"
            label="Price point"
            isClearable
            placeholder="All prices"
            options={priceOptions}
            value={pricePoint}
            onChange={(v) => setPricePoint(v as SelectOption | null)}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-line bg-white/95 px-4 py-3.5 shadow-soft"
          >
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-soft">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
              {formatMetric(metric.key, totals)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h3 className="font-extrabold text-ink">Daily partner table</h3>
            <p className="text-xs text-ink-soft">
              Eye icon explains which CPA rules paid each partner’s orders
            </p>
          </div>
          <div className="text-xs font-semibold text-ink-soft">
            {baseQuery.isFetching && !baseQuery.data ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size={14} /> Loading year cache…
              </span>
            ) : (
              <span>
                {viewPending ? 'Updating… · ' : ''}
                {peekYearReportCache() || baseQuery.data?.meta?.fromCache ? 'Cached' : 'Live'} ·
                instant filters · {view?.rows.length ?? 0} affiliates · {days.length} days
              </span>
            )}
          </div>
        </div>

        <div
          ref={tableScrollRef}
          onScroll={updateDayWindow}
          className={`max-h-[min(70vh,820px)] overflow-auto transition-opacity ${
            viewPending ? 'opacity-70' : 'opacity-100'
          }`}
        >
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-foam/95 backdrop-blur">
                <th className="sticky left-0 z-30 min-w-[12rem] border-b border-r border-line bg-foam px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                  Partner
                </th>
                <th className="sticky left-[12rem] z-30 min-w-[6.5rem] border-b border-r border-line bg-foam px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                  Metric
                </th>
                <th className="sticky left-[18.5rem] z-30 min-w-[7rem] border-b border-r border-line bg-foam px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                  Total
                </th>
                {leftPad > 0 ? <th style={{ width: leftPad, minWidth: leftPad }} className="border-b border-line p-0" /> : null}
                {visibleDayIndexes.map((i) => (
                  <th
                    key={days[i]}
                    className="border-b border-line px-2 py-2.5 text-right text-[0.68rem] font-bold text-ink-soft"
                    style={{ width: DAY_COL_PX, minWidth: DAY_COL_PX }}
                    title={days[i]}
                  >
                    {dayLabels[i]}
                  </th>
                ))}
                {rightPad > 0 ? <th style={{ width: rightPad, minWidth: rightPad }} className="border-b border-line p-0" /> : null}
              </tr>
            </thead>
            <tbody>
              {(view?.rows ?? []).map((row) => (
                <AffiliateBlock
                  key={row.affiliateCode}
                  affiliateCode={row.affiliateCode}
                  totals={row.totals}
                  byDay={row.byDay}
                  childrenRows={row.children}
                  days={days}
                  visibleDayIndexes={visibleDayIndexes}
                  leftPad={leftPad}
                  rightPad={rightPad}
                  open={Boolean(expanded[row.affiliateCode])}
                  winningRule={winningByAffiliate.get(row.affiliateCode) ?? null}
                  winningBySub={winningBySub}
                  onToggle={(code) =>
                    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }))
                  }
                  onWhy={(code) => {
                    setWhyAffiliate(code);
                    setWhyRuleId(null);
                    setWhyOrderId(null);
                  }}
                />
              ))}
              {(view?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center font-semibold text-ink-soft"
                  >
                    No orders match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(whyAffiliate)}
        onClose={() => {
          setWhyAffiliate(null);
          setWhyRuleId(null);
          setWhyOrderId(null);
        }}
        size="xl"
        title={whyAffiliate ? `Why ${whyAffiliate} was paid this way` : 'Partner audit'}
        description="CPA rules that paid this partner in the selected dates — and why each one won."
      >
        <div className="space-y-4">
          {partnerRulesQuery.isLoading ? (
            <ComponentLoader label="Loading partner rules" rows={4} />
          ) : partnerRulesQuery.isError ? (
            <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
              Could not load rules for this partner.
            </div>
          ) : (partnerRulesQuery.data?.rules.length ?? 0) === 0 ? (
            <div className="rounded-xl bg-foam px-4 py-6 text-center font-semibold text-ink-soft">
              No paid orders for this partner in the selected date range.
            </div>
          ) : (
            <>
              {primaryWinningRule ? (
                <div className="rounded-2xl border border-success/25 bg-success/5 px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-success">
                    {primaryWinningRule.ruleId
                      ? `Winning rule ${primaryWinningRule.ruleId}`
                      : 'No matching rule'}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
                    {primaryWinningRule.winReason ?? 'Loading explanation…'}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {primaryWinningRule.orderCount.toLocaleString()} order
                    {primaryWinningRule.orderCount === 1 ? '' : 's'} · paid{' '}
                    {primaryWinningRule.totalPaid.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                    })}
                    {primaryWinningRule.cpaType
                      ? ` · CPA ${
                          primaryWinningRule.cpaType === 'percent'
                            ? `${primaryWinningRule.cpaValue}%`
                            : Number(primaryWinningRule.cpaValue).toLocaleString(undefined, {
                                style: 'currency',
                                currency: 'USD',
                              })
                        }`
                      : ''}
                  </p>
                </div>
              ) : null}

              {explainingOtherRule && selectedRule ? (
                <div className="rounded-2xl border border-line bg-foam/60 px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-deep">
                    Explaining {selectedRule.ruleId}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
                    {selectedRule.winReason ??
                      whyAuditQuery.data?.resolution.winReason ??
                      'Loading explanation…'}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {selectedRule.orderCount.toLocaleString()} order
                    {selectedRule.orderCount === 1 ? '' : 's'} · paid{' '}
                    {selectedRule.totalPaid.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </p>
                </div>
              ) : null}

              {(partnerRulesQuery.data?.rules.length ?? 0) > 1 ? (
                <DataTable
                  title={`Rules used by ${whyAffiliate}`}
                  data={partnerRulesQuery.data?.rules ?? []}
                  columns={partnerRuleColumns}
                  exportFileName={`${whyAffiliate}-rules`}
                  searchPlaceholder="Search rule id, scope…"
                />
              ) : null}

              <div className="space-y-3 border-t border-line pt-4">
                <div>
                  <h4 className="font-extrabold text-ink">
                    Rule check
                    {selectedRule?.ruleId ? ` — ${selectedRule.ruleId}` : ''}
                  </h4>
                  <p className="text-sm text-ink-soft">
                    {whyAuditQuery.data?.resolution.winReason ??
                      'Every candidate rule for a sample order under this contract.'}
                  </p>
                </div>
                {whyAuditQuery.isLoading || !whyOrderId ? (
                  <ComponentLoader label="Loading rule outcomes" rows={4} />
                ) : whyAuditQuery.isError ? (
                  <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
                    Could not load the rule explanation.
                  </div>
                ) : (
                  <DataTable
                    title="Every rule checked"
                    data={whyEvaluations}
                    columns={evaluationColumns as ColumnDef<RuleEvaluation, unknown>[]}
                    exportFileName={`${selectedRule?.ruleId ?? whyOrderId}-rule-outcomes`}
                    searchPlaceholder="Search by rule id, why text, scope…"
                    filters={ruleEvaluationFilters}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

type ChildRow = {
  subAffiliateCode: string;
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
};

const AffiliateBlock = memo(function AffiliateBlock({
  affiliateCode,
  totals,
  byDay,
  childrenRows,
  days,
  visibleDayIndexes,
  leftPad,
  rightPad,
  open,
  winningRule,
  winningBySub,
  onToggle,
  onWhy,
}: {
  affiliateCode: string;
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
  childrenRows: ChildRow[];
  days: string[];
  visibleDayIndexes: number[];
  leftPad: number;
  rightPad: number;
  open: boolean;
  winningRule: {
    primaryRuleId: string;
    distinctRuleCount: number;
    primaryOrderCount: number;
  } | null;
  winningBySub: Map<string, { primaryRuleId: string; distinctRuleCount: number }>;
  onToggle: (code: string) => void;
  onWhy: (code: string) => void;
}) {
  const extraRules =
    winningRule && winningRule.distinctRuleCount > 1
      ? winningRule.distinctRuleCount - 1
      : 0;

  return (
    <>
      {METRICS.map((metric, idx) => (
        <tr key={`${affiliateCode}-${metric.key}`} className="group hover:bg-mist/60">
          {idx === 0 ? (
            <td
              rowSpan={5}
              className="sticky left-0 z-10 border-b border-r border-line bg-white px-2 py-2 align-top group-hover:bg-mist/60"
            >
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => onToggle(affiliateCode)}
                  className="flex min-w-0 flex-1 items-start gap-1.5 rounded-xl px-1.5 py-1 text-left hover:bg-foam"
                >
                  <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-brand-deep">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-extrabold text-ink">{affiliateCode}</span>
                    <span className="mt-0.5 block text-[0.7rem] font-semibold text-ink-soft">
                      {childrenRows.length} sub-affiliate{childrenRows.length === 1 ? '' : 's'}
                    </span>
                    {winningRule ? (
                      <span
                        className="mt-1 block text-[0.7rem] font-bold leading-snug text-brand-deep"
                        title={
                          extraRules > 0
                            ? `Most orders used ${winningRule.primaryRuleId}. This partner was also paid by ${extraRules} other CPA rule${extraRules === 1 ? '' : 's'} in the selected dates (different products / prices / subs).`
                            : `Winning rule ${winningRule.primaryRuleId}`
                        }
                      >
                        Won by {winningRule.primaryRuleId}
                        {extraRules > 0 ? ` · +${extraRules} other rules` : ''}
                      </span>
                    ) : null}
                  </span>
                </button>
                {affiliateCode !== '(direct)' ? (
                  <button
                    type="button"
                    title="See which CPA rule paid this partner and why"
                    onClick={() => onWhy(affiliateCode)}
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-brand-deep shadow-soft hover:bg-foam"
                  >
                    <Eye size={15} />
                  </button>
                ) : null}
              </div>
            </td>
          ) : null}
          <MetricCells
            metricKey={metric.key}
            label={metric.label}
            totals={totals}
            byDay={byDay}
            days={days}
            visibleDayIndexes={visibleDayIndexes}
            leftPad={leftPad}
            rightPad={rightPad}
            emphasize
          />
        </tr>
      ))}

      {open
        ? childrenRows.map((child, childIndex) => {
            const isLast = childIndex === childrenRows.length - 1;
            const subWin = winningBySub.get(`${affiliateCode}::${child.subAffiliateCode}`);
            const subExtra =
              subWin && subWin.distinctRuleCount > 1 ? subWin.distinctRuleCount - 1 : 0;
            return METRICS.map((metric, idx) => (
              <tr
                key={`${affiliateCode}-${child.subAffiliateCode}-${metric.key}`}
                className="bg-[#f3faf7] hover:bg-[#eaf6f1]"
              >
                {idx === 0 ? (
                  <td
                    rowSpan={5}
                    className="sticky left-0 z-10 border-b border-r border-line bg-[#f3faf7] px-2 py-2 align-top"
                  >
                    <div className="relative ml-3 flex items-start gap-2 border-l-2 border-brand/35 pl-3">
                      <span
                        className={`absolute -left-[2px] top-0 w-3 border-b-2 border-brand/35 ${
                          isLast ? 'h-3' : 'h-full'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[0.65rem] font-extrabold uppercase tracking-wide text-brand-deep">
                          Sub
                        </p>
                        <p className="truncate font-extrabold text-ink">{child.subAffiliateCode}</p>
                        {subWin ? (
                          <p className="mt-0.5 text-[0.65rem] font-bold text-brand-deep">
                            Won by {subWin.primaryRuleId}
                            {subExtra > 0 ? ` · +${subExtra} other rules` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                ) : null}
                <MetricCells
                  metricKey={metric.key}
                  label={metric.label}
                  totals={child.totals}
                  byDay={child.byDay}
                  days={days}
                  visibleDayIndexes={visibleDayIndexes}
                  leftPad={leftPad}
                  rightPad={rightPad}
                />
              </tr>
            ));
          })
        : null}
    </>
  );
});

const MetricCells = memo(function MetricCells({
  metricKey,
  label,
  totals,
  byDay,
  days,
  visibleDayIndexes,
  leftPad,
  rightPad,
  emphasize,
}: {
  metricKey: keyof MetricBlock;
  label: string;
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
  days: string[];
  visibleDayIndexes: number[];
  leftPad: number;
  rightPad: number;
  emphasize?: boolean;
}) {
  return (
    <>
      <td
        className={`sticky left-[12rem] z-10 border-b border-r border-line px-3 py-1.5 font-bold ${
          emphasize ? 'bg-white text-ink' : 'bg-[#f3faf7] text-ink-soft'
        }`}
      >
        {label}
      </td>
      <td
        className={`sticky left-[18.5rem] z-10 border-b border-r border-line px-3 py-1.5 text-right font-extrabold tabular-nums ${
          emphasize ? 'bg-white text-ink' : 'bg-[#f3faf7] text-ink'
        }`}
      >
        {formatMetric(metricKey, totals)}
      </td>
      {leftPad > 0 ? <td style={{ width: leftPad, minWidth: leftPad }} className="border-b border-line p-0" /> : null}
      {visibleDayIndexes.map((i) => (
        <td
          key={days[i]}
          className="border-b border-line px-2 py-1.5 text-right tabular-nums text-ink-soft"
          style={{ width: DAY_COL_PX, minWidth: DAY_COL_PX }}
        >
          {formatMetric(metricKey, byDay[days[i]])}
        </td>
      ))}
      {rightPad > 0 ? <td style={{ width: rightPad, minWidth: rightPad }} className="border-b border-line p-0" /> : null}
    </>
  );
});
