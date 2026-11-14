// The subject's face_fluid_index history: a small SVG trend with the reference line at 1.00 and the list of scans
// (values through <Value>, "% vs reference"). Experimental, trend only.
import type { Observation } from '../../../domain/types';
import { Badge, Value } from '../../../ui';
import { percentVsReference } from '../../../measurement/face/fluidShiftIndex';

const MEASURED = ['SRC_MEDIAPIPE_FACE'];
const MAX_POINTS = 12;

function TrendSvg({ points }: { points: readonly Observation[] }) {
  const w = 320;
  const h = 80;
  const pad = 8;
  const vals = points.map((o) => o.value as number);
  const lo = Math.min(0.95, ...vals);
  const hi = Math.max(1.05, ...vals);
  const x = (i: number) => pad + (points.length > 1 ? (i / (points.length - 1)) * (w - pad * 2) : (w - pad * 2) / 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full max-w-md" role="img" aria-label={`Face fluid-shift index, last ${points.length} scans, dashed line = reference`}>
      <line x1={pad} x2={w - pad} y1={y(1)} y2={y(1)} stroke="var(--text-3)" strokeDasharray="6 5" />
      {points.length > 1 && <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} />}
      {vals.map((v, i) => (
        <circle key={points[i]?.id ?? i} cx={x(i)} cy={y(v)} r={4} fill="var(--brand)" />
      ))}
    </svg>
  );
}

export function FaceTrend({ history }: { history: readonly Observation[] }) {
  const pts = history.filter((o) => typeof o.value === 'number').slice(-MAX_POINTS);
  if (pts.length === 0) return null;
  return (
    <div className="mt-4" data-testid="fs-trend">
      <h3 className="text-sm font-semibold text-text">Your scans (trend)</h3>
      <TrendSvg points={pts} />
      <p className="flex flex-wrap items-center gap-1 text-xs text-text-3">
        Dashed line: the reference, <Value value={1} precision={2} sourceIds={MEASURED} size="sm" title="Reference index" />
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-sm">
        {[...pts].reverse().map((o) => {
          const v = o.value as number;
          const pct = percentVsReference(v);
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-2">
              <span className="text-text-2">Mission day {o.missionDay}</span>
              <Value value={v} precision={2} sourceIds={MEASURED} label={o.source.label} size="sm" title="Face fluid-shift index" />
              <Value value={pct} unit="%" prefix={pct > 0 ? '+' : ''} precision={0} sourceIds={MEASURED} size="sm" title="Difference vs reference" />
              <span className="text-text-3">vs reference</span>
              {o.components?.referenceScan === 1 && <Badge tone="info">Reference scan</Badge>}
              {o.quality.label === 'poor' && <Badge tone="watch">Poor quality</Badge>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
