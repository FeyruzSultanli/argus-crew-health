// Deterministic simulated mission (doc 12 §4, doc 05 §6). Pure: (crew, profile, scenarios, anchors, seed) →
// Observation[]; no Dexie, no clock reads unless no epoch is passed. Days −180 … profile.demoMissionDay, no day 0,
// nothing after the demo day. Every generated observation is labeled SIMULATED except the OSDR anchors (MEASURED).
// All constants below are demo parameters [SRC_DEMO_SIMULATION]; sigma floors are doc 08 §7 [SRC_DEMO_BASELINE_ENGINE].
import { isVisionExamDay } from '../../domain/plan/todayPlan';
import type { CrewMember, MissionProfile, Observation, Quality, SignalId } from '../../domain/types';
import { computeMissionEpoch, missionDayRange, simulatedEffectiveAt } from '../missionClock';
import { anchorsOf, OSDR_METHOD_CBC, OSDR_METHOD_CMP, type AnchorSet, type PreflightAnchor } from './anchors';
import { createRng, DEFAULT_SEED, type Rng } from './rng';
import { indexScenarios, type ScenarioDef, type ScenarioIndex } from './scenarios';

/** Generator constants [SRC_DEMO_SIMULATION]. */
export const SIM = {
  firstDay: -180,
  noiseFactor: 0.7, // σ_noise = 0.7 × sigmaFloor
  wobbleFactor: 0.25, // weeklyWobble = 0.25 × sigmaFloor × sin(2π·day/7)
  sleep: { sdHours: 0.35, inflightOffsetHours: -0.9 },
  reaction: { firstDay: -175, everyDays: 7, speedSd: 0.07, lapses: [1, 3], falseStarts: [0, 1], nStimuli: [58, 66] },
  weeklyEveryDays: 7,
  glucoseEveryDays: 14,
  blood: { everyDays: 30, inflightHctRise: 0.05, inflightSd: 0.3, interpHctSd: 0.3, interpWbcSd: 0.2 },
  vision: { preflightEveryDays: 30, acuityBaselineLogMAR: 0, acuitySd: 0.035 },
  exercise: { sdMin: 8 },
  cabin: {
    co2: { mean: 2.3, sd: 0.12, min: 2.0, max: 2.6, avgDays: 7 },
    temp: { mean: 22, sd: 0.35, min: 21, max: 23 },
    rh: { mean: 47.5, sd: 2.5, min: 40, max: 55 },
  },
} as const;

/** Personal-layer sigma floors (doc 08 §7) used to scale noise. */
const FLOOR = {
  heart_rate_rest: 2, systolic: 5, diastolic: 4, spo2: 1, body_temp: 0.2, glucose: 5, mood: 0.4, body_mass: 0.5,
  hydration: 0.2,
} as const;

const UNIT: Record<SignalId, string> = {
  heart_rate_rest: '/min', blood_pressure: 'mm[Hg]', spo2: '%', body_temp: 'Cel', glucose: 'mg/dL',
  sleep_duration: 'h', mood: '{score}', body_mass: 'kg', reaction_test: '/s', amsler: '{areas}',
  near_acuity: '{logMAR}', face_fluid_index: '1', hydration: 'L/d', exercise_minutes: 'min/d', hematocrit: '%',
  wbc: '10*3/uL', symptoms: '1', cabin_co2: 'mm[Hg]', cabin_temp: 'Cel', cabin_humidity: '%', radiation_dose: 'mSv',
};

export const SIMULATED_METHOD = 'ARGUS simulator';

const round = (x: number, p: number): number => {
  const f = 10 ** p;
  const v = Math.round(x * f) / f;
  return v === 0 ? 0 : v; // no -0
};
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const wobble = (day: number, floor: number): number => SIM.wobbleFactor * floor * Math.sin((2 * Math.PI * day) / 7);
const good = (): Quality => ({ score: 1, label: 'good', reasons: [] });
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? NaN) : ((s[m - 1] ?? NaN) + (s[m] ?? NaN)) / 2;
};

