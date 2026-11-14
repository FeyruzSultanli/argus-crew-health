import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cx } from './tone';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Hide the label visually (icon-only); it stays the accessible name. */
  iconOnly?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Layer lens". */
  label: string;
  className?: string;
}

/** Single choice from 2–5 options, e.g. layer lens Combined | Personal | Space | Earth. Radio-group semantics. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    const o = options[n];
    if (!o) return;
    onChange(o.value);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(index - 1);
    else return;
    e.preventDefault();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cx('inline-flex rounded-control border border-border bg-surface-2 p-0.5', className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            title={o.iconOnly ? o.label : undefined}
            className={cx(
              'inline-flex min-h-target min-w-target items-center justify-center gap-1.5 rounded-[6px] px-3 text-sm font-medium transition-colors duration-200 ease-out',
              checked
                ? 'bg-surface-1 text-text shadow-[inset_0_0_0_1px_var(--border-strong)]'
                : 'text-text-2 hover:text-text',
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {o.iconOnly ? <span className="sr-only">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}
