import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

type ModalSize = 'md' | 'lg' | 'xl';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: ModalSize;
  /** Optional footer pinned under the scrollable body */
  footer?: ReactNode;
  /** Fires after the exit animation finishes (safe place to clear form state). */
  onExited?: () => void;
};

const sizeClass: Record<ModalSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const EXIT_MS = 220;

/**
 * THE only modal. Animated backdrop + panel; portals to document.body.
 * Keep using this for every dialog — do not duplicate modal markup.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'lg',
  footer,
  onExited,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setMounted(true);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      if (wasOpen.current) {
        wasOpen.current = false;
        onExited?.();
      }
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, onExited]);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mounted, onClose]);

  useEffect(() => {
    if (!visible) return;
    panelRef.current?.focus();
  }, [visible]);

  if (!mounted || typeof document === 'undefined') return null;

  const onBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onBackdropClick}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-200 ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative z-[1] flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-panel outline-none transition duration-200 ease-out sm:rounded-3xl',
          sizeClass[size],
          visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-4 scale-[0.97] opacity-0 sm:translate-y-3',
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:bg-foam hover:text-ink"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <footer className="shrink-0 border-t border-line bg-mist/60 px-4 py-3 sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
