// Registry completeness, catalog texts, and source discipline: every sourceId any rule returns exists in
// seed/sources.json; every reason is ≤ 140 chars and free of diagnosis wording.
import { describe, expect, it } from 'vitest';

import sourcesJson from '../../../seed/sources.json';
import { CREW, ctx, obs, series } from '../__tests__/fixtures';
import type { DoseLedger, LayerResult, Observation, RuleCtx, SignalId } from '../types';
import { CANONICAL_UNIT } from '../units';
import { assessSignal, noPersonal } from '../verdict/assess';
import { CABIN_SIGNAL_IDS, SIGNALS, getSignal, signalList } from './index';

const REGISTERED = new Set(sourcesJson.sources.map((s) => s.id));
const ALL_IDS = Object.keys(CANONICAL_UNIT) as SignalId[];
const DIAGNOSIS_WORDS =
  /diagnos|hypertens|diabet|hypox|infect|fever|disease|disorder|syndrome|prescri|dose of \d/i;

describe('registry', () => {
  it('registers every SignalId exactly once', () => {
    expect(Object.keys(SIGNALS).sort()).toEqual([...ALL_IDS].sort());
    expect(signalList).toHaveLength(ALL_IDS.length);
    expect(new Set(signalList.map((d) => d.id)).size).toBe(ALL_IDS.length);
    for (const id of ALL_IDS) {
      expect(SIGNALS[id].id).toBe(id);
      expect(getSignal(id)).toBe(SIGNALS[id]);
    }
  });
  it('evaluates reaction_test before sleep_duration', () => {
    const order = signalList.map((d) => d.id);
    expect(order.indexOf('reaction_test')).toBeLessThan(order.indexOf('sleep_duration'));
  });
  it('cabin signals have no body region and are environment-system', () => {
    for (const id of CABIN_SIGNAL_IDS) {
      expect(SIGNALS[id].bodyRegions).toEqual([]);
      expect(SIGNALS[id].system).toBe('environment');
    }
  });
  it('body regions match doc 07 §6', () => {
    const regions = (id: SignalId) => SIGNALS[id].bodyRegions;
    expect(regions('heart_rate_rest')).toEqual(['heart']);
    expect(regions('blood_pressure')).toEqual(['heart', 'vessels']);
    expect(regions('spo2')).toEqual(['lungs']);
    expect(regions('exercise_minutes')).toEqual(['skeleton', 'muscles']);
    expect(regions('radiation_dose')).toEqual(['whole_body']);
    expect(regions('face_fluid_index')).toEqual(['face']);
    expect(regions('amsler')).toEqual(['eyes']);
    expect(regions('glucose')).toEqual(['pancreas_liver']);
    expect(regions('hydration')).toEqual(['kidneys']);
    expect(regions('body_temp')).toEqual(['skin']);
  });
  it('personal parameters follow doc 08 §7', () => {
    expect(SIGNALS.heart_rate_rest.personal.params).toEqual([
      { direction: 'both', sigmaFloor: 2, aggregation: 'daily-median' },
    ]);
    expect(SIGNALS.blood_pressure.personal.params.map((p) => [p.component, p.sigmaFloor])).toEqual([
      ['systolic', 5],
      ['diastolic', 4],
    ]);
    expect(SIGNALS.body_temp.personal.params[0]?.aggregation).toBe('daily-max');
    expect(SIGNALS.sleep_duration.personal.params[0]).toEqual({
      direction: 'down',
      sigmaFloor: 0.3,
      aggregation: 'mean-3',
    });
    expect(SIGNALS.hydration.personal.params[0]?.aggregation).toBe('mean-2');
    expect(SIGNALS.hematocrit.personal.enabled).toBe(false);
    expect(SIGNALS.wbc.personal.enabled).toBe(false);
    expect(SIGNALS.amsler.personal.enabled).toBe(false);
    expect(SIGNALS.face_fluid_index.personal.enabled).toBe(false);
    expect(SIGNALS.body_temp.personal.expectedShift).toBeUndefined();
  });
});

describe('catalog texts', () => {
  it.each(ALL_IDS)('%s has the doc 07 §1 texts', (id) => {
    const d = SIGNALS[id];
    expect(d.label.length).toBeGreaterThan(0);
    expect(d.shortWhat.length).toBeGreaterThan(10);
    expect(d.whyInSpace.length).toBeGreaterThan(10);
    expect(d.howToMeasure.length).toBeGreaterThanOrEqual(1);
    expect(d.howToMeasure.length).toBeLessThanOrEqual(5);
    expect(d.cadenceDays).toBeGreaterThan(0);
    expect(d.nasaRiskIds).toContain('SRC_NASA_RISKS');
  });
  it.each(ALL_IDS)('%s sourceIds, nasaRiskIds and action protocols are registered', (id) => {
    const d = SIGNALS[id];
    for (const s of [...d.sourceIds, ...d.nasaRiskIds]) expect(REGISTERED, s).toContain(s);
    expect(d.sourceIds.length).toBeGreaterThan(0);
  });
});

// ---- Probe every rule over a grid of inputs and check what comes back ----

const dose = (projectedEndMsv: number, spe: number): DoseLedger => ({
  crewId: 'c3',
  careerPreMissionMsv: 35,
  missionGcrMsv: 200,
  missionSpeMsvModeled: spe,
  totalMsv: 235 + spe,
  pctOfCareerLimit: 0.4,
  projectedEndMsv,
  pctProjected: projectedEndMsv / 600,
  speCurrentEventMsvModeled: spe,
  sourceIds: ['SRC_STD3001_RAD', 'SRC_DEMO_RADIATION_MODEL'],
});

