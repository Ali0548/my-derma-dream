import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-[0_10px_24px_rgba(26,168,184,0.28)] hover:bg-brand-deep hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-white text-ink border border-line hover:border-brand/35 hover:bg-foam shadow-soft',
  ghost: 'bg-transparent text-ink-soft hover:bg-foam hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95 shadow-soft',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3.5 text-sm',
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-12 px-6 text-base',
};

const spinnerSize: Record<ButtonSize, number> = {
  sm: 18,
  md: 22,
  lg: 24,
};

/**
 * THE only button. Loading state always uses shared `Spinner`.
 * Forms must use FormSubmitButton → this Button (never a custom spinner).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const showLightSpinner = variant === 'primary' || variant === 'danger';

  return (
    <button
      type={type}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent font-bold transition duration-150 disabled:cursor-not-allowed disabled:opacity-65',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <Spinner size={spinnerSize[size]} light={showLightSpinner} /> : leftIcon}
      <span className={clsx('leading-none', loading && 'opacity-90')}>{children}</span>
      {!loading && rightIcon}
    </button>
  );
}
