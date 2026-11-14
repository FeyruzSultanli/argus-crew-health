// Chart models for the Trends page (doc 11 §5.3, doc 08 §6, FR-BAS-6). Pure: hooks feed these functions.
import { preflightBaseline } from '../../domain/baseline/reference';
import { median } from '../../domain/baseline/robust';
import { CANONICAL_UNIT, DISPLAY_PRECISION } from '../../domain/units';
import type {
  LayerResult,
  Observation,
  PersonalResult,
  SignalDef,
  SignalId,
  Verdict,
} from '../../domain/types';
import type { ChartBand } from './chartTypes';
import { dayToIndex, inRange } from './axis';
import type { DayRange } from './axis';

export type SeriesPoint = PersonalResult['series'][number];

export interface TrendPoint {
  missionDay: number;
  x: number;
  value: number;
  lo?: number;
  hi?: number;
  /** Personal verdict that day (only for signals with a personal band). */
  state?: Verdict;
  /** A reading the user took (camera, reaction test, manual) rather than simulated history. */
  measured: boolean;
}

export interface TrendTrack {
  key: string;
  label: string;
  points: TrendPoint[];
  /** Draw the personal band (ref ∓ 2σ) for this track. */
  band: boolean;
}

export interface VerdictMarker {
  missionDay: number;
  x: number;
  value: number;
  state: 'WATCH' | 'ACT';
  trackLabel: string;
  measured: boolean;
}

export interface TrendModel {
  signalId: SignalId;
  title: string;
  unit: string;
  precision: number;
  tracks: TrendTrack[];
  /** Sources behind the personal band. */
  bandSourceIds: readonly string[];
  preflightBand?: ChartBand;
  spaceBand?: ChartBand;
  markers: VerdictMarker[];
  /** Latest point in range (for the title). */
  latest?: TrendPoint & { trackLabel: string };
}

/** Tracks from usePersonalTracks: per-track label, optional component / eye. */
export interface TrackInput {
  key: string;
  label: string;
  component?: string;
  eye?: 'left' | 'right' | 'unspecified';
  series: PersonalResult['series'];
}

const MEASURED_LABELS = new Set(['MEASURED', 'LIVE']);

/** Numeric value of an observation for a track (component, or eye for per-eye signals). */
export function trackValue(o: Observation, t?: Pick<TrackInput, 'component' | 'eye'>): number | null {
  if (t?.eye && t.eye !== 'unspecified' && o.context?.eye !== t.eye) return null;
  if (t?.component) {
    const c = o.components?.[t.component];
    return typeof c === 'number' ? c : null;
  }
  return o.value;
}

/** Daily medians of the observations (one value per mission day), and which days have a user reading. */
export function dailyValues(
  obs: readonly Observation[],
  t?: Pick<TrackInput, 'component' | 'eye'>,
): Map<number, { value: number; measured: boolean }> {
  const by = new Map<number, { values: number[]; measured: boolean }>();
  for (const o of obs) {
    const v = trackValue(o, t);
    if (v === null || !Number.isFinite(v)) continue;
    const e = by.get(o.missionDay) ?? { values: [], measured: false };
    e.values.push(v);
    if (MEASURED_LABELS.has(o.source.label)) e.measured = true;
    by.set(o.missionDay, e);
  }
  const out = new Map<number, { value: number; measured: boolean }>();
  for (const [d, e] of by) out.set(d, { value: median(e.values) as number, measured: e.measured });
  return out;
}

/**
 * One track's points in range: the personal series (value, band, state) where it exists, else the daily median of
 * the raw readings (pre-flight days and signals without a personal band).
 */
export function trackPoints(
  series: PersonalResult['series'],
  obs: readonly Observation[],
  range: DayRange,
  t?: Pick<TrackInput, 'component' | 'eye'>,
): TrendPoint[] {
  const daily = dailyValues(obs, t);
  const byDay = new Map<number, TrendPoint>();
  for (const [d, e] of daily) {
    if (!inRange(d, range)) continue;
    byDay.set(d, { missionDay: d, x: dayToIndex(d), value: e.value, measured: e.measured });
  }
  for (const p of series) {
    if (!inRange(p.missionDay, range)) continue;
    byDay.set(p.missionDay, {
      missionDay: p.missionDay,
      x: dayToIndex(p.missionDay),
      value: p.value,
      lo: p.lo,
      hi: p.hi,
      state: p.state,
      measured: daily.get(p.missionDay)?.measured ?? false,
    });
  }
  return [...byDay.values()].sort((a, b) => a.x - b.x);
}

