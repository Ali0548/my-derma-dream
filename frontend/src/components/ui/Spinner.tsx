import clsx from 'clsx';
import { useId } from 'react';

type SpinnerProps = {
  size?: number;
  label?: string;
  /** White arc for brand/danger buttons. */
  light?: boolean;
  className?: string;
};

/**
 * Single shared Play Store / Samsung-style spinner.
 * Animations are inline so they never fall back to a plain CSS border spinner.
 */
export function Spinner({ size = 22, label = 'Loading', light = false, className }: SpinnerProps) {
  const reactId = useId().replace(/:/g, '');
  const gradId = `spin-grad-${reactId}`;
  const spinName = `spin-rot-${reactId}`;
  const dashName = `spin-dash-${reactId}`;
  const stroke = Math.max(3.5, size * 0.12);

  const track = light ? 'rgba(255,255,255,0.28)' : 'rgba(26,168,184,0.22)';
  const c1 = light ? '#ffffff' : '#1AA8B8';
  const c2 = light ? 'rgba(255,255,255,0.35)' : '#5DCFB0';

  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <style>{`
        @keyframes ${spinName} {
          to { transform: rotate(360deg); }
        }
        @keyframes ${dashName} {
          0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 50 50"
        fill="none"
        aria-hidden
        style={{ animation: `${spinName} 0.85s linear infinite` }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle cx="25" cy="25" r="20" stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          style={{ animation: `${dashName} 1.35s ease-in-out infinite` }}
        />
      </svg>
    </span>
  );
}
