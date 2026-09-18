import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { auditApi, type RuleEvaluation } from '../api/audit';
import { ruleEvaluationColumns, ruleEvaluationFilters } from '../components/audit/ruleEvaluationColumns';
import { Button } from '../components/ui/Button';
import { ComponentLoader } from '../components/ui/ComponentLoader';
import { DataTable } from '../components/ui/DataTable';

export default function AuditPage() {
  const [input, setInput] = useState('ORD0000235');
  const [orderId, setOrderId] = useState('ORD0000235');

  const query = useQuery({
    queryKey: ['audit', orderId],
    queryFn: async () => {
      const res = await auditApi.byOrderId(orderId);
      return res.data;
    },
    enabled: Boolean(orderId),
  });

  const evaluations = useMemo(() => {
    const rows = [...(query.data?.resolution.evaluations ?? [])];
    return rows.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (a.matched !== b.matched) return a.matched ? -1 : 1;
      return b.specificityScore - a.specificityScore;
    });
  }, [query.data]);

  const columns = useMemo(() => ruleEvaluationColumns(), []);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white/90 p-4 shadow-soft sm:p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-deep">
          Order audit
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
          See which rule paid — and why others did not
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Enter any order ID. The table below names every rule, whether it applied or was skipped, and
          explains why in plain English (including how the specificity score is built).
        </p>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setOrderId(input.trim());
          }}
        >
          <label className="grid flex-1 gap-1.5">
            <span className="text-sm font-bold text-ink">Order ID</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. ORD0000235"
              className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold shadow-soft"
            />
          </label>
          <Button type="submit" leftIcon={<Search size={16} />} loading={query.isFetching}>
            Inspect order
          </Button>
        </form>
      </section>

      {query.isLoading ? <ComponentLoader label="Resolving commission" rows={4} /> : null}

      {query.isError ? (
        <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
          Order not found, or the audit service failed. Check the order ID and try again.
        </div>
      ) : null}

      {query.data ? (
        <>
          <section className="grid gap-3 lg:grid-cols-3">
            <InfoCard title="Order">
              <Row label="Order ID" value={query.data.order.orderId} />
              <Row label="Date" value={query.data.order.orderDate} />
              <Row label="Affiliate" value={query.data.order.affiliateCode || '—'} />
              <Row label="Sub-affiliate" value={query.data.order.subAffiliateCode || '—'} />
              <Row label="Product" value={query.data.order.product1Name} />
              <Row
                label="Price point"
                value={`$${query.data.order.pricePoint ?? query.data.order.product1Price}`}
              />
            </InfoCard>
            <InfoCard title="Revenue">
              <Row label="Front-end" value={money(query.data.order.frontendRevenue)} />
              <Row label="Upsells" value={money(query.data.order.upsellRevenue)} />
              <Row label="Total" value={money(query.data.order.totalRevenue)} />
            </InfoCard>
            <InfoCard title="Commission result">
              <Row
                label="Status"
                value={
                  query.data.resolution.status === 'resolved' ? 'Rule applied' : 'No matching rule'
                }
              />
              <Row label="Winning rule" value={query.data.resolution.winningRule?.ruleId ?? '—'} />
              <Row label="Paid" value={money(String(query.data.resolution.commission))} />
              <p className="mt-3 rounded-xl bg-foam px-3 py-2 text-sm leading-relaxed text-ink">
                {query.data.resolution.winReason}
              </p>
            </InfoCard>
          </section>

          <div className="rounded-3xl border border-line bg-white p-3 shadow-soft sm:p-4">
            <DataTable
              title="Every rule checked for this order"
              data={evaluations}
              columns={columns as ColumnDef<RuleEvaluation, unknown>[]}
              exportFileName={`${orderId}-rule-outcomes`}
              searchPlaceholder="Search by rule id, why text, scope…"
              filters={ruleEvaluationFilters}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-soft">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{title}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <span className="text-sm font-extrabold text-ink">{value}</span>
    </div>
  );
}

function money(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