/** Pre-flight band (m_pre ∓ 2σ_pre) from the personal layer's numbers (mPre there already includes the shift). */
export function preflightBandFromNumbers(personal: LayerResult | undefined): ChartBand | undefined {
  const n = personal?.numbers;
  if (!n || n.mPre === undefined || n.sigmaPre === undefined) return undefined;
  const m = n.mPre - (n.shift ?? 0);
  return { lo: m - 2 * n.sigmaPre, hi: m + 2 * n.sigmaPre, sourceIds: bandSources(personal) };
}

/** Space-expected band: the pre-flight band moved by the expected in-flight shift, in-flight days only. */
export function spaceBandFromNumbers(personal: LayerResult | undefined): ChartBand | undefined {
  const n = personal?.numbers;
  if (!n || n.mPre === undefined || n.sigmaPre === undefined || !n.shift) return undefined;
  return {
    lo: n.mPre - 2 * n.sigmaPre,
    hi: n.mPre + 2 * n.sigmaPre,
    sourceIds: bandSources(personal),
    fromDay: 1,
  };
}

/** Fallback when the assessment exposes no numbers: robust pre-flight baseline of the raw readings. */
export function preflightBandFromObservations(
  def: SignalDef,
  obs: readonly Observation[],
): ChartBand | undefined {
  const floor = def.personal.params[0]?.sigmaFloor;
  if (floor === undefined) return undefined;
  const values = [...dailyValues(obs.filter((o) => o.missionDay < 0)).values()].map((e) => e.value);
  const pre = preflightBaseline(values, floor);
  if (!pre) return undefined;
  return { lo: pre.m - 2 * pre.sigma, hi: pre.m + 2 * pre.sigma, sourceIds: ['SRC_DEMO_BASELINE_ENGINE'] };
}

function bandSources(personal: LayerResult | undefined): readonly string[] {
  const ids = personal?.sourceIds ?? [];
  return ids.length > 0 ? ids : ['SRC_DEMO_BASELINE_ENGINE'];
}

export interface BuildModelInput {
  def: SignalDef;
  range: DayRange;
  /** Combined series (usePersonalSeries); [] for signals without a personal band. */
  series: PersonalResult['series'];
  /** Per-track series (usePersonalTracks); used when there is more than one track. */
  tracks?: readonly TrackInput[];
  observations: readonly Observation[];
  /** Personal layer of the selected day's assessment (numbers: mPre, sigmaPre, shift). */
  personal?: LayerResult;
}

/** Everything one chart needs: tracks, bands, verdict markers and the latest value. */
export function buildTrendModel(input: BuildModelInput): TrendModel {
  const { def, range, series, tracks = [], observations, personal } = input;
  const hasBand = def.personal.enabled;
  const multi = hasBand && tracks.length > 1;
  const trendTracks: TrendTrack[] = multi
    ? tracks.map((t) => ({
        key: t.key,
        label: t.label,
        band: true,
        points: trackPoints(t.series, observations, range, t),
      }))
    : [
        {
          key: 'value',
          label: def.label,
          band: hasBand,
          points: trackPoints(hasBand ? series : [], observations, range, tracks[0]),
        },
      ];
  const markers: VerdictMarker[] = [];
  for (const t of trendTracks) {
    for (const p of t.points) {
      if (p.state === 'WATCH' || p.state === 'ACT')
        markers.push({
          missionDay: p.missionDay,
          x: p.x,
          value: p.value,
          state: p.state,
          trackLabel: t.label,
          measured: p.measured,
        });
    }
  }
  markers.sort((a, b) => a.x - b.x);
  let latest: TrendModel['latest'];
  for (const t of trendTracks) {
    const p = t.points[t.points.length - 1];
    if (p && (!latest || p.x > latest.x)) latest = { ...p, trackLabel: t.label };
  }
  const preflightBand =
    hasBand && !multi
      ? (preflightBandFromNumbers(personal) ?? preflightBandFromObservations(def, observations))
      : undefined;
  const spaceBand =
    hasBand && !multi && def.personal.expectedShift ? spaceBandFromNumbers(personal) : undefined;
  const model: TrendModel = {
    signalId: def.id,
    title: def.label,
    unit: observations[0]?.unit ?? CANONICAL_UNIT[def.id],
    precision: DISPLAY_PRECISION[def.id],
    tracks: trendTracks,
    bandSourceIds: bandSources(personal),
    markers,
  };
  if (preflightBand) model.preflightBand = preflightBand;
  if (spaceBand) model.spaceBand = spaceBand;
  if (latest) model.latest = latest;
  return model;
}

/** Sources of a plotted value: simulated history cites the simulation entry, a user reading the signal's sources. */
export function pointSourceIds(def: SignalDef, p: Pick<TrendPoint, 'measured'>): readonly string[] {
  return p.measured ? def.sourceIds : ['SRC_DEMO_SIMULATION'];
}
