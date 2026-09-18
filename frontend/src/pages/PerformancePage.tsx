import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { reportsApi, type MetricBlock, type RoasMode } from '../api/reports';
import { Button } from '../components/ui/Button';
import { ComponentLoader } from '../components/ui/ComponentLoader';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { Spinner } from '../components/ui/Spinner';

const METRICS: { key: keyof MetricBlock; label: string; hint: string }[] = [
  { key: 'revenue', label: 'Revenue', hint: 'Value of orders in this view' },
  { key: 'spend', label: 'Spend', hint: 'Commission paid to partners' },
  { key: 'roas', label: 'ROAS', hint: 'Revenue ÷ Spend' },
  { key: 'sales', label: 'Sales', hint: 'Number of orders' },
  { key: 'aov', label: 'AOV', hint: 'Revenue ÷ Sales' },
];

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
  if (!block) {
    if (key === 'sales') return '0';
    return '—';
  }
  if (key === 'sales') return count(block.sales);
  if (key === 'roas') return ratio(block.roas);
  if (key === 'aov') return money(block.aov);
  return money(block[key]);
}

function shortDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function emptyMetrics(): MetricBlock {
  return { revenue: 0, spend: 0, roas: null, sales: 0, aov: null };
}

export default function PerformancePage() {
  const filtersQuery = useQuery({
    queryKey: ['report-filters'],
    queryFn: async () => {
      const res = await reportsApi.filters();
      return res.data;
    },
    staleTime: 5 * 60_000,
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

  useEffect(() => {
    if (!filtersQuery.data || datesReady) return;
    if (filtersQuery.data.dateMin && filtersQuery.data.dateMax) {
      setDateFrom(filtersQuery.data.dateMin);
      setDateTo(filtersQuery.data.dateMax);
      setDatesReady(true);
    }
  }, [filtersQuery.data, datesReady]);

  const queryParams = useMemo(
    () => ({
      dateFrom,
      dateTo,
      affiliate: affiliate?.value,
      subAffiliate: subAffiliate?.value,
      product: product?.value,
      pricePoint: pricePoint?.value,
      roasMode,
    }),
    [dateFrom, dateTo, affiliate, subAffiliate, product, pricePoint, roasMode],
  );

  const reportQuery = useQuery({
    queryKey: ['performance-report', queryParams],
    queryFn: async () => {
      const res = await reportsApi.performance(queryParams);
      return res.data;
    },
    enabled: Boolean(dateFrom && dateTo),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const affiliateOptions = useMemo<SelectOption[]>(
    () => (filtersQuery.data?.affiliates ?? []).map((code) => ({ label: code, value: code })),
    [filtersQuery.data],
  );

  const subOptions = useMemo<SelectOption[]>(() => {
    const rows = filtersQuery.data?.subAffiliates ?? [];
    return rows
      .filter((row) => !affiliate || row.affiliateCode === affiliate.value)
      .map((row) => ({
        label: `${row.code} · ${row.affiliateCode}`,
        value: row.code,
      }));
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

  const totals = reportQuery.data?.totals ?? emptyMetrics();
  const days = reportQuery.data?.days ?? [];

  const clearFilters = () => {
    setAffiliate(null);
    setSubAffiliate(null);
    setProduct(null);
    setPricePoint(null);
    setRoasMode('frontend');
    if (filtersQuery.data?.dateMin && filtersQuery.data?.dateMax) {
      setDateFrom(filtersQuery.data.dateMin);
      setDateTo(filtersQuery.data.dateMax);
    }
  };

  if (filtersQuery.isLoading || !datesReady) {
    return <ComponentLoader label="Loading performance filters" rows={4} />;
  }

  if (filtersQuery.isError) {
    return (
      <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
        Could not load report filters. Please refresh.
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
              Expand any affiliate to see its sub-affiliates. Toggle Front-end ROAS (product only) or
              Total ROAS (product + upsells).
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
                onClick={() => setRoasMode('frontend')}
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
                onClick={() => setRoasMode('total')}
              >
                Total ROAS
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={clearFilters} leftIcon={<RefreshCw size={14} />}>
              Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-ink">From</span>
            <input
              type="date"
              value={dateFrom}
              min={filtersQuery.data?.dateMin ?? undefined}
              max={dateTo || filtersQuery.data?.dateMax || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-soft"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-ink">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || filtersQuery.data?.dateMin || undefined}
              max={filtersQuery.data?.dateMax ?? undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink shadow-soft"
            />
          </label>
          <SearchableSelect
            label="Affiliate"
            isClearable
            placeholder="All affiliates"
            options={affiliateOptions}
            value={affiliate}
            onChange={(v) => {
              setAffiliate(v as SelectOption | null);
              setSubAffiliate(null);
            }}
          />
          <SearchableSelect
            label="Sub-affiliate"
            isClearable
            placeholder="All subs"
            options={subOptions}
            value={subAffiliate}
            onChange={(v) => setSubAffiliate(v as SelectOption | null)}
          />
          <SearchableSelect
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
              Days across columns · five metrics per partner · click a row to expand sub-affiliates
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            {reportQuery.isFetching ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size={14} /> Updating…
              </span>
            ) : reportQuery.data?.meta ? (
              <span>
                {reportQuery.data.meta.fromCache ? 'Cached' : 'Live'} · {reportQuery.data.meta.tookMs}ms
                · {reportQuery.data.rows.length} affiliates
              </span>
            ) : null}
          </div>
        </div>

        {reportQuery.isLoading ? (
          <div className="p-4">
            <ComponentLoader label="Building performance report" rows={6} />
          </div>
        ) : reportQuery.isError ? (
          <div className="m-4 rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
            Could not load the performance report.
          </div>
        ) : (
          <div className="max-h-[min(70vh,820px)] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="bg-foam/95 backdrop-blur">
                  <th className="sticky left-0 z-30 min-w-[11rem] border-b border-r border-line bg-foam px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                    Partner
                  </th>
                  <th className="sticky left-[11rem] z-30 min-w-[6.5rem] border-b border-r border-line bg-foam px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                    Metric
                  </th>
                  <th className="sticky left-[17.5rem] z-30 min-w-[7rem] border-b border-r border-line bg-foam px-3 py-2.5 text-right text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                    Total
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="min-w-[5.25rem] border-b border-line px-2 py-2.5 text-right text-[0.68rem] font-bold text-ink-soft"
                      title={day}
                    >
                      {shortDay(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(reportQuery.data?.rows ?? []).map((row) => {
                  const open = Boolean(expanded[row.affiliateCode]);
                  return (
                    <AffiliateBlock
                      key={row.affiliateCode}
                      affiliateCode={row.affiliateCode}
                      totals={row.totals}
                      byDay={row.byDay}
                      days={days}
                      open={open}
                      onToggle={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [row.affiliateCode]: !prev[row.affiliateCode],
                        }))
                      }
                      childrenRows={row.children}
                    />
                  );
                })}
                {(reportQuery.data?.rows.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + days.length}
                      className="px-4 py-10 text-center font-semibold text-ink-soft"
                    >
                      No orders match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type AffiliateBlockProps = {
  affiliateCode: string;
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
  days: string[];
  open: boolean;
  onToggle: () => void;
  childrenRows: {
    subAffiliateCode: string;
    totals: MetricBlock;
    byDay: Record<string, MetricBlock>;
  }[];
};

function AffiliateBlock({
  affiliateCode,
  totals,
  byDay,
  days,
  open,
  onToggle,
  childrenRows,
}: AffiliateBlockProps) {
  return (
    <>
      {METRICS.map((metric, idx) => (
        <tr key={`${affiliateCode}-${metric.key}`} className="group hover:bg-mist/70">
          {idx === 0 ? (
            <td
              rowSpan={5}
              className="sticky left-0 z-10 border-b border-r border-line bg-white px-2 py-2 align-top group-hover:bg-mist/70"
            >
              <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-start gap-1.5 rounded-xl px-1.5 py-1 text-left hover:bg-foam"
              >
                <span className="mt-0.5 text-brand-deep">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span>
                  <span className="block font-extrabold text-ink">{affiliateCode}</span>
                  <span className="mt-0.5 block text-[0.7rem] font-semibold text-ink-soft">
                    {childrenRows.length} sub-affiliate{childrenRows.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            </td>
          ) : null}
          <MetricCells
            metricKey={metric.key}
            label={metric.label}
            totals={totals}
            byDay={byDay}
            days={days}
            emphasize
          />
        </tr>
      ))}

      {open
        ? childrenRows.map((child) =>
            METRICS.map((metric, idx) => (
              <tr
                key={`${affiliateCode}-${child.subAffiliateCode}-${metric.key}`}
                className="bg-foam/35 hover:bg-foam/60"
              >
                {idx === 0 ? (
                  <td
                    rowSpan={5}
                    className="sticky left-0 z-10 border-b border-r border-line bg-foam/80 px-3 py-2 align-top"
                  >
                    <div className="pl-6">
                      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-soft">
                        Sub-affiliate
                      </p>
                      <p className="font-extrabold text-ink">{child.subAffiliateCode}</p>
                    </div>
                  </td>
                ) : null}
                <MetricCells
                  metricKey={metric.key}
                  label={metric.label}
                  totals={child.totals}
                  byDay={child.byDay}
                  days={days}
                />
              </tr>
            )),
          )
        : null}
    </>
  );
}

function MetricCells({
  metricKey,
  label,
  totals,
  byDay,
  days,
  emphasize,
}: {
  metricKey: keyof MetricBlock;
  label: string;
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
  days: string[];
  emphasize?: boolean;
}) {
  return (
    <>
      <td
        className={`sticky left-[11rem] z-10 border-b border-r border-line px-3 py-1.5 font-bold ${
          emphasize ? 'bg-white text-ink' : 'bg-foam/80 text-ink-soft'
        }`}
      >
        {label}
      </td>
      <td
        className={`sticky left-[17.5rem] z-10 border-b border-r border-line px-3 py-1.5 text-right font-extrabold tabular-nums ${
          emphasize ? 'bg-white text-ink' : 'bg-foam/80 text-ink'
        }`}
      >
        {formatMetric(metricKey, totals)}
      </td>
      {days.map((day) => (
        <td
          key={day}
          className="border-b border-line px-2 py-1.5 text-right tabular-nums text-ink-soft"
        >
          {formatMetric(metricKey, byDay[day])}
        </td>
      ))}
    </>
  );
}
