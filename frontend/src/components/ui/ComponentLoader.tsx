import clsx from 'clsx';

type ComponentLoaderProps = {
  label?: string;
  rows?: number;
  compact?: boolean;
};

export function ComponentLoader({
  label = 'Loading content',
  rows = 4,
  compact = false,
}: ComponentLoaderProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-line/80 bg-white/90 shadow-soft',
        compact ? 'p-3.5' : 'p-5',
      )}
      aria-busy="true"
      aria-label={label}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        <div className="animate-sweep h-full w-2/5 bg-gradient-to-r from-transparent via-brand to-transparent" />
      </div>

      <div className="grid gap-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.4fr_0.7fr_1fr] gap-3">
            <span className="animate-shimmer block h-4 rounded-full bg-gradient-to-r from-foam via-white to-foam" />
            <span className="animate-shimmer block h-3.5 rounded-full bg-gradient-to-r from-foam via-white to-foam opacity-80" />
            <span className="animate-shimmer block h-3.5 rounded-full bg-gradient-to-r from-foam via-white to-foam" />
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm font-semibold text-ink-soft">{label}</p>
    </div>
  );
}
