import { useId } from 'react';
import type { ReactNode } from 'react';

import { cx } from './tone';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** On/off setting (role="switch"), whole row is the target. */
export function Switch({ checked, onChange, label, description, className }: SwitchProps) {
  const descId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? descId : undefined}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex min-h-target w-full items-center justify-between gap-3 rounded-control px-2 text-left hover:bg-surface-2',
        className,
      )}
    >
      <span className="flex flex-col">
        <span className="text-sm text-text">{label}</span>
        {description && (
          <span id={descId} className="text-xs text-text-2">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill border transition-colors duration-200 ease-out',
          checked ? 'border-brand bg-brand' : 'border-border-strong bg-surface-2',
        )}
      >
        <span
          className={cx(
            'absolute h-4 w-4 rounded-pill transition-transform duration-200 ease-out',
            checked ? 'translate-x-5 bg-brand-fg' : 'translate-x-1 bg-text-2',
          )}
        />
      </span>
    </button>
  );
}