/** Pre-flight: every `n` days from day −180; in flight: every `n` days from launch day 1. */
export function onCadence(day: number, n: number): boolean {
  if (n <= 1) return true;
  return day < 0 ? (day - SIM.firstDay) % n === 0 : (day - 1) % n === 0;
}

interface Ctx {
  epoch: string;
  seed: string;
  days: number[];
  demoDay: number;
  idx: ScenarioIndex;
  out: Observation[];
}

function sim(
  ctx: Ctx,
  crewId: string,
  signalId: SignalId,
  day: number,
  value: number | null,
  extra: Partial<Observation> = {},
  idSuffix = '',
): void {
  ctx.out.push({
    id: `sim:${crewId}:${signalId}:${day}${idSuffix}`,
    crewId,
    signalId,
    value,
    unit: UNIT[signalId],
    effectiveAt: simulatedEffectiveAt(day, ctx.epoch),
    missionDay: day,
    source: { kind: 'simulated', method: SIMULATED_METHOD, label: 'SIMULATED' },
    quality: good(),
    ...extra,
  });
}

const stream = (ctx: Ctx, ...parts: string[]): Rng => createRng([ctx.seed, ...parts].join('|'));

interface VitalSpec {
  signalId: SignalId;
  baselineKey: string;
  floor: number;
  every: number;
  precision: number;
  min?: number;
  max?: number;
}

const VITALS: readonly VitalSpec[] = [
  { signalId: 'heart_rate_rest', baselineKey: 'heart_rate_rest', floor: FLOOR.heart_rate_rest, every: 1, precision: 0 },
  { signalId: 'spo2', baselineKey: 'spo2', floor: FLOOR.spo2, every: SIM.weeklyEveryDays, precision: 0, max: 100 },
  { signalId: 'body_temp', baselineKey: 'body_temp', floor: FLOOR.body_temp, every: 1, precision: 1 },
  { signalId: 'body_mass', baselineKey: 'body_mass', floor: FLOOR.body_mass, every: SIM.weeklyEveryDays, precision: 1 },
  { signalId: 'hydration', baselineKey: 'hydration', floor: FLOOR.hydration, every: 1, precision: 1, min: 0 },
  { signalId: 'mood', baselineKey: 'mood', floor: FLOOR.mood, every: 1, precision: 0, min: 1, max: 5 },
];

function genVital(ctx: Ctx, c: CrewMember, spec: VitalSpec): void {
  const base = c.simulatedBaseline[spec.baselineKey];
  if (base === undefined) return;
  const rng = stream(ctx, c.id, spec.signalId);
  for (const day of ctx.days) {
    if (!onCadence(day, spec.every)) continue;
    const raw = base + wobble(day, spec.floor) + rng.normal(0, SIM.noiseFactor * spec.floor);
    const eff = ctx.idx.get(c.id, spec.signalId, day);
    let v: number;
    if (eff?.absolute !== undefined) v = eff.absolute;
    else v = clamp(round(raw + (eff?.delta ?? 0), spec.precision), spec.min ?? -Infinity, spec.max ?? Infinity);
    sim(ctx, c.id, spec.signalId, day, v);
  }
}

function genBloodPressure(ctx: Ctx, c: CrewMember): void {
  const sys = c.simulatedBaseline.systolic;
  const dia = c.simulatedBaseline.diastolic;
  if (sys === undefined || dia === undefined) return;
  const rng = stream(ctx, c.id, 'blood_pressure');
  for (const day of ctx.days) {
    if (!onCadence(day, SIM.weeklyEveryDays)) continue;
    const s = round(sys + wobble(day, FLOOR.systolic) + rng.normal(0, SIM.noiseFactor * FLOOR.systolic), 0);
    const d = round(dia + wobble(day, FLOOR.diastolic) + rng.normal(0, SIM.noiseFactor * FLOOR.diastolic), 0);
    sim(ctx, c.id, 'blood_pressure', day, null, { components: { systolic: s, diastolic: d } });
  }
}

