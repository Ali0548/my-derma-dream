import { useField } from 'formik';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
};

const inputClass =
  'w-full min-h-11 rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink shadow-soft transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20';

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
    <label className="grid gap-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      <input
        className={clsx(inputClass, showError && 'border-danger focus:border-danger focus:ring-danger/15', className)}
        {...field}
        {...props}
      />
      {showError ? <span className="text-xs font-semibold text-danger">{meta.error}</span> : null}
      {!showError && hint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
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
    <label className="grid gap-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      <textarea
        className={clsx(
          inputClass,
          'min-h-28 resize-y',
          showError && 'border-danger focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...field}
        {...props}
      />
      {showError ? <span className="text-xs font-semibold text-danger">{meta.error}</span> : null}
      {!showError && hint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}
