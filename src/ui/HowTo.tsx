import { useId, useState } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cx } from './tone';

export interface HowToStep {
  text: string;
  icon?: LucideIcon;
  /** Provenance of the wording (docs/PROJECT_RULES.md rule 3). */
  tag?: 'source' | 'demo wording';
}

export interface HowToProps {
  title?: string;
  steps: readonly HowToStep[];
  /** Collapsible (default true). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

/** Numbered step list with icons; collapsible (doc 11 §4). Step texts come from the docs only. */
export function HowTo({
  title = 'How to measure',
  steps,
  collapsible = true,
  defaultOpen = true,
  className,
}: HowToProps) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  const isOpen = !collapsible || open;
  return (
    <div className={cx('rounded-control border border-border bg-surface-2', className)}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-target w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium text-text"
        >
          {title}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cx('text-text-3 transition-transform duration-200 ease-out', open && 'rotate-180')}
          />
        </button>
      ) : (
        <p className="flex min-h-target items-center px-3 text-sm font-medium text-text">{title}</p>
      )}
      {isOpen && (
        <ol id={listId} className="flex flex-col gap-2 px-3 pb-3">
          {steps.map((s, i) => {
            const Icon = s.icon ?? Circle;
            return (
              <li key={s.text} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-border-strong font-mono text-xs text-text-2">
                  {i + 1}
                </span>
                <Icon size={16} aria-hidden="true" className="mt-1 shrink-0 text-text-3" />
                <span className="flex-1 text-sm text-text">{s.text}</span>
                {s.tag && (
                  <span className="mt-0.5 rounded-[4px] border border-border-strong px-1 font-mono text-[10px] leading-4 text-text-2">
                    {s.tag}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
