import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { Download, FileSpreadsheet, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { Button } from './Button';
import { SearchableSelect, type SelectOption } from './SearchableSelect';

export type DataTableFilter = {
  id: string;
  label: string;
  options: SelectOption[];
};

type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  title?: string;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  exportFileName?: string;
  isLoading?: boolean;
};

export function DataTable<T extends object>({
  data,
  columns,
  title,
  searchPlaceholder = 'Search table…',
  filters = [],
  exportFileName = 'export',
  isLoading = false,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filteredRows = table.getFilteredRowModel().rows;

  const exportRows = useMemo(() => {
    return filteredRows.map((row) => {
      const obj: Record<string, unknown> = {};
      row.getVisibleCells().forEach((cell) => {
        obj[cell.column.id] = cell.getValue();
      });
      return obj;
    });
  }, [filteredRows]);

  const headers = table.getVisibleLeafColumns().map((col) => col.id);

  function downloadCsv() {
    const csv = Papa.unparse({
      fields: headers,
      data: exportRows.map((row) => headers.map((h) => row[h] ?? '')),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title ?? 'Data export', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [headers],
      body: exportRows.map((row) => headers.map((h) => String(row[h] ?? ''))),
      styles: { fontSize: 8 },
    });
    doc.save(`${exportFileName}.pdf`);
  }

  return (
    <section className="grid gap-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.15fr)_minmax(200px,1fr)_auto] xl:items-center">
        <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-ink-soft shadow-soft">
          <Search size={16} className="shrink-0" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search table"
            className="w-full cursor-text border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filters.map((filter) => {
            const current = columnFilters.find((f) => f.id === filter.id)?.value;
            const selected = filter.options.find((opt) => opt.value === current) ?? null;

            return (
              <SearchableSelect
                key={filter.id}
                options={filter.options}
                placeholder={filter.label}
                isClearable
                value={selected}
                onChange={(opt) => {
                  const value = (opt as SelectOption | null)?.value;
                  setColumnFilters((prev) => {
                    const rest = prev.filter((f) => f.id !== filter.id);
                    if (!value) return rest;
                    return [...rest, { id: filter.id, value }];
                  });
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button variant="secondary" size="sm" leftIcon={<FileSpreadsheet size={15} />} onClick={downloadCsv}>
            CSV
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download size={15} />} onClick={downloadPdf}>
            PDF
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-line/80 bg-white/90 shadow-panel backdrop-blur-sm">
        <table className="min-w-[640px] w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="sticky top-0 cursor-pointer select-none border-b border-line bg-foam/90 px-4 py-3.5 text-left text-[0.72rem] font-bold uppercase tracking-[0.05em] text-ink-soft backdrop-blur-sm"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-ink-soft">
                  Loading rows…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-ink-soft">
                  No matching rows.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-brand/[0.04]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-b border-line/70 px-4 py-3.5 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
