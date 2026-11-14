// Test fixtures for the domain core (not imported by production code).
import type {
  CrewMember,
  LayerResult,
  MissionProfile,
  Observation,
  Quality,
  RuleCtx,
  SignalId,
  Verdict,
} from '../types';

export const GOOD: Quality = { score: 1, label: 'good', reasons: [] };
export const FAIR: Quality = { score: 0.6, label: 'fair', reasons: ['some motion'] };
export const POOR: Quality = { score: 0.2, label: 'poor', reasons: ['low SNR'] };

export const PROFILE: MissionProfile = {
  id: 'mars-transit',
  label: 'Mars transit',
  gravityG: 0,
  commsDelayOneWaySec: 600,
  gcrDoseMsvPerDay: 1.8,
  resupply: 'none',
  demoMissionDay: 143,
  durationDays: 210,
  shelterPolicyClass: 'deep-space',
  sourceIds: ['SRC_RAD_CURIOSITY'],
};

export const CREW: CrewMember = {
  id: 'c3',
  displayName: 'K. Osei',
  role: 'Flight engineer',
  isCMO: false,
  sex: 'female',
  ageYears: 38,
  careerDoseMsvPreMission: 35,
  simulatedBaseline: { heart_rate_rest: 58, exercise_plan_min: 120 },
};

let seq = 0;

/** One observation; effectiveAt follows missionDay (plus `minute`) so ordering is deterministic. */
export function obs(
  signalId: SignalId,
  value: number | null,
  missionDay: number,
  extra: Partial<Observation> = {},
  minute = 0,
): Observation {
  seq += 1;
  const base = Date.UTC(2026, 0, 1) + (missionDay + 1000) * 86_400_000 + minute * 60_000;
  return {
    id: `o${seq}`,
    crewId: signalId.startsWith('cabin_') ? 'cabin' : 'c3',
    signalId,
    value,
    unit: 'x',
    effectiveAt: new Date(base).toISOString(),
    missionDay,
    source: { kind: 'simulated', label: 'SIMULATED' },
    quality: GOOD,
    ...extra,
  };
}

/** The same value on each of `days` (one reading per day). */
export function series(
  signalId: SignalId,
  values: Array<[day: number, value: number]>,
  extra: Partial<Observation> = {},
): Observation[] {
  return values.map(([d, v]) => obs(signalId, v, d, extra));
}

export function ctx(partial: Partial<RuleCtx> = {}): RuleCtx {
  return {
    missionDay: 143,
    profile: PROFILE,
    crew: CREW,
    history: [],
    preflight: { median: null, n: 0 },
    sameDay: {},
    ...partial,
  };
}

export function layer(l: LayerResult['layer'], verdict: Verdict, reason = `${l} ${verdict}`): LayerResult {
  return { layer: l, verdict, reason, sourceIds: verdict === 'NO_DATA' ? [] : ['SRC_DEMO_RULE_BANDS'] };
}
