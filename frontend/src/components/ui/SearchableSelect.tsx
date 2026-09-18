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
  menuPortalTarget,
  styles,
  ...props
}: SearchableSelectProps) {
  return (
    <label className={clsx('grid w-full content-start gap-1.5', className)}>
      {label ? <span className="text-sm font-bold text-ink">{label}</span> : <span className="h-5" />}
      <Select
        classNamePrefix="lumora-select"
        className={error ? 'lumora-select--error' : undefined}
        menuPortalTarget={menuPortalTarget ?? (typeof document !== 'undefined' ? document.body : null)}
        menuPosition="fixed"
        styles={{
          ...styles,
          control: (base, state) => ({
            ...base,
            ...(typeof styles?.control === 'function' ? styles.control(base, state) : styles?.control),
            minHeight: 44,
            height: 44,
          }),
          valueContainer: (base) => ({ ...base, height: 42, paddingTop: 0, paddingBottom: 0 }),
          indicatorsContainer: (base) => ({ ...base, height: 42 }),
          menuPortal: (base) => ({ ...base, zIndex: 90 }),
        }}
        {...props}
      />
      <span className="min-h-4 text-xs font-semibold leading-snug">
        {error ? <span className="text-danger">{error}</span> : null}
        {!error && hint ? <span className="font-normal text-ink-soft">{hint}</span> : null}
        {!error && !hint ? <span className="invisible">.</span> : null}
      </span>
    </label>
  );
}
