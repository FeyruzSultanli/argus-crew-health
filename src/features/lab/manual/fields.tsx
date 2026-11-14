// Form building blocks for manual entry on the design system: number field with large − / + steppers, accepted
// range (<Value>, demo parameter), inline "How to measure" (<HowTo>), field error, 1–5 score scale, section.
import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../../ui/Button';
import { HowTo } from '../../../ui/HowTo';
import { Value } from '../../../ui/Value';
import { HOWTO, type HowToId } from './howto';
import { VALIDATION_SOURCE_ID, parseNumber } from './validation';

export const inputCls =
  'min-h-target w-28 rounded-control border border-border-strong bg-bg px-3 font-mono text-lg text-text ' +
  'aria-[invalid=true]:border-act focus-visible:outline-2 focus-visible:outline-brand';

export interface NumberFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  decimals: number;
  /** Stepper start when the field is empty (the low end of the valid range). */
  emptyStart: number;
  hint?: ReactNode;
  error?: string;
}

export function NumberField({ id, label, unit, value, onChange, step, decimals, emptyStart, hint, error }: NumberFieldProps) {
  const parsed = parseNumber(value);
  const valid = parsed !== null && !Number.isNaN(parsed);
  const bump = (dir: 1 | -1) => {
    const next = valid ? (parsed as number) + dir * step : emptyStart;
    onChange(next.toFixed(decimals));
  };
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label} <span className="text-text-2">({unit})</span>
      </label>
      <div className="flex items-center gap-2">
        <Button icon={Minus} iconOnly disabled={!valid} onClick={() => bump(-1)}>
          {`Decrease ${label}`}
        </Button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={inputCls}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button icon={Plus} iconOnly onClick={() => bump(1)}>
          {`Increase ${label}`}
        </Button>
      </div>
      {hint && (
        <div id={hintId} className="flex flex-wrap items-center gap-2 text-xs text-text-3">
          {hint}
        </div>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm font-medium text-act-fg">
      <span aria-hidden="true">✕ </span>
      {children}
    </p>
  );
}

/** "Accepted 60–260 mmHg" — the doc 06 §3 plausibility range in the unit shown, as a demo parameter. */
export function RangeHint({ lo, hi, unit, decimals = 0 }: { lo: number; hi: number; unit: string; decimals?: number }) {
  return (
    <>
      <span>Accepted</span>
      <Value
        value={hi}
        prefix={`${lo.toFixed(decimals)}–`}
        precision={decimals}
        unit={unit}
        convert={false}
        size="sm"
        sourceIds={[VALIDATION_SOURCE_ID]}
        title="Accepted input range (rejects impossible values)"
      />
    </>
  );
}

export function FieldHowTo({ id }: { id: HowToId }) {
  return <HowTo className="mt-3" defaultOpen={false} steps={[{ text: HOWTO[id], tag: 'demo wording' }]} />;
}

export function Section({ title, children, howTo }: { title: string; children: ReactNode; howTo?: HowToId }) {
  return (
    <fieldset className="rounded-card border border-border bg-surface-1 p-5">
      <legend className="px-1 text-base font-semibold text-text">{title}</legend>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
      {howTo && <FieldHowTo id={howTo} />}
    </fieldset>
  );
}

/** 1–5 score as native radios (arrow keys move, Space selects). */
export function ScoreScale({ name, labelledBy, value, onChange }: { name: string; labelledBy: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((v) => (
        <label key={v} className="relative cursor-pointer">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer absolute inset-0 m-0 opacity-0" />
          <span className="flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface-2 font-mono text-text-2 peer-checked:border-brand peer-checked:bg-bg peer-checked:font-semibold peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            {v}
          </span>
        </label>
      ))}
    </div>
  );
}
