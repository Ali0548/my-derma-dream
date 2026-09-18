import { useField } from 'formik';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
};

const inputClass =
  'box-border h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink shadow-soft transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20';

function FieldMeta({ error, hint }: { error?: string; hint?: string }) {
  return (
    <span className="min-h-4 text-xs font-semibold leading-snug">
      {error ? <span className="text-danger">{error}</span> : null}
      {!error && hint ? <span className="font-normal text-ink-soft">{hint}</span> : null}
      {!error && !hint ? <span className="invisible">.</span> : null}
    </span>
  );
}

export function TextField({
  name,
  label,
  hint,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const [field, meta] = useField(name);
  const showError = Boolean(meta.touched && meta.error);

  return (
    <label className="grid content-start gap-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      <input
        className={clsx(
          inputClass,
          props.type === 'date' && 'appearance-none pr-3 leading-none',
          showError && 'border-danger focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...field}
        {...props}
      />
      <FieldMeta error={showError ? meta.error : undefined} hint={hint} />
    </label>
  );
}

export function TextArea({
  name,
  label,
  hint,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [field, meta] = useField(name);
  const showError = Boolean(meta.touched && meta.error);

  return (
    <label className="grid content-start gap-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      <textarea
        className={clsx(
          'box-border min-h-28 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink shadow-soft transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20',
          showError && 'border-danger focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...field}
        {...props}
      />
      <FieldMeta error={showError ? meta.error : undefined} hint={hint} />
    </label>
  );
}
