import { Clock } from 'lucide-react';

import { useUiStore } from '../state/ui';
import { SourceBadge } from './SourceBadge';
import type { DataLabel } from './SourceBadge';
import { TONE, cx } from './tone';
import type { Tone } from './tone';
import { formatNumber, toDisplayUnit, unitSymbol } from './units';

export interface ValueProps {
  /** Canonical value (UCUM unit); null renders "—" (no data). */
  value: number | null;
  /** UCUM code (e.g. '/min', 'mm[Hg]', 'Cel') or a plain display unit. */
  unit?: string;
  /** Decimal places; default: integers as is, otherwise 1. */
  precision?: number;
  /** seed/sources.json ids behind this number. Required — a number without a source shows as a demo parameter. */
  sourceIds: readonly string[];
  /** Age of the reading, e.g. "3 h". */
  freshness?: string;
  /** Data origin tag. */
  label?: DataLabel;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** What this number is, for the tooltip and drawer, e.g. "Resting heart rate". */
  title?: string;
  /** false inside other interactive controls: static badge, no drawer. */
  interactive?: boolean;
  /** Apply the user's °C/°F and mg/dL/mmol/L preference (default true). */
  convert?: boolean;
  /** Colour the number by status. Neutral by default (colour means status only). */
  tone?: Tone;
  /** Prefix such as "≥" or "+". */
  prefix?: string;
  className?: string;
}

const SIZE: Record<NonNullable<ValueProps['size']>, { num: string; unit: string }> = {
  sm: { num: 'text-sm', unit: 'text-xs' },
  md: { num: 'text-base', unit: 'text-xs' },
  lg: { num: 'text-2xl leading-[1.1]', unit: 'text-sm' },
  xl: { num: 'text-5xl leading-[1.1]', unit: 'text-base' },
};

const LABEL_CLASS: Record<DataLabel, string> = {
  SIMULATED: 'border-dashed border-border-strong text-text-2',
  MEASURED: 'border-brand text-brand',
  LIVE: 'border-brand text-brand',
  REPLAY: 'border-info-border text-info-fg',
};

/** Every user-visible number: value + unit + source badge + freshness + data label (doc 11 §4, docs/PROJECT_RULES.md §4). */
export function Value({
  value,
  unit,
  precision,
  sourceIds,
  freshness,
  label,
  size = 'md',
  title,
  interactive = true,
  convert = true,
  tone,
  prefix,
  className,
}: ValueProps) {
  const prefs = useUiStore((s) => s.units);
  const shown = value === null ? null : convert ? toDisplayUnit(value, unit, prefs) : { value, unit };
  const sym = unitSymbol(shown?.unit ?? unit);
  const s = SIZE[size];
  return (
    <span
      className={cx('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 align-middle', className)}
      data-value=""
    >
      <span className={cx('inline-flex items-baseline gap-1', tone ? TONE[tone].text : 'text-text')}>
        {prefix && <span className={cx('font-mono', s.unit)}>{prefix}</span>}
        <span className={cx('font-mono font-medium tabular-nums', s.num)}>
          {shown === null ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">no data</span>
            </>
          ) : (
            formatNumber(shown.value, precision)
          )}
        </span>
        {sym && shown !== null && <span className={cx('font-mono text-text-2', s.unit)}>{sym}</span>}
      </span>
      <SourceBadge
        sourceIds={sourceIds}
        title={title}
        freshness={freshness}
        label={label}
        interactive={interactive}
      />
      {freshness && (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-text-3">
          <Clock size={12} aria-hidden="true" />
          <span className="sr-only">updated </span>
          {freshness}
          <span className="sr-only"> ago</span>
        </span>
      )}
      {label && (
        <span
          className={cx(
            'rounded-[4px] border px-1 font-mono text-[10px] leading-4 tracking-wider',
            LABEL_CLASS[label],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
