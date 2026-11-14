// Small presentational pieces of the camera-pulse flow, built on the design system (src/ui).
import { CircleCheck, CircleX, TriangleAlert, User } from 'lucide-react';

import type { Quality } from '../../../domain/types';
import { QUALITY_THRESHOLDS } from '../../../measurement/rppg/quality';
import { Badge, Value } from '../../../ui';
import { QUALITY_WORD } from './copy';
import { DEMO_QUALITY } from './sources';

export function SubjectChip({ name }: { name: string }) {
  return (
    <Badge tone="info" icon={User} className="h-8 text-sm">
      Measuring: <strong className="font-semibold">{name}</strong>
    </Badge>
  );
}

/** "Demo parameter" spelled out (the Value badge only shows it on hover / in the drawer). */
export function DemoParameterBadge() {
  return (
    <Badge tone="neutral" variant="outline" mono>
      Demo parameter
    </Badge>
  );
}

const PILL = {
  good: { tone: 'ok', icon: CircleCheck },
  fair: { tone: 'watch', icon: TriangleAlert },
  poor: { tone: 'act', icon: CircleX },
} as const;

/** Quality pill: word + icon + colour (never colour alone). */
export function QualityPill({ quality }: { quality: Quality }) {
  const { tone, icon } = PILL[quality.label];
  return (
    <Badge tone={tone} icon={icon} className="h-8 text-sm font-semibold">
      {QUALITY_WORD[quality.label]}
    </Badge>
  );
}

/** Polyline of values in [-1, 1] (pulse waveform) or [0, 1] (spectrum). */
export function Trace({
  values,
  height = 64,
  label,
  zeroBased = false,
}: {
  values: number[];
  height?: number;
  label: string;
  zeroBased?: boolean;
}) {
  const w = 300;
  const base = zeroBased ? height - 2 : height / 2;
  const pts = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * w : 0;
      const y = zeroBased ? height - v * (height - 4) - 2 : height / 2 - v * (height / 2 - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-16 w-full">
      <line x1="0" x2={w} y1={base} y2={base} stroke="var(--border)" />
      {values.length > 1 && (
        <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/** ROI luminance meter, 0–255, with the good band of doc 09 §1.3 marked (demo parameter). */
export function LightingMeter({ lum, clip }: { lum: number | null; clip: number | null }) {
  const { good, fair } = QUALITY_THRESHOLDS.lighting;
  const c = clip ?? 0;
  const word =
    lum === null
      ? 'Waiting for face'
      : lum < fair.lo
        ? 'Too dark'
        : lum < good.lo
          ? 'A bit dark'
          : lum > fair.hi || c >= fair.clipBelow
            ? 'Too bright'
            : lum > good.hi || c >= good.clipBelow
              ? 'A bit bright'
              : 'Light OK';
  const pct = (v: number) => `${(v / 255) * 100}%`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-text-2">Lighting</span>
        <span className="font-semibold text-text">{word}</span>
      </div>
      <div className="relative mt-1 h-3 rounded-pill bg-surface-2" aria-hidden="true">
        <div
          className="absolute inset-y-0 rounded-pill bg-ok-bg"
          style={{ left: pct(good.lo), width: pct(good.hi - good.lo) }}
        />
        {lum !== null && (
          <div className="absolute -top-0.5 h-4 w-1 rounded bg-text" style={{ left: `calc(${pct(lum)} - 2px)` }} />
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-text-3">
        Good band: ROI luminance <Value value={good.lo} sourceIds={DEMO_QUALITY} size="sm" title="Lighting, good band low" />
        to <Value value={good.hi} sourceIds={DEMO_QUALITY} size="sm" title="Lighting, good band high" /> (8-bit scale)
      </p>
    </div>
  );
}
