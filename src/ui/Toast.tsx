import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';

import { ToastContext } from './toastContext';
import type { ToastApi, ToastInput } from './toastContext';
import { TONE, cx } from './tone';

interface ToastItem extends ToastInput {
  id: number;
}

export interface ToastProps {
  toast: ToastInput;
  onDismiss: () => void;
}

/** One toast: status-coloured left border, title, optional body, dismiss button. */
export function Toast({ toast, onDismiss }: ToastProps) {
  const t = TONE[toast.tone ?? 'muted'];
  return (
    <div
      className={cx(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-control border border-l-4 border-border-strong bg-surface-2 py-2 pr-1 pl-4 shadow-overlay',
        t.accent,
      )}
    >
      <div className="min-w-0 flex-1 py-1.5">
        <p className="text-sm font-medium text-text">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-sm text-text-2">{toast.body}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-target w-target shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-1 hover:text-text"
      >
        <X size={16} aria-hidden="true" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

/** Toast region (bottom-right, polite live region) + `useToast()` for everything below it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), t.durationMs ?? 4000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-20 z-[60] flex flex-col items-end gap-2"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <m.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Toast toast={item} onDismiss={() => dismiss(item.id)} />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
