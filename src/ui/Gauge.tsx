import type { ReactNode } from 'react';

import { TONE_VAR, cx } from './tone';
import type { Tone } from './tone';
import { Value } from './Value';

export interface GaugeThreshold {
  /** From this value upward the ring takes this tone (thresholds must come from the caller's sourced rules). */
  from: number;
  tone: Tone;
  label?: string;
}

export interface GaugeProps {
  value: number | null;
  min?: number;
  max: number;
  /** Caption under the ring, e.g. "CO₂ 1-h", "Career dose", "Readiness". */
  label: string;
  unit?: string;
  precision?: number;
  sourceIds: readonly string[];
  /** Fixed tone, or computed from thresholds (sorted ascending by `from`). Neutral when neither is given. */
  tone?: Tone;
  thresholds?: readonly GaugeThreshold[];
  /** Ring diameter in px. */
  size?: number;
  /** Extra line under the label (e.g. status word). Never colour alone: pass a StatusPill or text. */
  footer?: ReactNode;
  freshness?: string;
}

function toneFor(value: number, thresholds: readonly GaugeThreshold[]): Tone | undefined {
  let t: Tone | undefined;
  for (const th of [...thresholds].sort((a, b) => a.from - b.from)) if (value >= th.from) t = th.tone;
  return t;
}

/** Ring gauge for CO₂, dose %, readiness (doc 11 §4). 270° arc; the number in the middle goes through <Value>. */
export function Gauge({
  value,
  min = 0,
  max,
  label,
  unit,
  precision,
  sourceIds,
  tone,
  thresholds = [],
  size = 136,
  footer,
  freshness,
}: GaugeProps) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const frac = value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const activeTone = value === null ? undefined : (tone ?? toneFor(value, thresholds));
  const color = activeTone ? TONE_VAR[activeTone] : 'var(--text-2)';
  return (
    <figure className="inline-flex flex-col items-center gap-2" aria-label={label}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          className="rotate-[135deg]"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${arc * frac} ${c}`}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-250 ease-out"
          />
        </svg>
        <div className={cx('absolute inset-0 flex items-center justify-center')}>
          <Value
            value={value}
            unit={unit}
            precision={precision}
            sourceIds={sourceIds}
            size="lg"
            title={label}
          />
        </div>
      </div>
      <figcaption className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm text-text-2">{label}</span>
        {freshness && <span className="font-mono text-xs text-text-3">updated {freshness} ago</span>}
        {footer}
      </figcaption>
    </figure>
  );
}