function genGlucose(ctx: Ctx, c: CrewMember, anchors: PreflightAnchor[], label: string): void {
  const base = c.simulatedBaseline.glucose_fasting;
  const withGlucose = anchors.filter((a) => a.glucose !== undefined);
  const anchorDays = new Set(withGlucose.map((a) => a.missionDay));
  for (const a of withGlucose) {
    // OSD-575 does not say whether the draws were fasting: stored as 'random' so they stay out of the fasting-only
    // personal baseline and are not judged against fasting bands.
    ctx.out.push(anchorObs(ctx, c.id, 'glucose', a, a.glucose ?? NaN, OSDR_METHOD_CMP, label, { glucose: 'random' }));
  }
  if (base === undefined) return;
  const rng = stream(ctx, c.id, 'glucose');
  for (const day of ctx.days) {
    if (!onCadence(day, SIM.glucoseEveryDays)) continue;
    const v = round(base + wobble(day, FLOOR.glucose) + rng.normal(0, SIM.noiseFactor * FLOOR.glucose), 0);
    if (anchorDays.has(day)) continue; // the measured anchor wins
    sim(ctx, c.id, 'glucose', day, v, { context: { glucose: 'fasting' } });
  }
}

function genSleep(ctx: Ctx, c: CrewMember): void {
  const base = c.simulatedBaseline.sleep_duration;
  if (base === undefined) return;
  const adapt = ctx.idx.inflightSleep ?? { offsetHours: SIM.sleep.inflightOffsetHours, sdHours: SIM.sleep.sdHours };
  const rng = stream(ctx, c.id, 'sleep_duration');
  for (const day of ctx.days) {
    const raw = day < 0 ? rng.normal(base, SIM.sleep.sdHours) : rng.normal(base + adapt.offsetHours, adapt.sdHours);
    const eff = ctx.idx.get(c.id, 'sleep_duration', day);
    const v = eff?.absolute !== undefined ? eff.absolute : clamp(round(raw, 1), 0, 16);
    sim(ctx, c.id, 'sleep_duration', day, v);
  }
}

/** Reaction-test days: weekly from −175 pre-flight; in flight weekly on days that fall on the demo day's weekday,
 *  except the demo day itself (that test is left for the crew to do live); plus scenario extra days. */
export function reactionTestDays(demoDay: number, extraDays: readonly number[]): number[] {
  const days = new Set<number>();
  for (let d = SIM.reaction.firstDay; d <= Math.min(-1, demoDay); d += SIM.reaction.everyDays) days.add(d);
  for (let d = 1; d < demoDay; d++) if ((demoDay - d) % SIM.reaction.everyDays === 0) days.add(d);
  for (const d of extraDays) if (d !== 0 && d >= SIM.firstDay && d <= demoDay) days.add(d);
  return [...days].sort((a, b) => a - b);
}

function genReaction(ctx: Ctx, c: CrewMember): void {
  const speed0 = c.simulatedBaseline.pvt_speed;
  if (speed0 === undefined) return;
  const rng = stream(ctx, c.id, 'reaction_test');
  const [lLo, lHi] = SIM.reaction.lapses;
  const [fLo, fHi] = SIM.reaction.falseStarts;
  const [nLo, nHi] = SIM.reaction.nStimuli;
  for (const day of reactionTestDays(ctx.demoDay, ctx.idx.extraReactionDays(c.id))) {
    const speed = round(rng.normal(speed0, SIM.reaction.speedSd), 2);
    const lapses = rng.int(lLo, lHi) + (ctx.idx.get(c.id, 'reaction_test', day)?.lapsesDelta ?? 0);
    const falseStarts = rng.int(fLo, fHi);
    const nStimuli = rng.int(nLo, nHi);
    sim(ctx, c.id, 'reaction_test', day, speed, {
      components: { medianRtMs: Math.round(1000 / speed), lapses, falseStarts, nStimuli },
    });
  }
}

