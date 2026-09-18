import type { ColumnDef } from '@tanstack/react-table';
import type { RuleEvaluation } from '../../api/audit';

const OUTCOME_LABEL: Record<string, string> = {
  winner: 'Applied',
  date_out_of_range: 'Date miss',
  scope_mismatch: 'Scope miss',
  lower_specificity: 'Less specific',
  tie_lost: 'Tie lost',
  no_candidates: 'No candidates',
};

const OUTCOME_HINT: Record<string, string> = {
  winner: 'This rule won and paid the order',
  date_out_of_range: 'Skipped — order date outside the rule’s effective window',
  scope_mismatch: 'Skipped — product, price, affiliate, or sub did not match',
  lower_specificity: 'Matched, but a more specific rule won',
  tie_lost: 'Matched at the same score, but lost the tie-break',
  no_candidates: 'No candidate rules were available',
};


function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function scopeLabel(row: RuleEvaluation) {
  return [
    row.product || 'any product',
    row.pricePoint ? `$${row.pricePoint}` : 'any price',
    row.affiliate || 'any affiliate',
    row.subAffiliate || 'any sub',
  ].join(' · ');
}

/** Shared column set for the rule outcome DataTable (Audit + Performance why modal). */
export function ruleEvaluationColumns(): ColumnDef<RuleEvaluation, unknown>[] {
  return [
    {
      id: 'ruleId',
      accessorKey: 'ruleId',
      header: 'Rule',
      cell: ({ row }) => (
        <span className={row.original.isWinner ? 'font-extrabold text-success' : 'font-extrabold text-ink'}>
          {row.original.ruleId}
        </span>
      ),
    },
    {
      id: 'outcome',
      accessorFn: (r) => OUTCOME_LABEL[r.outcomeCode] ?? r.outcomeCode,
      header: 'Outcome',
      size: 140,
      minSize: 120,
      cell: ({ row }) => {
        const r = row.original;
        const label = OUTCOME_LABEL[r.outcomeCode] ?? r.outcomeCode;
        const hint = OUTCOME_HINT[r.outcomeCode] ?? label;
        return (
          <span
            title={hint}
            className={`inline-flex max-w-none whitespace-nowrap rounded-md px-2.5 py-1 text-[0.7rem] font-extrabold tracking-wide ${
              r.isWinner
                ? 'bg-success/15 text-success'
                : r.matched
                  ? 'bg-copper/15 text-copper'
                  : 'bg-foam text-ink-soft'
            }`}
          >
            {label}
          </span>
        );
      },
      filterFn: (row, _id, value) => {
        if (!value) return true;
        if (value === 'applied') return row.original.isWinner;
        if (value === 'matched') return row.original.matched && !row.original.isWinner;
        if (value === 'skipped') return !row.original.matched;
        return true;
      },
    },
    {
      id: 'why',
      accessorKey: 'outcomeDetail',
      header: 'Why (plain English)',
      cell: ({ getValue }) => (
        <span className="block max-w-xl whitespace-normal text-sm leading-relaxed text-ink">
          {String(getValue())}
        </span>
      ),
    },
    {
      id: 'scope',
      accessorFn: (r) => scopeLabel(r),
      header: 'Rule scope',
      cell: ({ getValue }) => <span className="text-xs text-ink-soft">{String(getValue())}</span>,
    },
    {
      id: 'score',
      accessorKey: 'specificityScore',
      header: 'Score',
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-extrabold tabular-nums">{row.original.specificityScore}</div>
          <div className="max-w-[9rem] text-[0.65rem] leading-snug text-ink-soft">
            {row.original.scoreBreakdown}
          </div>
        </div>
      ),
    },
    {
      id: 'cpa',
      accessorFn: (r) =>
        r.cpaType == null
          ? '—'
          : r.cpaType === 'percent'
            ? `${r.cpaValue}%`
            : money(r.cpaValue ?? undefined),
      header: 'CPA',
    },
    {
      id: 'ifApplied',
      accessorFn: (r) => r.hypotheticalCommission,
      header: 'If applied',
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return <span className="tabular-nums">{money(v ?? undefined)}</span>;
      },
    },
  ];
}

export const ruleEvaluationFilters = [
  {
    id: 'outcome',
    label: 'Outcome',
    options: [
      { label: 'Applied', value: 'applied' },
      { label: 'Matched but lost', value: 'matched' },
      { label: 'Skipped (date/scope)', value: 'skipped' },
    ],
  },
];
