// Chart rows for the proton flux chart: ≥10 / ≥100 MeV matched by time, windowed and peak-preserving downsampled.
import type { ProtonSample } from '../../domain/types';

export type FluxRange = '6h' | '1d' | '3d' | '7d';
export const RANGE_MS: Record<FluxRange, number> = {
  '6h': 6 * 3_600_000,
  '1d': 24 * 3_600_000,
  '3d': 3 * 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
};

export interface FluxRow {
  t: number;
  f10: number | null;
  f100: number | null;
}

/** Rows within [fromMs, toMs], at most `maxRows` (bucket maximum per channel keeps event peaks visible). */
export function fluxRows(
  p10: readonly ProtonSample[],
  p100: readonly ProtonSample[],
  fromMs: number,
  toMs: number,
  maxRows = 480,
): FluxRow[] {
  const byT = new Map<number, FluxRow>();
  const put = (s: ProtonSample, key: 'f10' | 'f100') => {
    const t = Date.parse(s.timeTag);
    if (t < fromMs || t > toMs) return;
    const row = byT.get(t) ?? { t, f10: null, f100: null };
    row[key] = s.fluxPfu;
    byT.set(t, row);
  };
  for (const s of p10) put(s, 'f10');
  for (const s of p100) put(s, 'f100');
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  if (rows.length <= maxRows) return rows;
  const size = Math.ceil(rows.length / maxRows);
  const out: FluxRow[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const max = (k: 'f10' | 'f100') => {
      const v = chunk.map((r) => r[k]).filter((x): x is number => x !== null);
      return v.length ? Math.max(...v) : null;
    };
    out.push({ t: (chunk[chunk.length - 1] as FluxRow).t, f10: max('f10'), f100: max('f100') });
  }
  return out;
}

/** Lower edge of the log axis: the decade below the smallest flux, at least 0.01 pfu. */
export function logFloor(rows: readonly FluxRow[]): number {
  let min = Infinity;
  for (const r of rows) for (const v of [r.f10, r.f100]) if (v !== null && v > 0) min = Math.min(min, v);
  if (!Number.isFinite(min)) return 0.1;
  return Math.max(0.01, 10 ** Math.floor(Math.log10(min)));
}
