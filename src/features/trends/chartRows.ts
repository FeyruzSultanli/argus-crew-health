// Recharts rows for one Trends chart: tracks (and compare overlays) merged on the shared x index. Pure.
import type { Verdict } from '../../domain/types';
import type { ChartBand, ChartReferenceLine } from './chartTypes';
import type { TrendTrack } from './trendData';

/** Neutral strokes (colour means status only): track 0 solid, track 1 dashed; compare overlays thin dashes. */
export const trackStroke = (i: number): string => (i % 2 === 0 ? 'var(--text)' : 'var(--text-2)');
export const trackDash = (i: number): string | undefined => (i % 2 === 0 ? undefined : '6 3');
const OVERLAY_DASH = ['2 3', '8 3', '1 2', '5 2 1 2'] as const;
export const overlayDash = (k: number): string => OVERLAY_DASH[k % OVERLAY_DASH.length] ?? '2 3';

export interface OverlaySeries {
  key: string;
  label: string;
  points: ReadonlyArray<{ x: number; value: number }>;
}

export interface ChartRow {
  x: number;
  /** v<i>: value of track i; b<i>: [lo, hi] band; m<i>: measured flag; s<i>: personal state; o_<key>: overlay. */
  [k: string]: number | [number, number] | boolean | Verdict | undefined;
}

export function buildRows(
  tracks: readonly TrendTrack[],
  overlays: readonly OverlaySeries[] = [],
): ChartRow[] {
  const by = new Map<number, ChartRow>();
  const row = (x: number): ChartRow => {
    let r = by.get(x);
    if (!r) {
      r = { x };
      by.set(x, r);
    }
    return r;
  };
  tracks.forEach((t, i) => {
    for (const p of t.points) {
      const r = row(p.x);
      r[`v${i}`] = p.value;
      r[`m${i}`] = p.measured;
      if (p.state) r[`s${i}`] = p.state;
      if (t.band && p.lo !== undefined && p.hi !== undefined) r[`b${i}`] = [p.lo, p.hi];
    }
  });
  for (const o of overlays) for (const p of o.points) row(p.x)[`o_${o.key}`] = p.value;
  return [...by.values()].sort((a, b) => a.x - b.x);
}

/** A "nice" tick step (1, 2, 2.5, 5 × 10^k) giving about `count` intervals. */
export function niceStep(span: number, count = 4): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

export interface YScale {
  domain: [number, number];
  ticks: number[];
}

/** y-scale covering values, bands and reference lines with a little headroom, snapped to nice ticks. */
export function yScale(
  tracks: readonly TrendTrack[],
  extras: {
    bands?: ReadonlyArray<ChartBand | undefined>;
    lines?: readonly ChartReferenceLine[];
    overlays?: readonly OverlaySeries[];
    floorZero?: boolean;
  },
): YScale {
  const vals: number[] = [];
  for (const t of tracks)
    for (const p of t.points) {
      vals.push(p.value);
      if (t.band && p.lo !== undefined && p.hi !== undefined) vals.push(p.lo, p.hi);
    }
  for (const b of extras.bands ?? []) if (b) vals.push(b.lo, b.hi);
  for (const l of extras.lines ?? []) vals.push(l.y);
  for (const o of extras.overlays ?? []) for (const p of o.points) vals.push(p.value);
  if (vals.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let lo = extras.floorZero ? 0 : Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const step = niceStep(hi - lo);
  const a = Math.floor(lo / step + 1e-9) * step;
  const b = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [Number(a.toFixed(6)), Number(b.toFixed(6))], ticks };
}