function anchorObs(
  ctx: Ctx,
  crewId: string,
  signalId: SignalId,
  a: PreflightAnchor,
  value: number,
  method: string,
  label: string,
  context?: Observation['context'],
): Observation {
  const o: Observation = {
    id: `osdr:${crewId}:${signalId}:${a.timepoint}`,
    crewId,
    signalId,
    value,
    unit: UNIT[signalId],
    effectiveAt: simulatedEffectiveAt(a.missionDay, ctx.epoch),
    missionDay: a.missionDay,
    source: { kind: 'lab', method, label: 'MEASURED' },
    quality: good(),
    note:
      signalId === 'glucose'
        ? `${label} — subject ${a.subject}, ${a.timepoint}. Fasting state not recorded in the dataset.`
        : `${label} — subject ${a.subject}, ${a.timepoint}.`,
  };
  if (context) o.context = context;
  return o;
}

function interpolate(anchors: PreflightAnchor[], day: number, pick: (a: PreflightAnchor) => number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) return NaN;
  if (day <= first.missionDay) return pick(first);
  if (day >= last.missionDay) return pick(last);
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (a && b && day <= b.missionDay) {
      const t = (day - a.missionDay) / (b.missionDay - a.missionDay);
      return pick(a) + t * (pick(b) - pick(a));
    }
  }
  return pick(last);
}

function genBlood(ctx: Ctx, c: CrewMember, anchors: PreflightAnchor[], label: string): void {
  if (anchors.length === 0) return;
  const anchorDays = new Set(anchors.map((a) => a.missionDay));
  const series = [
    { signalId: 'hematocrit' as const, pick: (a: PreflightAnchor) => a.hematocrit, sd: SIM.blood.interpHctSd, rise: SIM.blood.inflightHctRise },
    { signalId: 'wbc' as const, pick: (a: PreflightAnchor) => a.wbc, sd: SIM.blood.interpWbcSd, rise: 0 },
  ];
  for (const s of series) {
    for (const a of anchors) ctx.out.push(anchorObs(ctx, c.id, s.signalId, a, s.pick(a), OSDR_METHOD_CBC, label));
    // In flight the values are based on the same pre-flight reference the domain uses: the median of every
    // pre-flight reading of the series (anchors + interpolations).
    const preValues = anchors.map(s.pick);
    let preMedian: number | null = null;
    const rng = stream(ctx, c.id, s.signalId);
    for (const day of ctx.days) {
      if (day < 0) {
        if (!onCadence(day, SIM.blood.everyDays)) continue;
        const v = round(interpolate(anchors, day, s.pick) + rng.normal(0, s.sd), 1);
        if (!anchorDays.has(day)) {
          sim(ctx, c.id, s.signalId, day, v);
          preValues.push(v);
        }
      } else if (day % SIM.blood.everyDays === 0) {
        preMedian ??= median(preValues);
        const v = round(preMedian * (1 + s.rise) + rng.normal(0, SIM.blood.inflightSd), 1);
        sim(ctx, c.id, s.signalId, day, v);
      }
    }
  }
}

const isVisionDay = (day: number): boolean =>
  day < 0 ? (day - SIM.firstDay) % SIM.vision.preflightEveryDays === 0 : isVisionExamDay(day);

function genVision(ctx: Ctx, c: CrewMember): void {
  const glassesFrom = ctx.idx.acuityGlassesFrom(c.id);
  for (const eye of ['left', 'right'] as const) {
    const rng = stream(ctx, c.id, 'near_acuity', eye);
    for (const day of ctx.days) {
      if (!isVisionDay(day)) continue;
      const cells = ctx.idx.get(c.id, 'amsler', day, eye)?.delta ?? 0;
      sim(ctx, c.id, 'amsler', day, cells, { context: { eye }, components: { peripheralCells: cells, centralCells: 0 } }, `:${eye}`);
      const raw = rng.normal(SIM.vision.acuityBaselineLogMAR, SIM.vision.acuitySd);
      const acuity = clamp(round(raw + (ctx.idx.get(c.id, 'near_acuity', day, eye)?.delta ?? 0), 2), -0.3, 1.3);
      // sans-drift narrative: anticipation glasses are in use from the scenario day on.
      const glasses = glassesFrom !== undefined && day >= 1 && day >= glassesFrom;
      sim(ctx, c.id, 'near_acuity', day, acuity, { context: glasses ? { eye, withGlasses: true } : { eye } }, `:${eye}`);
    }
  }
}

