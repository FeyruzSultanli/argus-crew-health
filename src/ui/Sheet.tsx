import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';

import { Button } from './Button';
import { cx } from './tone';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** 'right' = side sheet (default, 420 px), 'bottom' = bottom sheet. */
  side?: 'right' | 'bottom';
  /** Width class for side sheets. */
  widthClass?: string;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Modal sheet: focus moves in, Tab is trapped, Escape or the scrim closes, focus returns to the opener. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'right',
  widthClass = 'w-[420px]',
  footer,
  children,
}: SheetProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open]);

  const offscreen = side === 'right' ? { x: 32, opacity: 0 } : { y: 32, opacity: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <m.div
            className="absolute inset-0 bg-scrim"
            aria-hidden="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={offscreen}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={offscreen}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              'absolute flex flex-col border-border-strong bg-surface-1 shadow-overlay outline-none',
              side === 'right'
                ? cx('top-0 right-0 h-full max-w-full border-l', widthClass)
                : 'right-0 bottom-0 left-0 max-h-[85vh] rounded-t-card border-t',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0 pt-2">
                <h2 id={titleId} className="text-base font-semibold text-text">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-text-2">
                    {description}
                  </p>
                )}
              </div>
              <Button variant="ghost" icon={X} iconOnly onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
