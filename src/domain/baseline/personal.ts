// The personal layer (doc 08): series for charts and the per-day PersonalResult for assessSignal().
import type {
  MissionProfile,
  Observation,
  PersonalParams,
  PersonalResult,
  SignalDef,
  SignalId,
  Verdict,
} from '../types';
import type { Eye } from './aggregate';
import { tracksFor } from './aggregate';
import { cachedSeries } from './cache';
import type { PersonalDay } from './engine';
import { runTrack } from './engine';
import type { PreflightBaseline } from './reference';
import { personalFromSeries } from './result';
import { ENGINE_SEVERITY } from './stateMachine';

export { personalFromSeries };

export type SeriesPoint = PersonalResult['series'][number];

export interface PersonalTrackSeries {
  key: string;
  label: string;
  component?: string;
  eye?: Eye;
  params: PersonalParams;
  preflight: PreflightBaseline | null;
  nPreflight: number;
  /** Per reading day: z, cusum, drift, ref, sigma, referenceKind … (debug drawer). */
  days: PersonalDay[];
  /** Chart band per reading day: lo/hi = ref.m ∓ 2·ref.σ. */
  series: SeriesPoint[];
}

export interface PersonalSeriesResult {
  signalId: SignalId;
  enabled: boolean;
  upToDay: number;
  tracks: PersonalTrackSeries[];
  /**
   * One series for the signal: per reading day the entry of the first track (param / eye order) that has a reading
   * that day, with state = worst state of all tracks that day. Use `tracks[i].series` to chart blood pressure.
   */
  series: SeriesPoint[];
  /** Quality notes, e.g. "thin baseline" (doc 08 §2.1). */
  notes: string[];
}

export interface PersonalSeriesOptions {
  upToDay: number;
  profile: MissionProfile;
  /** Days on which the CMO tapped "Accept as new normal" (FR-BAS-7). */
  accepted?: readonly number[];
}

const point = (d: PersonalDay): SeriesPoint => ({
  missionDay: d.missionDay,
  value: d.value,
  lo: d.lo,
  hi: d.hi,
  state: d.state,
});

/** Runs the engine day by day for every judged series of the signal. Pure; not memoised. */
export function computePersonalSeries(
  def: SignalDef,
  observations: readonly Observation[],
  opts: PersonalSeriesOptions,
): PersonalSeriesResult {
  const tracks: PersonalTrackSeries[] = tracksFor(def, observations).map((spec) => {
    const run = runTrack(def, spec, observations, opts);
    const t: PersonalTrackSeries = {
      key: spec.key,
      label: spec.label,
      params: spec.params,
      preflight: run.preflight,
      nPreflight: run.nPreflight,
      days: run.days,
      series: run.days.map(point),
    };
    if (spec.component !== undefined) t.component = spec.component;
    if (spec.eye !== undefined) t.eye = spec.eye;
    return t;
  });
  const byDay = new Map<number, SeriesPoint>();
  for (const t of tracks) {
    for (const p of t.series) {
      const seen = byDay.get(p.missionDay);
      if (seen === undefined) byDay.set(p.missionDay, { ...p });
      else if (sevOf(p.state) > sevOf(seen.state)) seen.state = p.state;
    }
  }
  const series = [...byDay.values()].sort((a, b) => a.missionDay - b.missionDay);
  const notes = tracks.some((t) => t.preflight?.thin === true) ? ['thin baseline'] : [];
  return { signalId: def.id, enabled: def.personal.enabled, upToDay: opts.upToDay, tracks, series, notes };
}

const sevOf = (v: Verdict): number =>
  v === 'NO_DATA' ? -1 : ENGINE_SEVERITY[v as keyof typeof ENGINE_SEVERITY];

export interface ComputePersonalOptions {
  accepted?: readonly number[];
  /** false → skip the memo (always recompute). Default true. */
  memo?: boolean;
}

/**
 * The personal LayerResult for one mission day. `observations` = all readings of this crew member and signal
 * (pre-flight and in-flight, any order; readings after `missionDay` are ignored by construction). Memoised on the
 * content of `observations` + def + profile + accepted, so calling it for every day of a crew+signal runs the
 * engine once. Treat the inputs and the returned object as immutable.
 */
export function computePersonal(
  def: SignalDef,
  observations: readonly Observation[],
  missionDay: number,
  profile: MissionProfile,
  opts: ComputePersonalOptions = {},
): PersonalResult {
  const s =
    opts.memo === false
      ? computePersonalSeries(
          def,
          observations,
          withAccepted({ upToDay: Number.POSITIVE_INFINITY, profile }, opts.accepted),
        )
      : cachedSeries(def, observations, profile, opts.accepted, computePersonalSeries);
  return personalFromSeries(def, s, missionDay);
}

/** The full memoised series of a crew+signal (all reading days), e.g. for the scrubber's flag density. */
export function personalSeriesMemo(
  def: SignalDef,
  observations: readonly Observation[],
  profile: MissionProfile,
  accepted?: readonly number[],
): PersonalSeriesResult {
  return cachedSeries(def, observations, profile, accepted, computePersonalSeries);
}

export function withAccepted(
  o: PersonalSeriesOptions,
  accepted: readonly number[] | undefined,
): PersonalSeriesOptions {
  return accepted === undefined ? o : { ...o, accepted };
}