function genExercise(ctx: Ctx, c: CrewMember): void {
  const plan = c.simulatedBaseline.exercise_plan_min;
  if (plan === undefined) return;
  const rng = stream(ctx, c.id, 'exercise_minutes');
  for (const day of ctx.days) sim(ctx, c.id, 'exercise_minutes', day, clamp(round(rng.normal(plan, SIM.exercise.sdMin), 0), 0, 300));
}

function genSymptoms(ctx: Ctx, c: CrewMember): void {
  for (const day of ctx.days) {
    const ids = ctx.idx.get(c.id, 'symptoms', day)?.symptoms;
    if (!ids || ids.length === 0) continue;
    const components: Record<string, number> = {};
    for (const id of ids) components[id] = 1;
    sim(ctx, c.id, 'symptoms', day, null, { components, note: ids.join(', ') });
  }
}

function genCabin(ctx: Ctx): void {
  const inflight = ctx.days.filter((d) => d >= 1);
  const { co2, temp, rh } = SIM.cabin;
  const rCo2 = stream(ctx, 'cabin', 'cabin_co2');
  const rTemp = stream(ctx, 'cabin', 'cabin_temp');
  const rRh = stream(ctx, 'cabin', 'cabin_humidity');
  const recent: number[] = [];
  for (const day of inflight) {
    const raw = clamp(round(rCo2.normal(co2.mean, co2.sd), 1), co2.min, co2.max);
    const v = ctx.idx.get('cabin', 'cabin_co2', day)?.absolute ?? raw;
    recent.push(v);
    if (recent.length > co2.avgDays) recent.shift();
    const avg7d = round(recent.reduce((s, x) => s + x, 0) / recent.length, 2);
    sim(ctx, 'cabin', 'cabin_co2', day, v, { components: { avg7d } });
    sim(ctx, 'cabin', 'cabin_temp', day, clamp(round(rTemp.normal(temp.mean, temp.sd), 1), temp.min, temp.max));
    sim(ctx, 'cabin', 'cabin_humidity', day, clamp(round(rRh.normal(rh.mean, rh.sd), 0), rh.min, rh.max));
  }
}

/**
 * Generates the whole simulated timeline for all crew and the cabin. Same inputs + same seed + same epoch → deep-equal
 * output. `missionEpoch` defaults to the epoch that puts the demo day on today's UTC date.
 */
export function generateObservations(
  crew: readonly CrewMember[],
  profile: MissionProfile,
  scenarios: readonly ScenarioDef[],
  anchors: AnchorSet,
  seed: string = DEFAULT_SEED,
  opts: { missionEpoch?: string } = {},
): Observation[] {
  const demoDay = profile.demoMissionDay;
  const ctx: Ctx = {
    epoch: opts.missionEpoch ?? computeMissionEpoch(new Date(), demoDay),
    seed,
    days: missionDayRange(SIM.firstDay, demoDay),
    demoDay,
    idx: indexScenarios(scenarios),
    out: [],
  };
  for (const c of crew) {
    const own = anchorsOf(anchors, c.osdrSubject);
    for (const spec of VITALS) genVital(ctx, c, spec);
    genBloodPressure(ctx, c);
    genGlucose(ctx, c, own, anchors.label);
    genSleep(ctx, c);
    genReaction(ctx, c);
    genBlood(ctx, c, own, anchors.label);
    genVision(ctx, c);
    genExercise(ctx, c);
    genSymptoms(ctx, c);
  }
  genCabin(ctx);
  return ctx.out;
}
