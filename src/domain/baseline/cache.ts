// Content-addressed memo for the personal series. The key is a fingerprint of everything the engine reads
// (observation ids, days, times, values, components, the context and method fields it filters on) plus the
// signal definition object, the mission profile and the accepted days — so the cache never changes a result, it
// only avoids recomputing it. Same array object → the fingerprint itself is reused (treat arrays as immutable).
import type { MissionProfile, Observation, SignalDef } from '../types';
import type { PersonalSeriesOptions, PersonalSeriesResult } from './personal';

const MAX_ENTRIES = 512;

const defIds = new WeakMap<SignalDef, number>();
let nextDefId = 1;
const arrayPrints = new WeakMap<readonly Observation[], { n: number; print: string }>();
const entries = new Map<string, PersonalSeriesResult>();
const stats = { hits: 0, misses: 0 };

function defId(def: SignalDef): number {
  let id = defIds.get(def);
  if (id === undefined) {
    id = nextDefId;
    nextDefId += 1;
    defIds.set(def, id);
  }
  return id;
}

/** Two independent 32-bit FNV-1a hashes over the fields the engine reads, plus the count. */
export function fingerprint(observations: readonly Observation[]): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
    }
    a = Math.imul(a ^ 0x1f, 0x01000193);
    b = Math.imul(b ^ 0x1f, 0x01000193);
  };
  for (const o of observations) {
    mix(o.id);
    mix(o.signalId);
    mix(String(o.missionDay));
    mix(o.effectiveAt);
    mix(String(o.value));
    if (o.components !== undefined)
      for (const k of Object.keys(o.components).sort()) mix(`${k}=${String(o.components[k])}`);
    mix(o.context?.glucose ?? '');
    mix(o.context?.eye ?? '');
    mix(o.source.method ?? '');
  }
  return `${observations.length}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`;
}

function printOf(observations: readonly Observation[]): string {
  const seen = arrayPrints.get(observations);
  if (seen !== undefined && seen.n === observations.length) return seen.print;
  const print = fingerprint(observations);
  arrayPrints.set(observations, { n: observations.length, print });
  return print;
}

export function cachedSeries(
  def: SignalDef,
  observations: readonly Observation[],
  profile: MissionProfile,
  accepted: readonly number[] | undefined,
  compute: (
    def: SignalDef,
    observations: readonly Observation[],
    opts: PersonalSeriesOptions,
  ) => PersonalSeriesResult,
): PersonalSeriesResult {
  const acc = accepted === undefined ? '' : [...accepted].sort((x, y) => x - y).join(',');
  const key = `${defId(def)}|${profile.id}|${profile.gravityG}|${acc}|${printOf(observations)}`;
  const hit = entries.get(key);
  if (hit !== undefined) {
    stats.hits += 1;
    entries.delete(key);
    entries.set(key, hit); // LRU: most recent last
    return hit;
  }
  stats.misses += 1;
  const opts: PersonalSeriesOptions = { upToDay: Number.POSITIVE_INFINITY, profile };
  if (accepted !== undefined) opts.accepted = accepted;
  const value = compute(def, observations, opts);
  entries.set(key, value);
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  return value;
}

/** Empties the memo (tests, or when memory matters). */
export function clearPersonalCache(): void {
  entries.clear();
  stats.hits = 0;
  stats.misses = 0;
}

export function personalCacheStats(): { size: number; hits: number; misses: number } {
  return { size: entries.size, hits: stats.hits, misses: stats.misses };
}
