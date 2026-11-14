import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cx } from './tone';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Panel content; omit to render panels yourself (then pass `children`). */
  content?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Panel for the selected tab when tabs have no `content`. */
  children?: ReactNode;
  className?: string;
}

/** WAI-ARIA tabs: ←/→ move and select, Home/End jump (automatic activation). */
export function Tabs<T extends string>({ tabs, value, onChange, label, children, className }: TabsProps<T>) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === value),
  );
  const select = (i: number) => {
    const t = tabs[(i + tabs.length) % tabs.length];
    if (!t) return;
    onChange(t.id);
    refs.current[(i + tabs.length) % tabs.length]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') select(index + 1);
    else if (e.key === 'ArrowLeft') select(index - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(tabs.length - 1);
    else return;
    e.preventDefault();
  };
  const active = tabs[index];
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-border"
        onKeyDown={onKey}
      >
        {tabs.map((t, i) => {
          const selected = t.id === value;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={cx(
                '-mb-px inline-flex min-h-target min-w-target items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-200 ease-out',
                selected ? 'border-brand text-text' : 'border-transparent text-text-2 hover:text-text',
              )}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              {t.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${base}-panel-${active.id}`}
          aria-labelledby={`${base}-tab-${active.id}`}
          tabIndex={0}
          className="rounded-control"
        >
          {active.content ?? children}
        </div>
      )}
    </div>
  );
}