const VALUES: Record<SignalId, number[]> = {
  heart_rate_rest: [30, 45, 70, 115, 140],
  blood_pressure: [0],
  spo2: [85, 92, 98],
  body_temp: [34, 35.5, 36.6, 37.7, 38.5],
  glucose: [40, 60, 85, 110, 130, 150, 250],
  sleep_duration: [4, 5.2, 6, 7.5],
  mood: [1, 2, 3, 5],
  body_mass: [60, 70, 74, 80],
  reaction_test: [3.5],
  amsler: [0, 2],
  near_acuity: [0, 0.15, 0.35],
  face_fluid_index: [0.95, 1.1],
  hydration: [1.5, 2.5],
  exercise_minutes: [30, 70, 120],
  hematocrit: [33, 40, 44, 50, 55],
  wbc: [3, 6, 9, 12],
  symptoms: [0, 2],
  cabin_co2: [2, 2.8, 3.4, 5, 7],
  cabin_temp: [17, 19, 22, 26, 28],
  cabin_humidity: [20, 27, 45, 70, 80],
  radiation_dose: [235],
};

function probes(id: SignalId): Array<{ o: Observation; c: RuleCtx }> {
  const out: Array<{ o: Observation; c: RuleCtx }> = [];
  const ctxs: Array<Partial<RuleCtx>> = [
    {},
    {
      preflight: {
        median: id === 'body_mass' ? 80 : id === 'wbc' ? 6 : 40,
        n: 5,
        components: { lapses: 2, left: 0, right: 0 },
      },
      dose: dose(500, 130),
    },
    {
      preflight: { median: 0, n: 5, components: { lapses: 2 } },
      dose: dose(300, 0),
      crew: { ...CREW, sex: 'male' },
    },
  ];
  for (const v of VALUES[id]) {
    const extras: Array<Partial<Observation>> =
      id === 'blood_pressure'
        ? [
            { components: { systolic: 85, diastolic: 55 } },
            { components: { systolic: 118, diastolic: 76 } },
            { components: { systolic: 150, diastolic: 95 } },
            { components: { systolic: 190, diastolic: 125 } },
          ]
        : id === 'reaction_test'
          ? [{ components: { lapses: 1 } }, { components: { lapses: 6 } }, { components: { lapses: 10 } }]
          : id === 'glucose'
            ? [{ context: { glucose: 'fasting' } }, { context: { glucose: 'random' } }, {}]
            : id === 'amsler'
              ? [
                  { context: { eye: 'left' }, components: { newCells: 1, newCentralCells: 1 } },
                  { context: { eye: 'right' } },
                ]
              : id === 'near_acuity'
                ? [{ context: { eye: 'left', withGlasses: true } }, { context: { eye: 'right' } }]
                : id === 'cabin_co2'
                  ? [{ components: { avg7d: 2.6 } }, {}]
                  : [{}];
    for (const extra of extras) {
      for (const day of [-3, 30, 143]) {
        const hist = [
          ...series(
            id,
            [
              [day - 2, v],
              [day - 1, v],
            ],
            extra,
          ),
          obs(id, v, day, extra),
        ];
        const o = hist.at(-1) as Observation;
        for (const partial of ctxs) out.push({ o, c: ctx({ missionDay: day, history: hist, ...partial }) });
      }
    }
  }
  return out;
}

describe('every rule result (source discipline)', () => {
  it.each(ALL_IDS)('%s: sourceIds exist, reasons ≤ 140 chars, no diagnosis wording', (id) => {
    const def = SIGNALS[id];
    const results: LayerResult[] = [];
    for (const { o, c } of probes(id)) {
      results.push(def.earth(o, c), def.space(o, c));
      const a = assessSignal(def, c.history, c, noPersonal());
      results.push(a.layers.earth, a.layers.space);
      expect(a.explanation.length).toBeGreaterThan(0);
      expect(a.explanation).not.toMatch(DIAGNOSIS_WORDS);
      expect(a.action.text.length).toBeGreaterThan(0);
    }
    expect(results.length).toBeGreaterThan(0);
    const verdicts = new Set<string>();
    for (const r of results) {
      verdicts.add(`${r.layer}:${r.verdict}`);
      for (const s of r.sourceIds) expect(REGISTERED, `${id} ${r.ruleId ?? ''} cites ${s}`).toContain(s);
      if (r.verdict !== 'NO_DATA') expect(r.sourceIds.length, `${id} ${r.ruleId ?? ''}`).toBeGreaterThan(0);
      expect(r.reason.length, r.reason).toBeLessThanOrEqual(140);
      expect(r.reason, r.reason).not.toMatch(DIAGNOSIS_WORDS);
      expect(r.reason.length).toBeGreaterThan(0);
    }
    // Every signal with a rule produces at least one non-NO_DATA verdict over the grid.
    if (id !== 'symptoms') expect([...verdicts].some((v) => !v.endsWith('NO_DATA'))).toBe(true);
  });

  it('every result that carries [demo] bands cites SRC_DEMO_RULE_BANDS', () => {
    const hr = SIGNALS.heart_rate_rest.earth(obs('heart_rate_rest', 45, 143), ctx());
    expect(hr.sourceIds).toContain('SRC_DEMO_RULE_BANDS');
    const spo = SIGNALS.spo2.earth(obs('spo2', 92, 143), ctx());
    expect(spo.sourceIds).toContain('SRC_DEMO_RULE_BANDS');
    // A band without the [demo] mark (SpO₂ NOMINAL ≥ 95 %, stated by the source) does not cite it.
    const spoNominal = SIGNALS.spo2.earth(obs('spo2', 97, 143), ctx());
    expect(spoNominal.sourceIds).not.toContain('SRC_DEMO_RULE_BANDS');
  });
});
