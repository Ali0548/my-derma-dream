import Select, { type GroupBase, type Props as SelectProps } from 'react-select';
import clsx from 'clsx';

export type SelectOption = {
  label: string;
  value: string;
};

type SearchableSelectProps = Omit<
  SelectProps<SelectOption, boolean, GroupBase<SelectOption>>,
  'classNamePrefix'
> & {
  label?: string;
  error?: string;
  hint?: string;
};

export function SearchableSelect({
  label,
  error,
  hint,
  className,
  ...props
}: SearchableSelectProps) {
  return (
    <label className={clsx('grid w-full gap-1.5', className)}>
      {label ? <span className="text-sm font-bold text-ink">{label}</span> : null}
      <Select
        classNamePrefix="lumora-select"
        className={error ? 'lumora-select--error' : undefined}
        {...props}
      />
      {error ? <span className="text-xs font-semibold text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}
