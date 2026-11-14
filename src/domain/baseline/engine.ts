// Runs one judged series (track) day by day from the first in-flight reading (doc 08 §2–§4).
// Day t depends only on readings of days ≤ t, so one run up to the last reading answers every earlier day.
import type { MissionProfile, Observation, SignalDef } from '../types';
import type { TrackSpec } from './aggregate';
import { dailyValues, judgedValue, trackReadings } from './aggregate';
import { BASELINE_PARAMS as P } from './constants';
import type { Side } from './cusum';
import { driftScore, signedZ } from './cusum';
import type { DayRecord, PreflightBaseline, ReferenceKind } from './reference';
import {
  adaptiveBaseline,
  expectedShift,
  preflightBaseline,
  preflightValues,
  selectReference,
} from './reference';
import type { DirectionMemory, DirectionStep, EngineState } from './stateMachine';
import { ENGINE_SEVERITY, directionStep, freshMemory } from './stateMachine';

export interface DirectionDay extends DirectionStep {
  side: Side;
  /** z of the previous reading in this direction (null for the first). */
  prevZ: number | null;
}

/** Everything the engine knows about one reading day of one track (debug drawer / charts). */
export interface PersonalDay {
  missionDay: number;
  /** Judged value x_t (3-night / 3-day / 2-day mean for mean-3 / mean-2). */
  value: number;
  /** The day's own daily value (what enters the adaptive baseline). */
  daily: number;
  ref: number;
  sigma: number;
  /** ref ∓ 2σ. */
  lo: number;
  hi: number;
  referenceKind: ReferenceKind;
  /** m_pre' (shifted pre-flight median), σ_pre and the shift applied. */
  mPre: number;
  sigmaPre: number;
  shift: number;
  /** Days in the adaptive baseline (0 when the pre-flight reference is used). */
  nAdaptive: number;
  /** Reported (worse) direction and its scores. */
  side: Side;
  state: EngineState;
  z: number;
  prevZ: number | null;
  cusum: number;
  drift: number | null;
  driver: DirectionStep['driver'];
  run: number;
  /** All directions run (1, or 2 for 'both'). */
  directions: DirectionDay[];
  /** Calendar days the current WATCH streak (no ACT) has lasted, 0 when not WATCH. */
  watchStreakDays: number;
}

export interface TrackRun {
  track: TrackSpec;
  preflight: PreflightBaseline | null;
  /** Number of pre-flight daily values (also when < 3 and `preflight` is null). */
  nPreflight: number;
  days: PersonalDay[];
}

export interface RunOptions {
  upToDay: number;
  profile: MissionProfile;
  accepted?: readonly number[];
}

const sidesOf = (d: TrackSpec['params']['direction']): Side[] => (d === 'both' ? ['up', 'down'] : [d]);

/** Worse state; tie → larger z; tie → first (up). */
function worse(a: DirectionDay, b: DirectionDay): DirectionDay {
  const sa = ENGINE_SEVERITY[a.state];
  const sb = ENGINE_SEVERITY[b.state];
  if (sb !== sa) return sb > sa ? b : a;
  return b.z > a.z ? b : a;
}

export function runTrack(
  def: SignalDef,
  track: TrackSpec,
  observations: readonly Observation[],
  opts: RunOptions,
): TrackRun {
  const { params } = track;
  const daily = dailyValues(trackReadings(def, track, observations), params.aggregation);
  const preValues = preflightValues(daily);
  const pre = preflightBaseline(preValues, params.sigmaFloor);
  const days: PersonalDay[] = [];
  if (pre === null) return { track, preflight: null, nPreflight: preValues.length, days };

  const sides = sidesOf(params.direction);
  let memory: DirectionMemory[] = sides.map(freshMemory);
  const history = new Map<number, DayRecord>();
  const accepted = opts.accepted ?? [];
  let prevDay: number | null = null;
  let streakStart: number | null = null;

  for (const [day, own] of daily) {
    if (day < 1 || day > opts.upToDay) continue;
    const x = judgedValue(daily, day, params.aggregation) as number;

    // FR-BAS-7: after an "Accept as new normal" the scores restart from the first reading after that day.
    const from = prevDay;
    if (from !== null && accepted.some((a) => a >= from && a < day)) memory = sides.map(freshMemory);

    const shift = expectedShift(def, day, opts.profile);
    const adaptive = adaptiveBaseline(day, history, params.sigmaFloor, accepted);
    const ref = selectReference(pre, shift, adaptive);

    const steps: DirectionDay[] = sides.map((side, i) => {
      const z = signedZ(x, ref.m, ref.sigma, side);
      const drift = adaptive === null ? null : driftScore(adaptive.m, ref.mPre, ref.sigmaPre, side);
      const prevZ = (memory[i] as DirectionMemory).prevZ;
      const r = directionStep(memory[i] as DirectionMemory, z, drift);
      memory[i] = r.memory;
      return { ...r.step, side, prevZ };
    });
    const top = steps.reduce(worse);

    if (top.state === 'WATCH') streakStart ??= day;
    else streakStart = null;

    days.push({
      missionDay: day,
      value: x,
      daily: own,
      ref: ref.m,
      sigma: ref.sigma,
      lo: ref.m - P.bandSigmas * ref.sigma,
      hi: ref.m + P.bandSigmas * ref.sigma,
      referenceKind: ref.kind,
      mPre: ref.mPre,
      sigmaPre: ref.sigmaPre,
      shift,
      nAdaptive: adaptive?.n ?? 0,
      side: top.side,
      state: top.state,
      z: top.z,
      prevZ: top.prevZ,
      cusum: top.S,
      drift: top.drift,
      driver: top.driver,
      run: top.run,
      directions: steps,
      watchStreakDays: streakStart === null ? 0 : day - streakStart + 1,
    });
    history.set(day, { value: own, verdict: top.state });
    prevDay = day;
  }
  return { track, preflight: pre, nPreflight: preValues.length, days };
}
