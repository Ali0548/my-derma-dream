import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormikContext } from 'formik';
import * as Yup from 'yup';
import { Pencil, Plus, Sparkles } from 'lucide-react';
import { reportsApi } from '../api/reports';
import {
  rulesApi,
  type OverlapResult,
  type PreviewResult,
  type RulePayload,
  type RuleRow,
} from '../api/rules';
import { AppForm } from '../components/form/AppForm';
import { TextField } from '../components/form/FormField';
import { FormSelect } from '../components/form/FormSelect';
import { FormSubmitButton } from '../components/form/FormSubmitButton';
import { Button } from '../components/ui/Button';
import { ComponentLoader } from '../components/ui/ComponentLoader';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import { Spinner } from '../components/ui/Spinner';

const ANY = '__ANY__';

const cpaTypeOptions: SelectOption[] = [
  { label: 'Fixed $', value: 'fixed' },
  { label: 'Percent %', value: 'percent' },
];

type EditorValues = {
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  cpaType: 'fixed' | 'percent';
  cpaValue: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
};

function scopeLabel(value: string | null | undefined) {
  return value ? value : 'Any';
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function toPayload(values: EditorValues): RulePayload {
  return {
    product: values.product === ANY ? '' : values.product,
    pricePoint: values.pricePoint === ANY ? '' : values.pricePoint,
    affiliate: values.affiliate === ANY ? '' : values.affiliate,
    subAffiliate: values.subAffiliate === ANY ? '' : values.subAffiliate,
    cpaType: values.cpaType,
    cpaValue: Number(values.cpaValue),
    effectiveFrom: values.effectiveFrom,
    effectiveTo: values.effectiveTo || null,
    notes: values.notes || null,
    isActive: true,
  };
}

function fromRule(row: RuleRow): EditorValues {
  return {
    product: row.product || ANY,
    pricePoint: row.pricePoint || ANY,
    affiliate: row.affiliate || ANY,
    subAffiliate: row.subAffiliate || ANY,
    cpaType: row.cpaType,
    cpaValue: String(row.cpaValue),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo ?? '',
    notes: row.notes ?? '',
  };
}

const editorSchema = Yup.object({
  product: Yup.string().required(),
  pricePoint: Yup.string().required(),
  affiliate: Yup.string().required(),
  subAffiliate: Yup.string().required(),
  cpaType: Yup.mixed<'fixed' | 'percent'>().oneOf(['fixed', 'percent']).required(),
  cpaValue: Yup.number()
    .typeError('Enter a number')
    .positive('Must be greater than 0')
    .required('Required'),
  effectiveFrom: Yup.string().required('Start date is required'),
  effectiveTo: Yup.string().nullable(),
  notes: Yup.string().nullable(),
});

type ScopeOptions = {
  productOptions: SelectOption[];
  priceOptionsFor: (productValue: string) => SelectOption[];
  affiliateOptions: SelectOption[];
  subOptionsFor: (affiliateValue: string) => SelectOption[];
};

export default function RulesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [formValues, setFormValues] = useState<EditorValues | null>(null);
  const [modalTitle, setModalTitle] = useState('Create CPA rule');
  const [overlap, setOverlap] = useState<OverlapResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [previewProduct, setPreviewProduct] = useState<SelectOption | null>(null);
  const [previewPrice, setPreviewPrice] = useState<SelectOption | null>(null);
  const [previewAffiliate, setPreviewAffiliate] = useState<SelectOption | null>(null);
  const [previewSub, setPreviewSub] = useState<SelectOption | null>(null);
  const [previewDate, setPreviewDate] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  const rulesQuery = useQuery({
    queryKey: ['rules'],
    queryFn: async () => (await rulesApi.list()).data,
  });

  const filtersQuery = useQuery({
    queryKey: ['report-filters'],
    queryFn: async () => (await reportsApi.filters()).data,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!previewDate && filtersQuery.data?.dateMax) {
      setPreviewDate(filtersQuery.data.dateMax);
    }
  }, [filtersQuery.data, previewDate]);

  const scopeOptions = useMemo<ScopeOptions>(() => {
    const products = (filtersQuery.data?.products ?? []).map((name) => ({
      label: name,
      value: name,
    }));
    const affiliates = (filtersQuery.data?.affiliates ?? []).map((code) => ({
      label: code,
      value: code,
    }));

    return {
      productOptions: [{ label: 'Any product', value: ANY }, ...products],
      affiliateOptions: [{ label: 'Any affiliate', value: ANY }, ...affiliates],
      priceOptionsFor: (productValue: string) => {
        const rows = filtersQuery.data?.pricePoints ?? [];
        const filtered =
          !productValue || productValue === ANY
            ? rows
            : rows.filter((r) => r.productName === productValue);
        return [
          { label: 'Any price', value: ANY },
          ...filtered.map((r) => ({
            label: `$${r.pricePoint}${productValue === ANY ? ` · ${r.productName}` : ''}`,
            value: r.pricePoint,
          })),
        ];
      },
      subOptionsFor: (affiliateValue: string) => {
        const rows = filtersQuery.data?.subAffiliates ?? [];
        const filtered =
          !affiliateValue || affiliateValue === ANY
            ? rows
            : rows.filter((r) => r.affiliateCode === affiliateValue);
        return [
          { label: 'Any sub-affiliate', value: ANY },
          ...filtered.map((r) => ({
            label: `${r.code} · ${r.affiliateCode}`,
            value: r.code,
          })),
        ];
      },
    };
  }, [filtersQuery.data]);

  const previewProductOptions = useMemo(
    () => (filtersQuery.data?.products ?? []).map((name) => ({ label: name, value: name })),
    [filtersQuery.data],
  );

  const previewPriceOptions = useMemo(() => {
    const rows = filtersQuery.data?.pricePoints ?? [];
    return rows
      .filter((r) => !previewProduct || r.productName === previewProduct.value)
      .map((r) => ({
        label: `$${r.pricePoint} · ${r.productName}`,
        value: r.pricePoint,
      }));
  }, [filtersQuery.data, previewProduct]);

  const previewAffiliateOptions = useMemo(
    () => (filtersQuery.data?.affiliates ?? []).map((code) => ({ label: code, value: code })),
    [filtersQuery.data],
  );

  const previewSubOptions = useMemo(() => {
    const rows = filtersQuery.data?.subAffiliates ?? [];
    return rows
      .filter((r) => !previewAffiliate || r.affiliateCode === previewAffiliate.value)
      .map((r) => ({ label: `${r.code} · ${r.affiliateCode}`, value: r.code }));
  }, [filtersQuery.data, previewAffiliate]);

  const overlapMutation = useMutation({
    mutationFn: async (values: EditorValues) => {
      const payload = toPayload(values);
      return (
        await rulesApi.overlap({
          ...payload,
          id: editing?.id,
          ruleId: editing?.ruleId,
        })
      ).data;
    },
    onSuccess: (data) => setOverlap(data),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!previewProduct || !previewPrice || !previewDate) {
        throw new Error('Product, price point, and date are required');
      }
      return (
        await rulesApi.preview({
          product: previewProduct.value,
          pricePoint: previewPrice.value,
          affiliate: previewAffiliate?.value ?? '',
          subAffiliate: previewSub?.value ?? '',
          orderDate: previewDate,
        })
      ).data;
    },
    onSuccess: (data) => setPreviewResult(data),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: EditorValues) => {
      const payload = toPayload(values);
      if (editing) return (await rulesApi.update(editing.id, payload)).data;
      return (await rulesApi.create(payload)).data;
    },
    onSuccess: async (data) => {
      setOverlap(data.overlap);
      setSaveMessage(
        editing
          ? `Updated ${data.rule.ruleId}. Commissions are recalculating in the background.`
          : `Created ${data.rule.ruleId}. Commissions are recalculating in the background.`,
      );
      setCreating(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => (await rulesApi.deactivate(id)).data,
    onSuccess: async () => {
      setSaveMessage('Rule deactivated. Commissions are recalculating in the background.');
      await queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const columns = useMemo<ColumnDef<RuleRow>[]>(
    () => [
      { id: 'ruleId', accessorKey: 'ruleId', header: 'Rule' },
      {
        id: 'product',
        accessorFn: (r) => scopeLabel(r.product),
        header: 'Product',
      },
      {
        id: 'pricePoint',
        accessorFn: (r) => (r.pricePoint ? `$${r.pricePoint}` : 'Any'),
        header: 'Price',
      },
      {
        id: 'affiliate',
        accessorFn: (r) => scopeLabel(r.affiliate),
        header: 'Affiliate',
      },
      {
        id: 'subAffiliate',
        accessorFn: (r) => scopeLabel(r.subAffiliate),
        header: 'Sub',
      },
      {
        id: 'cpa',
        accessorFn: (r) => (r.cpaType === 'percent' ? `${r.cpaValue}%` : money(r.cpaValue)),
        header: 'CPA',
      },
      {
        id: 'dates',
        accessorFn: (r) => `${r.effectiveFrom} → ${r.effectiveTo ?? 'open'}`,
        header: 'Effective',
      },
      {
        id: 'isActive',
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => (getValue() ? 'Active' : 'Inactive'),
        filterFn: (row, id, value) => {
          if (!value) return true;
          const active = row.getValue<boolean>(id);
          return value === 'active' ? active : !active;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Pencil size={14} />}
            onClick={() => {
              setEditing(row.original);
              setCreating(false);
              setFormValues(fromRule(row.original));
              setModalTitle(`Edit ${row.original.ruleId}`);
              setOverlap(null);
              setSaveMessage(null);
            }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  const editorOpen = creating || Boolean(editing);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setModalTitle('Create CPA rule');
    setFormValues({
      product: ANY,
      pricePoint: ANY,
      affiliate: ANY,
      subAffiliate: ANY,
      cpaType: 'percent',
      cpaValue: '10',
      effectiveFrom: filtersQuery.data?.dateMin ?? '2025-01-01',
      effectiveTo: '',
      notes: '',
    });
    setOverlap(null);
    setSaveMessage(null);
  };

  const closeEditor = () => {
    setCreating(false);
    setEditing(null);
  };

  const clearEditorState = () => {
    setFormValues(null);
    setOverlap(null);
  };

  if (rulesQuery.isLoading || filtersQuery.isLoading) {
    return <ComponentLoader label="Loading CPA rules" rows={6} />;
  }

  if (rulesQuery.isError) {
    return (
      <div className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger">
        Could not load CPA rules.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saveMessage ? (
        <div className="rounded-xl border border-mint/40 bg-mint/10 px-4 py-3 text-sm font-semibold text-ink">
          {saveMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-line bg-white/90 p-3 shadow-soft sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-deep">
              CPA contracts
            </p>
            <h2 className="text-lg font-extrabold text-ink">Rule editor</h2>
            <p className="text-sm text-ink-soft">
              Set product, price, partner, and dates — or leave any field as Any.
            </p>
          </div>
          <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
            New rule
          </Button>
        </div>

        <DataTable
          title="All rules"
          data={rulesQuery.data ?? []}
          columns={columns}
          exportFileName="lumora-cpa-rules"
          searchPlaceholder="Search by rule, product, affiliate…"
          filters={[
            {
              id: 'isActive',
              label: 'Status',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
            },
          ]}
        />
      </section>

      {formValues ? (
        <Modal
          open={editorOpen}
          onClose={closeEditor}
          onExited={clearEditorState}
          size="xl"
          title={modalTitle}
          description="Overlaps are checked live. Saving also refreshes commissions in the background."
        >
          <AppForm
            enableReinitialize
            initialValues={formValues}
            validationSchema={editorSchema}
            onSubmit={async (values) => {
              await saveMutation.mutateAsync(values);
            }}
          >
            <RuleEditorFields
              scopeOptions={scopeOptions}
              overlap={overlap}
              checkingOverlap={overlapMutation.isPending}
              onCheckOverlap={(vals) => overlapMutation.mutate(vals)}
              editing={editing}
              onDeactivate={
                editing?.isActive
                  ? () => {
                      if (confirm(`Deactivate ${editing.ruleId}?`)) {
                        void deactivateMutation.mutateAsync(editing.id).then(closeEditor);
                      }
                    }
                  : undefined
              }
              deactivating={deactivateMutation.isPending}
              saveFailed={saveMutation.isError}
            />
          </AppForm>
        </Modal>
      ) : null}

      <section className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-start gap-2">
          <Sparkles className="mt-0.5 text-brand-deep" size={18} />
          <div>
            <h3 className="text-lg font-extrabold text-ink">Preview a sale</h3>
            <p className="text-sm text-ink-soft">
              Enter product, price, partner, sub, and a date. See which rule applies and the
              commission it produces.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SearchableSelect
            label="Product"
            options={previewProductOptions}
            value={previewProduct}
            onChange={(v) => {
              setPreviewProduct(v as SelectOption | null);
              setPreviewPrice(null);
            }}
            placeholder="Choose product"
          />
          <SearchableSelect
            label="Price point"
            options={previewPriceOptions}
            value={previewPrice}
            onChange={(v) => setPreviewPrice(v as SelectOption | null)}
            placeholder="Choose price"
          />
          <SearchableSelect
            label="Affiliate"
            isClearable
            options={previewAffiliateOptions}
            value={previewAffiliate}
            onChange={(v) => {
              setPreviewAffiliate(v as SelectOption | null);
              setPreviewSub(null);
            }}
            placeholder="Any / blank"
          />
          <SearchableSelect
            label="Sub-affiliate"
            isClearable
            options={previewSubOptions}
            value={previewSub}
            onChange={(v) => setPreviewSub(v as SelectOption | null)}
            placeholder="Any / blank"
          />
          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-ink">Order date</span>
            <input
              type="date"
              value={previewDate}
              onChange={(e) => setPreviewDate(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold shadow-soft"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => previewMutation.mutate()}
            loading={previewMutation.isPending}
            leftIcon={<Sparkles size={16} />}
          >
            Run preview
          </Button>
          {previewMutation.isError ? (
            <span className="text-sm font-semibold text-danger">
              Preview needs a product, price point, and date.
            </span>
          ) : null}
        </div>

        {previewResult ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-foam/50 px-4 py-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-soft">
                Result
              </p>
              <p className="mt-1 text-2xl font-extrabold text-ink">
                {previewResult.resolution.status === 'resolved'
                  ? money(previewResult.resolution.commission)
                  : 'No rule'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {previewResult.resolution.winReason}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 lg:col-span-2">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-soft">
                Winning rule
              </p>
              {previewResult.resolution.winningRule ? (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  <PreviewRow label="Rule" value={previewResult.resolution.winningRule.ruleId} />
                  <PreviewRow
                    label="CPA"
                    value={
                      previewResult.resolution.winningRule.cpaType === 'percent'
                        ? `${previewResult.resolution.winningRule.cpaValue}%`
                        : money(previewResult.resolution.winningRule.cpaValue)
                    }
                  />
                  <PreviewRow
                    label="Scope"
                    value={[
                      previewResult.resolution.winningRule.product || 'any product',
                      previewResult.resolution.winningRule.pricePoint
                        ? `$${previewResult.resolution.winningRule.pricePoint}`
                        : 'any price',
                      previewResult.resolution.winningRule.affiliate || 'any affiliate',
                      previewResult.resolution.winningRule.subAffiliate || 'any sub',
                    ].join(' · ')}
                  />
                  <PreviewRow
                    label="Dates"
                    value={`${previewResult.resolution.winningRule.effectiveFrom} → ${
                      previewResult.resolution.winningRule.effectiveTo ?? 'open'
                    }`}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-ink-soft">No matching active rule.</p>
              )}

              {previewResult.matchedCandidates.length > 1 ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                    Other matching candidates
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {previewResult.matchedCandidates
                      .filter((c) => !c.isWinner)
                      .map((c) => (
                        <li key={c.ruleId} className="text-sm text-ink-soft">
                          <span className="font-extrabold text-ink">{c.ruleId}</span> —{' '}
                          {c.outcomeDetail}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RuleEditorFields({
  scopeOptions,
  overlap,
  checkingOverlap,
  onCheckOverlap,
  editing,
  onDeactivate,
  deactivating,
  saveFailed,
}: {
  scopeOptions: ScopeOptions;
  overlap: OverlapResult | null;
  checkingOverlap: boolean;
  onCheckOverlap: (values: EditorValues) => void;
  editing: RuleRow | null;
  onDeactivate?: () => void;
  deactivating: boolean;
  saveFailed: boolean;
}) {
  const { values } = useFormikContext<EditorValues>();

  useEffect(() => {
    const handle = window.setTimeout(() => onCheckOverlap(values), 350);
    return () => window.clearTimeout(handle);
  }, [
    values.product,
    values.pricePoint,
    values.affiliate,
    values.subAffiliate,
    values.cpaType,
    values.cpaValue,
    values.effectiveFrom,
    values.effectiveTo,
    editing?.id,
  ]);

  return (
    <>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FormSelect
          name="product"
          label="Product"
          options={scopeOptions.productOptions}
          isClearable={false}
          hint="Any = every front-end product"
        />
        <FormSelect
          name="pricePoint"
          label="Price point"
          options={scopeOptions.priceOptionsFor(values.product)}
          isClearable={false}
        />
        <FormSelect
          name="affiliate"
          label="Affiliate"
          options={scopeOptions.affiliateOptions}
          isClearable={false}
        />
        <FormSelect
          name="subAffiliate"
          label="Sub-affiliate"
          options={scopeOptions.subOptionsFor(values.affiliate)}
          isClearable={false}
        />
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FormSelect name="cpaType" label="Contract type" options={cpaTypeOptions} isClearable={false} />
        <TextField
          name="cpaValue"
          label={values.cpaType === 'percent' ? 'Percent value' : 'Fixed dollars'}
          type="number"
          step="0.01"
          min="0"
          hint={
            values.cpaType === 'percent' ? 'Paid on front-end price only' : 'Flat amount per order'
          }
        />
        <TextField name="effectiveFrom" label="Effective from" type="date" />
        <TextField
          name="effectiveTo"
          label="Effective to"
          type="date"
          hint="Leave blank for no end date"
        />
      </div>

      <TextField name="notes" label="Notes (optional)" placeholder="Why this rate?" />

      <OverlapPanel
        overlap={overlap}
        checking={checkingOverlap}
        draft={{
          ruleId: editing?.ruleId ?? 'this draft',
          product: values.product,
          pricePoint: values.pricePoint,
          affiliate: values.affiliate,
          subAffiliate: values.subAffiliate,
          cpaType: values.cpaType,
          cpaValue: Number(values.cpaValue) || 0,
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FormSubmitButton>{editing ? 'Save changes' : 'Create rule'}</FormSubmitButton>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCheckOverlap(values)}
          loading={checkingOverlap}
        >
          Re-check overlaps
        </Button>
        {onDeactivate ? (
          <Button type="button" variant="danger" onClick={onDeactivate} loading={deactivating}>
            Deactivate
          </Button>
        ) : null}
        {saveFailed ? (
          <span className="text-sm font-semibold text-danger">
            Save failed. Check the form and try again.
          </span>
        ) : null}
      </div>
    </>
  );
}

type OverlapExample = {
  id: string;
  label: string;
  draftRuleId: string;
  draftScope: string;
  draftCpa: string;
  otherRuleId: string;
  otherScope: string;
  otherCpa: string;
  orderA: {
    title: string;
    detail: string;
    winnerId: string;
    loserId: string;
    price: string;
    winnerCpa: string;
    paid: string;
    outcome: string;
  };
  orderB: {
    title: string;
    detail: string;
    winnerId: string;
    price: string;
    winnerCpa: string;
    paid: string;
    outcome: string;
  } | null;
  summary: string;
};

function parseScopeParts(scope: string) {
  const parts = scope.split(',').map((p) => p.trim());
  const product = parts[0] && parts[0] !== 'any product' ? parts[0] : null;
  const pricePart = parts.find((p) => p.startsWith('price '));
  const price = pricePart ? pricePart.replace(/^price\s+/, '') : null;

  // Backend describeScope: "…, AFF001, AFF001-S04" or "…, any affiliate, any sub"
  const affRaw = parts[2] ?? '';
  const subRaw = parts[3] ?? '';
  const affiliate =
    affRaw && affRaw !== 'any affiliate' ? affRaw.replace(/^affiliate\s+/, '') : null;
  const sub =
    subRaw && subRaw !== 'any sub' && !subRaw.startsWith('any ')
      ? subRaw.replace(/^sub[- ]?affiliate\s+/i, '')
      : null;

  return { product, price, affiliate, sub };
}

function overlapFocusLabel(parts: {
  product: string | null;
  price: string | null;
  affiliate: string | null;
  sub: string | null;
  fallbackProduct: string;
  fallbackPrice: string;
  draftAffiliate: string;
  draftSub: string;
}) {
  const product = parts.product || parts.fallbackProduct;
  const price = parts.price || parts.fallbackPrice;
  const affiliate = parts.affiliate || parts.draftAffiliate || null;
  const sub = parts.sub || parts.draftSub || null;

  const bits = [product, `$${price}`];
  bits.push(affiliate ? `affiliate ${affiliate}` : 'any affiliate');
  bits.push(sub ? `sub ${sub}` : 'any sub');
  return bits.join(' · ');
}

function formatDraftScope(draft: {
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
}) {
  return [
    draft.product || 'any product',
    draft.pricePoint ? `price $${draft.pricePoint}` : 'any price',
    draft.affiliate ? `affiliate ${draft.affiliate}` : 'any affiliate',
    draft.subAffiliate ? `sub ${draft.subAffiliate}` : 'any sub',
  ].join(' · ');
}

function formatCpa(type: 'fixed' | 'percent', value: number) {
  return type === 'percent' ? `${value}%` : `$${Number(value).toFixed(2)} fixed`;
}

function commissionOnPrice(
  type: 'fixed' | 'percent',
  value: number,
  price: string,
): { paid: string; math: string } {
  const p = Number(price) || 0;
  if (type === 'fixed') {
    const paid = Number(value);
    return {
      paid: `$${paid.toFixed(2)}`,
      math: `fixed $${paid.toFixed(2)} (price $${p.toFixed(2)} does not change a fixed CPA)`,
    };
  }
  const paid = Math.round((p * value) / 100 * 100) / 100;
  return {
    paid: `$${paid.toFixed(2)}`,
    math: `price $${p.toFixed(2)} × ${value}% = $${paid.toFixed(2)}`,
  };
}

function pickFallbackPrice(taken: Set<string>) {
  for (const candidate of ['99', '119', '149', '199', '79']) {
    if (!taken.has(candidate)) return candidate;
  }
  return '249';
}

function buildOverlapExamples(
  draft: {
    ruleId: string;
    product: string;
    pricePoint: string;
    affiliate: string;
    subAffiliate: string;
    cpaType: 'fixed' | 'percent';
    cpaValue: number;
  },
  overlap: OverlapResult,
): OverlapExample[] {
  const draftRuleId = draft.ruleId || 'This draft';
  const draftScope = formatDraftScope(draft);
  const draftCpa = formatCpa(draft.cpaType, draft.cpaValue);
  const draftProduct = draft.product || 'this product';
  const examples: OverlapExample[] = [];

  const losers = overlap.overlaps
    .filter((item) => !item.draftWouldWin)
    .sort((a, b) => b.existingSpecificity - a.existingSpecificity);

  const preferred = [
    ...losers.filter((item) => /price\s+\d/.test(item.existingScope)),
    ...losers.filter((item) => !/price\s+\d/.test(item.existingScope)),
  ].slice(0, 5);

  const takenPrices = new Set(
    preferred
      .map((item) => parseScopeParts(item.existingScope).price)
      .filter((p): p is string => Boolean(p)),
  );
  if (draft.pricePoint) takenPrices.add(draft.pricePoint);
  const freePrice = pickFallbackPrice(takenPrices);

  for (const item of preferred) {
    const parsed = parseScopeParts(item.existingScope);
    const orderProduct = parsed.product || draftProduct;
    const orderPrice = parsed.price || draft.pricePoint || '49';
    const otherCpa = formatCpa(item.existingCpaType, item.existingCpaValue);
    const otherScope = item.existingScope
      .replace(/,\s*/g, ' · ')
      .replace(/price\s+(\d+)/g, 'price $$$1');

    const aPay = commissionOnPrice(item.existingCpaType, item.existingCpaValue, orderPrice);
    const bPay = commissionOnPrice(draft.cpaType, draft.cpaValue, freePrice);

    const draftPctLine =
      draft.cpaType === 'percent'
        ? `we do not pay ${draft.cpaValue}% of $${orderPrice} from ${draftRuleId}`
        : `we do not pay the ${draftCpa} from ${draftRuleId}`;

    const focus = overlapFocusLabel({
      product: parsed.product,
      price: parsed.price,
      affiliate: parsed.affiliate,
      sub: parsed.sub,
      fallbackProduct: draftProduct,
      fallbackPrice: orderPrice,
      draftAffiliate: draft.affiliate,
      draftSub: draft.subAffiliate,
    });

    const affLine = parsed.affiliate
      ? `Affiliate (reference) = ${parsed.affiliate}`
      : 'Affiliate (reference) = any';
    const subLine = parsed.sub
      ? `Sub-affiliate (sub reference) = ${parsed.sub}`
      : 'Sub-affiliate (sub reference) = any';

    examples.push({
      id: `pair-${item.existingRuleId}`,
      label: `${draftRuleId} ↔ ${item.existingRuleId} (overlap on ${focus})`,
      draftRuleId,
      draftScope,
      draftCpa,
      otherRuleId: item.existingRuleId,
      otherScope,
      otherCpa,
      orderA: {
        title: `Order A — ${orderProduct} · Price = $${orderPrice}`,
        detail: `Customer buys ${orderProduct}. Price = $${orderPrice}. ${affLine}. ${subLine}. Both rules match.`,
        winnerId: item.winnerRuleId,
        loserId: draftRuleId,
        price: orderPrice,
        winnerCpa: otherCpa,
        paid: aPay.paid,
        outcome: `${item.existingRuleId} wins because it is more specific — it fills in more exact fields (product / price / affiliate / sub). ${draftRuleId} is skipped. So ${draftPctLine}. The tighter rule pays instead (${aPay.math}).`,
      },
      orderB: {
        title: `Order B — ${orderProduct} · Price = $${freePrice}`,
        detail: `Same product, but Price = $${freePrice}. No tighter rule locks this price / partner combo. Only broad ${draftRuleId} matches.`,
        winnerId: draftRuleId,
        price: freePrice,
        winnerCpa: draftCpa,
        paid: bPay.paid,
        outcome: `${draftRuleId} wins. Math: ${bPay.math}. Broad rule = fallback. Specific rule = wins when its exact price / affiliate / sub hits.`,
      },
      summary: `Broad ${draftRuleId} (${draftCpa}) overlaps specific ${item.existingRuleId} (${otherCpa}). Focus: ${focus}. At $${orderPrice} the specific rule pays; at $${freePrice} the broad rule pays.`,
    });
  }

  const winner = overlap.overlaps.find((item) => item.draftWouldWin);
  if (winner) {
    const otherScope = winner.existingScope.replace(/,\s*/g, ' · ');
    const winParsed = parseScopeParts(winner.existingScope);
    const samplePrice = draft.pricePoint || winParsed.price || '99';
    const pay = commissionOnPrice(draft.cpaType, draft.cpaValue, samplePrice);
    const otherCpa = formatCpa(winner.existingCpaType, winner.existingCpaValue);
    const focus = overlapFocusLabel({
      product: winParsed.product,
      price: winParsed.price || samplePrice,
      affiliate: winParsed.affiliate,
      sub: winParsed.sub,
      fallbackProduct: draftProduct,
      fallbackPrice: samplePrice,
      draftAffiliate: draft.affiliate,
      draftSub: draft.subAffiliate,
    });
    examples.unshift({
      id: `pair-win-${winner.existingRuleId}`,
      label: `${draftRuleId} ↔ ${winner.existingRuleId} (draft wins · ${focus})`,
      draftRuleId,
      draftScope,
      draftCpa,
      otherRuleId: winner.existingRuleId,
      otherScope,
      otherCpa,
      orderA: {
        title: `Order — both rules match · Price = $${samplePrice}`,
        detail: `Customer buys this sale at Price = $${samplePrice}. ${
          winParsed.affiliate
            ? `Affiliate (reference) = ${winParsed.affiliate}.`
            : 'Affiliate (reference) = any.'
        } ${
          winParsed.sub
            ? `Sub-affiliate (sub reference) = ${winParsed.sub}.`
            : 'Sub-affiliate (sub reference) = any.'
        } Both ${draftRuleId} and ${winner.existingRuleId} match.`,
        winnerId: draftRuleId,
        loserId: winner.existingRuleId,
        price: samplePrice,
        winnerCpa: draftCpa,
        paid: pay.paid,
        outcome: `${draftRuleId} wins because it is more specific than ${winner.existingRuleId}. ${winner.existingRuleId} is skipped. Math: ${pay.math}.`,
      },
      orderB: null,
      summary: `${draftRuleId} overlaps ${winner.existingRuleId} on ${focus}, but the draft wins and pays ${pay.paid}.`,
    });
  }

  return examples;
}

function RuleChip({
  ruleId,
  tone,
}: {
  ruleId: string;
  tone: 'draft' | 'other' | 'winner' | 'loser';
}) {
  const cls =
    tone === 'winner'
      ? 'bg-success/15 text-success'
      : tone === 'loser'
        ? 'bg-copper/20 text-copper'
        : tone === 'draft'
          ? 'bg-brand/15 text-brand-deep'
          : 'bg-foam text-ink';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-extrabold ${cls}`}>
      {ruleId}
    </span>
  );
}

function OverlapPanel({
  overlap,
  checking,
  draft,
}: {
  overlap: OverlapResult | null;
  checking: boolean;
  draft: {
    ruleId: string;
    product: string;
    pricePoint: string;
    affiliate: string;
    subAffiliate: string;
    cpaType: 'fixed' | 'percent';
    cpaValue: number;
  };
}) {
  const examples = useMemo(
    () => (overlap?.hasOverlap ? buildOverlapExamples(draft, overlap) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when draft scope or overlap set changes
    [
      overlap,
      draft.ruleId,
      draft.product,
      draft.pricePoint,
      draft.affiliate,
      draft.subAffiliate,
      draft.cpaType,
      draft.cpaValue,
    ],
  );

  const [exampleId, setExampleId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!examples.length) {
      setExampleId(null);
      return;
    }
    setExampleId((current) => {
      if (current && examples.some((e) => e.id === current)) return current;
      return examples.find((e) => e.id.startsWith('pair-') && !e.id.includes('win'))?.id ?? examples[0]?.id ?? null;
    });
    setShowAll(false);
  }, [examples]);

  if (checking && !overlap) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-foam px-3 py-2 text-sm text-ink-soft">
        <Spinner size={16} /> Checking overlaps…
      </div>
    );
  }

  if (!overlap) return null;

  if (!overlap.hasOverlap) {
    return (
      <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
        No overlapping active rules for this scope and date range.
      </div>
    );
  }

  const selected = examples.find((e) => e.id === exampleId) ?? examples[0] ?? null;
  const exampleOptions: SelectOption[] = examples.map((e) => ({
    label: e.label,
    value: e.id,
  }));

  return (
    <div className="rounded-xl border border-copper/30 bg-copper/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-3xl">
          <p className="font-extrabold text-ink">
            Overlap check · {overlap.overlapCount} other rule
            {overlap.overlapCount === 1 ? '' : 's'} can cover the same sales
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Pick a real overlapping pair below. Each example uses your draft plus one competing
            rule from the live data — same structure as Order A / Order B.
          </p>
        </div>
        <p className="shrink-0 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-ink-soft">
          Draft wins {overlap.draftWouldWinCount} · loses {overlap.draftWouldLoseCount}
          {checking ? ' · updating…' : ''}
        </p>
      </div>

      {examples.length > 0 ? (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-white px-3 py-3">
          <SearchableSelect
            label="Choose an overlap example"
            options={exampleOptions}
            value={exampleOptions.find((o) => o.value === exampleId) ?? exampleOptions[0] ?? null}
            onChange={(opt) => setExampleId((opt as SelectOption | null)?.value ?? null)}
            isClearable={false}
            hint="Example: R0001 ↔ R0005 on Radiance Serum at $49"
          />

          {selected ? (
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="rounded-lg bg-foam px-3 py-2 font-semibold text-ink">
                {selected.summary}
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-brand/25 bg-brand/5 px-3.5 py-3">
                  <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-brand-deep">
                    Your draft
                  </p>
                  <div className="mt-1.5">
                    <RuleChip ruleId={selected.draftRuleId} tone="draft" />
                  </div>
                  <p className="mt-2 font-semibold text-ink">{selected.draftScope}</p>
                  <p className="mt-1 text-ink-soft">CPA {selected.draftCpa}</p>
                </div>
                <div className="rounded-xl border border-line bg-foam/70 px-3.5 py-3">
                  <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-soft">
                    Overlapping rule
                  </p>
                  <div className="mt-1.5">
                    <RuleChip ruleId={selected.otherRuleId} tone="other" />
                  </div>
                  <p className="mt-2 font-semibold text-ink">{selected.otherScope}</p>
                  <p className="mt-1 text-ink-soft">CPA {selected.otherCpa}</p>
                </div>
              </div>

              <div className="rounded-xl border border-copper/30 bg-copper/5 px-3.5 py-3 space-y-2">
                <p className="font-extrabold text-ink">{selected.orderA.title}</p>
                <p className="text-ink-soft">{selected.orderA.detail}</p>
                <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                  <span className="rounded-md bg-white px-2 py-1 text-ink">
                    Price = ${selected.orderA.price}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 text-brand-deep">
                    Winner CPA = {selected.orderA.winnerCpa}
                  </span>
                  <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                    Paid = {selected.orderA.paid}
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-2">
                  <RuleChip ruleId={selected.orderA.winnerId} tone="winner" />
                  <span className="text-xs font-bold text-success">wins</span>
                  <span className="text-ink-soft">·</span>
                  <RuleChip ruleId={selected.orderA.loserId} tone="loser" />
                  <span className="text-xs font-bold text-copper">skipped</span>
                </p>
                <p className="font-semibold leading-relaxed text-ink">{selected.orderA.outcome}</p>
              </div>

              {selected.orderB ? (
                <div className="rounded-xl border border-success/30 bg-success/5 px-3.5 py-3 space-y-2">
                  <p className="font-extrabold text-ink">{selected.orderB.title}</p>
                  <p className="text-ink-soft">{selected.orderB.detail}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                    <span className="rounded-md bg-white px-2 py-1 text-ink">
                      Price = ${selected.orderB.price}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-brand-deep">
                      Winner CPA = {selected.orderB.winnerCpa}
                    </span>
                    <span className="rounded-md bg-success/15 px-2 py-1 text-success">
                      Paid = {selected.orderB.paid}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-2">
                    <RuleChip ruleId={selected.orderB.winnerId} tone="winner" />
                    <span className="text-xs font-bold text-success">wins</span>
                  </p>
                  <p className="font-semibold leading-relaxed text-ink">{selected.orderB.outcome}</p>
                  <p className="rounded-lg bg-white/90 px-3 py-2 text-sm font-extrabold text-brand-deep">
                    Broad rule = fallback. Specific price rule = wins when that price hits.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <button
          type="button"
          className="text-sm font-bold text-brand-deep underline-offset-2 hover:underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? 'Hide full competing-rule list'
            : `Show all ${overlap.overlapCount} competing rules`}
        </button>
      </div>

      {showAll ? (
        <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {overlap.overlaps.map((item) => (
            <li
              key={item.existingRuleId}
              className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-ink">{item.existingRuleId}</span>
                <span
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[0.7rem] font-extrabold ${
                    item.draftWouldWin ? 'bg-success/15 text-success' : 'bg-copper/20 text-copper'
                  }`}
                >
                  {item.draftWouldWin ? 'Draft would win' : `${item.winnerRuleId} would win`}
                </span>
              </div>
              <p className="mt-1 text-ink-soft">{item.existingScope}</p>
              <p className="mt-1 font-semibold text-ink">{item.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="font-extrabold text-ink">{value}</p>
    </div>
  );
}
