// GOES integral-proton parsing (doc 10 §1) [SRC_NOAA_SWPC_PROTONS · verified].
// NOAA SWPC JSON rows look like { time_tag, satellite, flux, energy }. Tolerates missing / negative / non-numeric
// fluxes (kept only when flux > 0), duplicate satellites and out-of-order times. Pure: no fetch, no DOM.
import type { ProtonSample } from '../types';

export const E10 = '>=10 MeV';
export const E100 = '>=100 MeV';

export interface ProtonChannels {
  protons10: ProtonSample[];
  protons100: ProtonSample[];
}

/** NOAA time tags come as "2026-11-14T08:40:00Z" (sometimes without the Z): normalise to ISO-8601 UTC. */
export function normaliseTimeTag(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toSample(row: unknown): ProtonSample | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const flux = typeof r.flux === 'number' ? r.flux : typeof r.flux === 'string' ? Number(r.flux) : NaN;
  if (!Number.isFinite(flux) || flux <= 0) return null;
  if (typeof r.energy !== 'string' || typeof r.time_tag !== 'string') return null;
  const timeTag = normaliseTimeTag(r.time_tag);
  if (!timeTag) return null;
  const s: ProtonSample = { timeTag, energy: r.energy.trim(), fluxPfu: flux };
  if (typeof r.satellite === 'number' && Number.isFinite(r.satellite)) s.satellite = r.satellite;
  return s;
}

/**
 * One sample per (time, energy), oldest first. When several satellites report the same time and energy the
 * satellite that contributes most rows to the file (the primary) wins; ties keep the first row seen.
 */
export function dedupeSamples(samples: readonly ProtonSample[]): ProtonSample[] {
  const count = new Map<number | undefined, number>();
  for (const s of samples) count.set(s.satellite, (count.get(s.satellite) ?? 0) + 1);
  const best = new Map<string, ProtonSample>();
  for (const s of samples) {
    const key = `${s.timeTag}|${s.energy}`;
    const prev = best.get(key);
    if (!prev || (count.get(s.satellite) ?? 0) > (count.get(prev.satellite) ?? 0)) best.set(key, s);
  }
  return [...best.values()].sort(
    (a, b) => a.timeTag.localeCompare(b.timeTag) || a.energy.localeCompare(b.energy),
  );
}

/** Raw NOAA JSON (any shape) → the ≥10 MeV and ≥100 MeV channels, cleaned. Non-arrays give empty channels. */
export function parseGoesProtons(raw: unknown): ProtonChannels {
  const rows = Array.isArray(raw) ? raw : [];
  const all = dedupeSamples(rows.map(toSample).filter((s): s is ProtonSample => s !== null));
  return {
    protons10: all.filter((s) => s.energy === E10),
    protons100: all.filter((s) => s.energy === E100),
  };
}

/**
 * Union of two sample lists of one channel (newer list wins on the same time tag), oldest first, trimmed to
 * samples at or after `sinceIso` when given.
 */
export function mergeSamples(
  older: readonly ProtonSample[],
  newer: readonly ProtonSample[],
  sinceIso?: string,
): ProtonSample[] {
  const byTime = new Map<string, ProtonSample>();
  for (const s of older) byTime.set(s.timeTag, s);
  for (const s of newer) byTime.set(s.timeTag, s);
  return [...byTime.values()]
    .filter((s) => sinceIso === undefined || s.timeTag >= sinceIso)
    .sort((a, b) => a.timeTag.localeCompare(b.timeTag));
}
