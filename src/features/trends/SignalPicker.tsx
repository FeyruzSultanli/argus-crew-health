// Signal picker: crew signals grouped by body system, each with today's StatusPill; toggles a chart on or off.
import { useId, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';

import type { Assessment, SignalId } from '../../domain/types';
import { Button } from '../../ui/Button';
import { StatusPill } from '../../ui/StatusPill';
import { cx } from '../../ui/tone';
import { pickerGroups } from './selection';

export interface SignalPickerProps {
  selected: readonly SignalId[];
  assessments?: readonly Assessment[];
  onToggle: (id: SignalId) => void;
  onReset: () => void;
}

const GROUPS = pickerGroups();

export function SignalPicker({ selected, assessments, onToggle, onReset }: SignalPickerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          icon={SlidersHorizontal}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          Signals ({selected.length})
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cx('transition-transform', open && 'rotate-180')}
          />
        </Button>
        {open && (
          <Button variant="ghost" onClick={onReset}>
            Default selection
          </Button>
        )}
      </div>
      {open && (
        <div
          id={panelId}
          className="grid gap-4 rounded-card border border-border bg-surface-1 p-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {GROUPS.map((g) => (
            <fieldset key={g.system} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-medium text-text-2">{g.label}</legend>
              {g.signals.map((s) => {
                const on = selected.includes(s.id);
                const verdict = assessments?.find((a) => a.signalId === s.id)?.verdict;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    data-testid={`pick-${s.id}`}
                    onClick={() => onToggle(s.id)}
                    className={cx(
                      'flex min-h-11 items-center justify-between gap-2 rounded-control border px-3 py-1.5 text-left text-sm',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                      on
                        ? 'border-brand bg-brand-bg text-text'
                        : 'border-border text-text-2 hover:bg-surface-2',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cx(
                          'inline-flex size-4 items-center justify-center rounded-[4px] border',
                          on ? 'border-brand bg-brand text-surface-1' : 'border-border-strong',
                        )}
                      >
                        {on && <Check size={12} />}
                      </span>
                      {s.label}
                    </span>
                    {verdict && <StatusPill verdict={verdict} size="sm" />}
                  </button>
                );
              })}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
