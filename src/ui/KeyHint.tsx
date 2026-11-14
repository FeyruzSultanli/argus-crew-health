import { Fragment } from 'react';

import { cx } from './tone';

export interface KeyHintProps {
  /** Keys of one shortcut, e.g. ['Shift', '←']. */
  keys: string[];
  /** What the shortcut does, e.g. "Back one week". */
  label?: string;
  className?: string;
}

/** Keyboard shortcut chips, for tooltips and help rows (doc 11 §4). */
export function KeyHint({ keys, label, className }: KeyHintProps) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs text-text-2', className)}>
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k, i) => (
          <Fragment key={k + i}>
            {i > 0 && <span aria-hidden="true">+</span>}
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-mono text-[11px] text-text">
              {k}
            </kbd>
          </Fragment>
        ))}
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
