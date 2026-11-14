// SPE replay timeline maths (doc 10 §8). Pure: the replay engine (src/services/replay.ts) owns the clock.
// The bundled seed/radiation/spe-replay.json holds the synthetic S2-class profile of doc 10 §8 when no real event was
// captured (`synthetic: true`); its numbers are demo parameters [SRC_DEMO_RADIATION_MODEL].
import type { ProtonSample } from '../types';
import { parseGoesProtons } from './protons';
import { speTimeline, type SpeTimeline } from './speDose';

export const REPLAY_SPEEDS = [60, 600, 3600] as const;
export type ReplaySpeed = number;
export const DEFAULT_REPLAY_SPEED = 600;
export const SYNTHETIC_REPLAY_WORDS = 'synthetic S2-class profile (demo), not a recorded event';

export interface ReplayProfile {
  id: string;
  synthetic: boolean;
  /** Label shown with the REPLAY badge. */
  label: string;
  source: string;
  sourceIds: string[];
  startMs: number;
  endMs: number;
  protons10: ProtonSample[];
  protons100: ProtonSample[];
  timeline: SpeTimeline;
}

/** Parse the spe-replay.json shape `{ synthetic, label, source, sourceIds, data: NOAA rows }`. */
export function buildReplayProfile(raw: unknown): ReplayProfile {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const { protons10, protons100 } = parseGoesProtons(r.data);
  if (protons10.length === 0) throw new Error('spe-replay.json: no >=10 MeV samples');
  const synthetic = r.synthetic === true;
  // A non-synthetic file is a captured NOAA window; it keeps its own label ("NOAA SWPC GOES, captured <date>").
  const label = synthetic
    ? `REPLAY — ${SYNTHETIC_REPLAY_WORDS}`
    : `REPLAY — ${typeof r.label === 'string' ? r.label : 'recorded NOAA GOES window'}`;
  const sourceIds = Array.isArray(r.sourceIds)
    ? r.sourceIds.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: synthetic ? 'spe-synthetic-s2' : 'spe-captured',
    synthetic,
    label,
    source: typeof r.source === 'string' ? r.source : '',
    sourceIds: sourceIds.length > 0 ? sourceIds : ['SRC_DEMO_RADIATION_MODEL'],
    startMs: Date.parse((protons10[0] as ProtonSample).timeTag),
    endMs: Date.parse((protons10[protons10.length - 1] as ProtonSample).timeTag),
    protons10,
    protons100,
    timeline: speTimeline(protons10, protons100),
  };
}

/** Event time (ms since the profile start) after `realElapsedMs` of playback at `speed`×. */
export function eventElapsedMs(realElapsedMs: number, speed: ReplaySpeed): number {
  return Math.max(0, realElapsedMs) * speed;
}

/** Index of the last ≥10 MeV sample at or before `eventMs` after the start (0 at the start). */
export function replayIndexAt(p: ReplayProfile, eventMs: number): number {
  const t = p.startMs + eventMs;
  let lo = 0;
  let hi = p.protons10.length - 1;
  if (Date.parse((p.protons10[hi] as ProtonSample).timeTag) <= t) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Date.parse((p.protons10[mid] as ProtonSample).timeTag) <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The ≥100 MeV samples up to (and including) the time tag of ≥10 MeV sample `index`. */
export function protons100UpTo(p: ReplayProfile, index: number): ProtonSample[] {
  const tag = p.protons10[index]?.timeTag;
  if (tag === undefined) return [];
  return p.protons100.filter((s) => s.timeTag <= tag);
}

/** Real playback time (ms) for the whole profile at `speed`×. */
export function replayDurationMs(p: ReplayProfile, speed: ReplaySpeed): number {
  return (p.endMs - p.startMs) / speed;
}
