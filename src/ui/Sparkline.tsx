import type { Verdict } from '../domain/types';
import { TONE_VAR, VERDICT } from './tone';

export interface SparklinePoint {
  missionDay: number;
  value: number;
  /** Personal band (ref ± 2σ, doc 08 §6). */
  lo?: number;
  hi?: number;
  state?: Verdict;
}

export interface SparklineProps {
  points: readonly SparklinePoint[];
  /** Spoken summary, e.g. "Resting heart rate, last 17 days, rising above your band". */
  ariaLabel: string;
  width?: number;
  height?: number;
}

/** Tiny SVG trend with the personal band; the last point is coloured by its verdict. No axes, no Recharts. */
export function Sparkline({ points, ariaLabel, width = 112, height = 32 }: SparklineProps) {
  if (points.length === 0) {
    return <svg width={width} height={height} role="img" aria-label={`${ariaLabel}: no data`} />;
  }
  const values = points.flatMap((p) => [p.value, p.lo ?? p.value, p.hi ?? p.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const first = points[0]?.missionDay ?? 0;
  const last = points[points.length - 1]?.missionDay ?? 1;
  const x = (d: number) => pad + ((d - first) / (last - first || 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.missionDay).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join('');
  const banded = points.filter((p) => p.lo !== undefined && p.hi !== undefined);
  const band =
    banded.length > 1
      ? `M${banded.map((p) => `${x(p.missionDay).toFixed(1)},${y(p.hi ?? 0).toFixed(1)}`).join('L')}L${[
          ...banded,
        ]
          .reverse()
          .map((p) => `${x(p.missionDay).toFixed(1)},${y(p.lo ?? 0).toFixed(1)}`)
          .join('L')}Z`
      : null;
  const end = points[points.length - 1];
  const endTone = end?.state ? TONE_VAR[VERDICT[end.state].tone] : 'var(--text-2)';
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      {band && <path d={band} fill="var(--text-3)" fillOpacity={0.16} />}
      <path
        d={line}
        fill="none"
        stroke="var(--text-2)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {end && <circle cx={x(end.missionDay)} cy={y(end.value)} r={3} fill={endTone} />}
    </svg>
  );
}
