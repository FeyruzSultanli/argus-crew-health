// Band edges for every rule (doc 14 §2): value exactly at the threshold and ±1 display unit.
import { describe, expect, it } from 'vitest';

import { ctx, obs, series } from '../__tests__/fixtures';
import type { DoseLedger, LayerResult, Observation, RuleCtx, SignalId, Verdict } from '../types';
import { exerciseWindow } from './exerciseMinutes';
import { SIGNALS } from './index';

type Layer = 'earth' | 'space';

function judge(id: SignalId, layer: Layer, o: Observation, partial: Partial<RuleCtx> = {}): LayerResult {
  const c = ctx({ history: [o], ...partial });
  return SIGNALS[id][layer](o, c);
}

/** Single-value rule: value → verdict, for the given layers. */
function edges(
  id: SignalId,
  layers: Layer[],
  table: Array<[number, Verdict]>,
  extra: Partial<Observation> = {},
) {
  for (const layer of layers) {
    it.each(table)(`${id} ${layer}: %s → %s`, (value, expected) => {
      expect(judge(id, layer, obs(id, value, 143, extra)).verdict).toBe(expected);
    });
  }
}

/** Mean-window rule: the same value on each day of the window. */
function windowEdges(
  id: SignalId,
  layers: Layer[],
  nDays: number,
  table: Array<[number, Verdict]>,
  partial: Partial<RuleCtx> = {},
) {
  for (const layer of layers) {
    it.each(table)(`${id} ${layer} (${nDays}-day mean): %s → %s`, (value, expected) => {
      const days = Array.from({ length: nDays }, (_, i): [number, number] => [143 - nDays + 1 + i, value]);
      const hist = series(id, days);
      const last = hist.at(-1) as Observation;
      expect(SIGNALS[id][layer](last, ctx({ history: hist, ...partial })).verdict).toBe(expected);
    });
  }
}

describe('heart_rate_rest (doc 07 §4.1)', () => {
  edges(
    'heart_rate_rest',
    ['earth', 'space'],
    [
      [39, 'ACT'],
      [40, 'WATCH'],
      [41, 'WATCH'],
      [48, 'WATCH'],
      [49, 'WATCH'],
      [50, 'NOMINAL'],
      [51, 'NOMINAL'],
      [99, 'NOMINAL'],
      [100, 'NOMINAL'],
      [101, 'WATCH'],
      [129, 'WATCH'],
      [130, 'WATCH'],
      [131, 'ACT'],
      // rounding to integer first
      [39.4, 'ACT'],
      [39.5, 'WATCH'],
      [100.4, 'NOMINAL'],
      [100.5, 'WATCH'],
      [130.4, 'WATCH'],
      [130.5, 'ACT'],
    ],
  );
  it('null value → NO_DATA', () => {
    expect(judge('heart_rate_rest', 'earth', obs('heart_rate_rest', null, 143)).verdict).toBe('NO_DATA');
    expect(judge('heart_rate_rest', 'space', obs('heart_rate_rest', null, 143)).verdict).toBe('NO_DATA');
  });
  it('cites the real source and the demo bands', () => {
    const r = judge('heart_rate_rest', 'earth', obs('heart_rate_rest', 70, 143));
    expect(r.sourceIds).toEqual(['SRC_EARTH_VITALS_GENERAL', 'SRC_DEMO_RULE_BANDS']);
    expect(r.reason).toBe('70 bpm is within 50–100 bpm.');
    expect(judge('heart_rate_rest', 'space', obs('heart_rate_rest', 70, 143)).sourceIds).toEqual([
      'SRC_NASA_RISKS',
      'SRC_DEMO_RULE_BANDS',
    ]);
  });
});

describe('blood_pressure (doc 07 §4.2)', () => {
  const bp = (s: number, d: number) =>
    obs('blood_pressure', null, 143, { components: { systolic: s, diastolic: d } });
  const systolic: Array<[number, Verdict]> = [
    [179, 'WATCH'],
    [180, 'WATCH'],
    [181, 'ACT'],
    [129, 'NOMINAL'],
    [130, 'WATCH'],
    [131, 'WATCH'],
    [89, 'WATCH'],
    [90, 'NOMINAL'],
    [91, 'NOMINAL'],
  ];
  const diastolic: Array<[number, Verdict]> = [
    [119, 'WATCH'],
    [120, 'WATCH'],
    [121, 'ACT'],
    [79, 'NOMINAL'],
    [80, 'WATCH'],
    [81, 'WATCH'],
    [59, 'WATCH'],
    [60, 'NOMINAL'],
    [61, 'NOMINAL'],
  ];
  for (const layer of ['earth', 'space'] as const) {
    it.each(systolic)(`${layer} systolic %s (diastolic 70) → %s`, (s, v) => {
      expect(judge('blood_pressure', layer, bp(s, 70)).verdict).toBe(v);
    });
    it.each(diastolic)(`${layer} diastolic %s (systolic 110) → %s`, (d, v) => {
      expect(judge('blood_pressure', layer, bp(110, d)).verdict).toBe(v);
    });
  }
  it('worse component wins; numbers carry both', () => {
    const r = judge('blood_pressure', 'earth', bp(150, 125));
    expect(r.verdict).toBe('ACT');
    expect(r.reason).toContain('Diastolic 125');
    expect(r.numbers).toEqual({ systolic: 150, diastolic: 125 });
  });
  it('nominal reason names both values; low band cites demo', () => {
    const r = judge('blood_pressure', 'earth', bp(118, 76));
    expect(r.reason).toBe('118/76 mmHg is within 90–129 / 60–79 mmHg.');
    expect(r.sourceIds).toContain('SRC_EARTH_BP_ACC_AHA');
    expect(judge('blood_pressure', 'earth', bp(85, 70)).sourceIds).toContain('SRC_DEMO_RULE_BANDS');
    expect(judge('blood_pressure', 'earth', bp(140, 70)).sourceIds).toEqual(['SRC_EARTH_BP_ACC_AHA']);
  });
  it('missing components → NO_DATA', () => {
    expect(judge('blood_pressure', 'earth', obs('blood_pressure', 120, 143)).verdict).toBe('NO_DATA');
  });
});

describe('spo2 (doc 07 §4.3)', () => {
  edges(
    'spo2',
    ['earth', 'space'],
    [
      [89, 'ACT'],
      [90, 'WATCH'],
      [91, 'WATCH'],
      [94, 'WATCH'],
      [95, 'NOMINAL'],
      [96, 'NOMINAL'],
      [89.5, 'WATCH'],
      [94.5, 'NOMINAL'],
    ],
  );
  it('NOMINAL ≥ 95 % cites the source only; the edges below 95 % are [demo]', () => {
    expect(judge('spo2', 'earth', obs('spo2', 97, 143)).sourceIds).toEqual(['SRC_EARTH_VITALS_GENERAL']);
    expect(judge('spo2', 'earth', obs('spo2', 92, 143)).sourceIds).toEqual([
      'SRC_EARTH_VITALS_GENERAL',
      'SRC_DEMO_RULE_BANDS',
    ]);
    expect(judge('spo2', 'earth', obs('spo2', 88, 143)).sourceIds).toEqual([
      'SRC_EARTH_VITALS_GENERAL',
      'SRC_DEMO_RULE_BANDS',
    ]);
    expect(judge('spo2', 'space', obs('spo2', 92, 143)).sourceIds).toContain('SRC_DEMO_RULE_BANDS');
  });
});

describe('body_temp (doc 07 §4.4)', () => {
  edges(
    'body_temp',
    ['earth', 'space'],
    [
      [37.9, 'WATCH'],
      [38.0, 'ACT'],
      [38.1, 'ACT'],
      [37.4, 'NOMINAL'],
      [37.5, 'WATCH'],
      [37.6, 'WATCH'],
      [36.0, 'WATCH'],
      [36.1, 'NOMINAL'],
      [36.2, 'NOMINAL'],
      [34.9, 'ACT'],
      [35.0, 'WATCH'],
      [35.1, 'WATCH'],
      [37.95, 'ACT'],
      [37.44, 'NOMINAL'],
      [36.04, 'WATCH'],
      [36.05, 'NOMINAL'],
    ],
  );
  it('skin temperature is trend-only', () => {
    const o = obs('body_temp', 33, 143, { source: { kind: 'device', method: 'skin', label: 'MEASURED' } });
    expect(judge('body_temp', 'earth', o).verdict).toBe('NO_DATA');
    expect(judge('body_temp', 'space', o).verdict).toBe('NO_DATA');
  });
  it('space cites the core-temperature context source', () => {
    expect(judge('body_temp', 'space', obs('body_temp', 36.6, 143)).sourceIds).toContain(
      'SRC_CORE_TEMP_STAHN',
    );
  });
  it.each([36.6, 37.6, 38.2, 35.5, 34.0])(
    'every band is [demo]: %s °C cites SRC_DEMO_RULE_BANDS',
    (v) => {
      expect(judge('body_temp', 'earth', obs('body_temp', v, 143)).sourceIds).toEqual([
        'SRC_EARTH_VITALS_GENERAL',
        'SRC_DEMO_RULE_BANDS',
      ]);
      expect(judge('body_temp', 'space', obs('body_temp', v, 143)).sourceIds).toContain(
        'SRC_DEMO_RULE_BANDS',
      );
    },
  );
});

describe('glucose (doc 07 §4.5)', () => {
  edges(
    'glucose',
    ['earth', 'space'],
    [
      [125, 'WATCH'],
      [126, 'ACT'],
      [127, 'ACT'],
      [99, 'NOMINAL'],
      [100, 'WATCH'],
      [101, 'WATCH'],
      [69, 'WATCH'],
      [70, 'NOMINAL'],
      [71, 'NOMINAL'],
      [53, 'ACT'],
      [54, 'WATCH'],
      [55, 'WATCH'],
    ],
    { context: { glucose: 'fasting' } },
  );
  const randomTable: Array<[number, Verdict]> = [
    [199, 'WATCH'],
    [200, 'ACT'],
    [201, 'ACT'],
    [139, 'NOMINAL'],
    [140, 'WATCH'],
    [141, 'WATCH'],
    [69, 'WATCH'],
    [70, 'NOMINAL'],
    [71, 'NOMINAL'],
    [53, 'ACT'],
    [54, 'WATCH'],
    [55, 'WATCH'],
  ];
  edges('glucose', ['earth', 'space'], randomTable, { context: { glucose: 'random' } });
  edges('glucose', ['earth'], randomTable, { context: { glucose: 'post-meal' } });
  edges('glucose', ['earth'], randomTable);
  it('missing context is judged as random and says so', () => {
    const r = judge('glucose', 'earth', obs('glucose', 150, 143));
    expect(r.reason).toContain('judged as random');
    expect(r.sourceIds).toContain('SRC_DEMO_RULE_BANDS');
  });
  it('fasting ACT asks to repeat to confirm', () => {
    expect(
      judge('glucose', 'earth', obs('glucose', 130, 143, { context: { glucose: 'fasting' } })).reason,
    ).toContain('repeat to confirm');
  });
  it('null value → NO_DATA', () => {
    expect(judge('glucose', 'space', obs('glucose', null, 143)).verdict).toBe('NO_DATA');
  });
});

describe('sleep_duration (doc 07 §4.6) — 3-night mean', () => {
  windowEdges('sleep_duration', ['earth'], 3, [
    [6.9, 'WATCH'],
    [7.0, 'NOMINAL'],
    [7.1, 'NOMINAL'],
    [6.95, 'NOMINAL'],
  ]);
  windowEdges('sleep_duration', ['space'], 3, [
    [4.9, 'ACT'],
    [5.0, 'WATCH'],
    [5.1, 'WATCH'],
    [5.4, 'WATCH'],
    [5.5, 'EXPECTED'],
    [5.6, 'EXPECTED'],
    [6.8, 'EXPECTED'],
    [6.9, 'EXPECTED'],
    [7.0, 'NOMINAL'],
    [7.1, 'NOMINAL'],
  ]);
  const rt = (verdict: Verdict): Partial<RuleCtx> => ({
    sameDay: { reaction_test: { layer: 'space', verdict, reason: 'x', sourceIds: [] } },
  });
  windowEdges(
    'sleep_duration',
    ['space'],
    3,
    [
      [5.4, 'ACT'],
      [5.5, 'EXPECTED'],
      [4.9, 'ACT'],
    ],
    rt('WATCH'),
  );
  windowEdges('sleep_duration', ['space'], 3, [[5.4, 'ACT']], rt('ACT'));
  windowEdges('sleep_duration', ['space'], 3, [[5.4, 'WATCH']], rt('NOMINAL'));

  it('uses the mean of the 3 nights, rounded to 0.1 h', () => {
    const h = series('sleep_duration', [
      [141, 5.0],
      [142, 5.5],
      [143, 6.0],
    ]);
    const r = SIGNALS.sleep_duration.space(h[2] as Observation, ctx({ history: h }));
    expect(r.verdict).toBe('EXPECTED');
    expect(r.numbers).toEqual({ value: 5.5, n: 3 });
    expect(r.reason).toBe('3-night mean 5.5 h is typical in flight; protect your sleep.');
    const e = SIGNALS.sleep_duration.earth(
      h[2] as Observation,
      ctx({
        history: series('sleep_duration', [
          [141, 6.9],
          [142, 7],
          [143, 7],
        ]),
      }),
    );
    expect(e.verdict).toBe('NOMINAL');
  });
  it('skips a missing night and ignores nights outside the window', () => {
    const h = series('sleep_duration', [
      [139, 3.0],
      [141, 6.0],
      [143, 6.4],
    ]);
    const r = SIGNALS.sleep_duration.space(h[2] as Observation, ctx({ history: h }));
    expect(r.numbers).toEqual({ value: 6.2, n: 2 });
  });
  it('the window crosses launch without a day 0', () => {
    const h = series('sleep_duration', [
      [-3, 9.0],
      [-2, 7.0],
      [-1, 7.0],
      [1, 7.0],
    ]);
    const r = SIGNALS.sleep_duration.space(h[3] as Observation, ctx({ missionDay: 1, history: h }));
    expect(r.numbers).toEqual({ value: 7, n: 3 });
  });
  it('reaction flag text and source', () => {
    const h = series('sleep_duration', [
      [141, 5.2],
      [142, 5.2],
      [143, 5.2],
    ]);
    const r = SIGNALS.sleep_duration.space(h[2] as Observation, ctx({ history: h, ...rt('WATCH') }));
    expect(r.reason).toBe('3-night mean 5.2 h is under 5.5 h and today’s Reaction Self-Test is flagged.');
    expect(r.sourceIds).toEqual(['SRC_SLEEP_BARGER', 'SRC_DEMO_RULE_BANDS', 'SRC_PVT_SPINOFF']);
  });
  it('no night in the window → NO_DATA', () => {
    const o = obs('sleep_duration', 6, 143);
    expect(SIGNALS.sleep_duration.space(o, ctx({ history: [obs('sleep_duration', 6, 100)] })).verdict).toBe(
      'NO_DATA',
    );
    expect(SIGNALS.sleep_duration.earth(o, ctx({ history: [] })).verdict).toBe('NO_DATA');
  });
  it('expected shift −0.9 h in flight only', () => {
    const shift = SIGNALS.sleep_duration.personal.expectedShift;
    expect(shift?.({ missionDay: 10, profile: ctx().profile })).toBe(-0.9);
    expect(shift?.({ missionDay: -5, profile: ctx().profile })).toBe(0);
  });
});

describe('mood (doc 07 §4.7) — 3-day mean', () => {
  windowEdges('mood', ['space'], 3, [
    [1.4, 'ACT'],
    [1.5, 'ACT'],
    [1.6, 'WATCH'],
    [2.4, 'WATCH'],
    [2.5, 'WATCH'],
    [2.6, 'NOMINAL'],
  ]);
  it.each([
    [[2, 3, 2], 'WATCH'],
    [[3, 3, 2], 'NOMINAL'],
    [[1, 2, 1], 'ACT'],
    [[2, 2, 1], 'WATCH'],
  ] as Array<[number[], Verdict]>)('ratings %j → %s', (ratings, v) => {
    const h = series(
      'mood',
      ratings.map((r, i): [number, number] => [141 + i, r]),
    );
    expect(SIGNALS.mood.space(h[2] as Observation, ctx({ history: h })).verdict).toBe(v);
  });
  it('earth is n/a; no rating in window → NO_DATA', () => {
    const o = obs('mood', 3, 143);
    expect(SIGNALS.mood.earth(o, ctx({ history: [o] })).verdict).toBe('NO_DATA');
    expect(SIGNALS.mood.space(o, ctx({ history: [] })).verdict).toBe('NO_DATA');
  });
  it('WATCH and ACT use the doc 07 mood action', () => {
    expect(SIGNALS.mood.actions.WATCH?.text).toBe(
      'Tell the CMO. You can ask for a private conference with the flight surgeon.',
    );
    expect(SIGNALS.mood.actions.ACT).toEqual(SIGNALS.mood.actions.WATCH);
  });
});

describe('body_mass (doc 07 §4.8) — loss vs pre-flight 80 kg', () => {
  const pre: Partial<RuleCtx> = { preflight: { median: 80, n: 5 } };
  const table: Array<[number, Verdict]> = [
    [76.8, 'NOMINAL'], // 4 %
    [76.0, 'WATCH'], // 5 %
    [75.2, 'WATCH'], // 6 %
    [72.8, 'WATCH'], // 9 %
    [72.0, 'ACT'], // 10 %
    [71.2, 'ACT'], // 11 %
    [76.4, 'WATCH'], // 4.5 % → 5 %
    [82.0, 'NOMINAL'], // gain
  ];
  for (const layer of ['earth', 'space'] as const) {
    it.each(table)(`${layer}: %s kg → %s`, (kg, v) => {
      expect(judge('body_mass', layer, obs('body_mass', kg, 143), pre).verdict).toBe(v);
    });
  }
  it('no pre-flight median → NO_DATA', () => {
    expect(judge('body_mass', 'earth', obs('body_mass', 70, 143)).verdict).toBe('NO_DATA');
    expect(judge('body_mass', 'space', obs('body_mass', null, 143), pre).verdict).toBe('NO_DATA');
  });
  it('numbers and sources', () => {
    const r = judge('body_mass', 'space', obs('body_mass', 76, 143), pre);
    expect(r.numbers).toEqual({ value: 5, massKg: 76, preflightKg: 80 });
    expect(r.sourceIds).toEqual(['SRC_STD3001_ECLSS', 'SRC_DEMO_RULE_BANDS']);
  });
});

describe('reaction_test (doc 07 §4.9) — lapses vs pre-flight median 2', () => {
  const pre: Partial<RuleCtx> = { preflight: { median: 3.6, n: 20, components: { lapses: 2 } } };
  it.each([
    [4, 'NOMINAL'],
    [5, 'WATCH'],
    [6, 'WATCH'],
    [7, 'WATCH'],
    [8, 'ACT'],
    [9, 'ACT'],
  ] as Array<[number, Verdict]>)('%s lapses → %s', (lapses, v) => {
    expect(
      judge('reaction_test', 'space', obs('reaction_test', 3.5, 143, { components: { lapses } }), pre)
        .verdict,
    ).toBe(v);
  });
  it('fractional baseline', () => {
    const p: Partial<RuleCtx> = { preflight: { median: 3.6, n: 4, components: { lapses: 1.5 } } };
    expect(
      judge('reaction_test', 'space', obs('reaction_test', 3.5, 143, { components: { lapses: 4 } }), p)
        .verdict,
    ).toBe('NOMINAL');
    expect(
      judge('reaction_test', 'space', obs('reaction_test', 3.5, 143, { components: { lapses: 5 } }), p)
        .verdict,
    ).toBe('WATCH');
  });
  it('n/a cases', () => {
    expect(judge('reaction_test', 'space', obs('reaction_test', 3.5, 143), pre).verdict).toBe('NO_DATA');
    expect(
      judge('reaction_test', 'space', obs('reaction_test', 3.5, 143, { components: { lapses: 9 } })).verdict,
    ).toBe('NO_DATA');
    expect(judge('reaction_test', 'earth', obs('reaction_test', 3.5, 143)).verdict).toBe('NO_DATA');
  });
});

describe('exercise_minutes (doc 07 §4.14) — 7-day adherence vs 120 min plan', () => {
  windowEdges('exercise_minutes', ['space'], 7, [
    [82.8, 'WATCH'], // 69 %
    [84, 'NOMINAL'], // 70 %
    [85.2, 'NOMINAL'], // 71 %
    [46.8, 'ACT'], // 39 %
    [48, 'WATCH'], // 40 %
    [49.2, 'WATCH'], // 41 %
  ]);
  it('days without a log count as 0: 3 logged days of 120 min in 7 → 43 % → WATCH', () => {
    const h = series('exercise_minutes', [
      [137, 120],
      [140, 120],
      [143, 120],
    ]);
    const r = SIGNALS.exercise_minutes.space(h[2] as Observation, ctx({ history: h }));
    expect(r.verdict).toBe('WATCH');
    expect(r.numbers).toEqual({ value: 43, totalMin: 360, planMin: 120, windowDays: 7, n: 3 });
  });
  it('days outside the 7-day window are ignored', () => {
    const h = series('exercise_minutes', [
      [136, 120],
      [143, 120],
    ]);
    expect(SIGNALS.exercise_minutes.space(h[1] as Observation, ctx({ history: h })).numbers?.value).toBe(14);
  });
  it('early mission: on day 3 the window is days 1–3 (no day 0, no pre-flight days)', () => {
    expect(exerciseWindow(3)).toEqual([3, 2, 1]);
    expect(exerciseWindow(1)).toEqual([1]);
    expect(exerciseWindow(10)).toEqual([10, 9, 8, 7, 6, 5, 4]);
    expect(exerciseWindow(-2)).toEqual([-2, -3, -4, -5, -6, -7, -8]);
    const h = series('exercise_minutes', [
      [-1, 120],
      [1, 120],
      [3, 120],
    ]);
    const r = SIGNALS.exercise_minutes.space(h[2] as Observation, ctx({ missionDay: 3, history: h }));
    expect(r.numbers).toEqual({ value: 67, totalMin: 240, planMin: 120, windowDays: 3, n: 2 });
    expect(r.verdict).toBe('WATCH');
    const full = series('exercise_minutes', [
      [1, 120],
      [2, 120],
      [3, 120],
    ]);
    expect(SIGNALS.exercise_minutes.space(full[2] as Observation, ctx({ history: full })).verdict).toBe(
      'NOMINAL',
    );
  });
  it('pre-flight: the window starts at the first logged day (day −180 with a full-plan log → 100 %)', () => {
    expect(exerciseWindow(-178, -180)).toEqual([-178, -179, -180]);
    expect(exerciseWindow(-2, -180)).toEqual([-2, -3, -4, -5, -6, -7, -8]);
    expect(exerciseWindow(3, -180)).toEqual([3, 2, 1]); // in flight unchanged
    const h = series('exercise_minutes', [[-180, 120]]);
    const r = SIGNALS.exercise_minutes.space(h[0] as Observation, ctx({ missionDay: -180, history: h }));
    expect(r.numbers).toEqual({ value: 100, totalMin: 120, planMin: 120, windowDays: 1, n: 1 });
    expect(r.verdict).toBe('NOMINAL');
  });
  it('no plan / no logs → NO_DATA; earth n/a', () => {
    const o = obs('exercise_minutes', 100, 143);
    const noPlanCrew = { ...ctx().crew!, simulatedBaseline: {} };
    expect(SIGNALS.exercise_minutes.space(o, ctx({ history: [o], crew: noPlanCrew })).verdict).toBe(
      'NO_DATA',
    );
    expect(SIGNALS.exercise_minutes.space(o, ctx({ history: [] })).verdict).toBe('NO_DATA');
    expect(SIGNALS.exercise_minutes.earth(o, ctx({ history: [o] })).verdict).toBe('NO_DATA');
  });
});

describe('hydration (doc 07 §4.13) — 2-day mean', () => {
  windowEdges('hydration', ['earth', 'space'], 2, [
    [1.9, 'WATCH'],
    [2.0, 'NOMINAL'],
    [2.1, 'NOMINAL'],
    [1.94, 'WATCH'],
    [1.95, 'NOMINAL'],
  ]);
  it('mean of two different days', () => {
    const h = series('hydration', [
      [142, 1.8],
      [143, 2.2],
    ]);
    expect(SIGNALS.hydration.space(h[1] as Observation, ctx({ history: h })).verdict).toBe('NOMINAL');
    expect(SIGNALS.hydration.space(h[1] as Observation, ctx({ history: [] })).verdict).toBe('NO_DATA');
  });
});

describe('cabin_co2 (doc 07 §4.18)', () => {
  const co2 = (v: number, avg7d?: number) =>
    obs('cabin_co2', v, 143, avg7d === undefined ? {} : { components: { avg7d } });
  it.each([
    [2.9, 'NOMINAL'],
    [3.0, 'NOMINAL'],
    [3.1, 'WATCH'],
    [6.7, 'WATCH'],
    [6.8, 'ACT'],
    [6.9, 'ACT'],
  ] as Array<[number, Verdict]>)('space 1-h %s (7-day 2.0) → %s', (v, expected) => {
    expect(judge('cabin_co2', 'space', co2(v, 2.0)).verdict).toBe(expected);
  });
  it.each([
    [2.4, 'NOMINAL'],
    [2.5, 'WATCH'],
    [2.6, 'WATCH'],
  ] as Array<[number, Verdict]>)('space 7-day %s (1-h 2.0) → %s', (avg, expected) => {
    expect(judge('cabin_co2', 'space', co2(2.0, avg)).verdict).toBe(expected);
  });
  it.each([
    [3.7, 'NOMINAL'],
    [3.8, 'NOMINAL'],
    [3.9, 'WATCH'],
  ] as Array<[number, Verdict]>)('earth %s → %s', (v, expected) => {
    expect(judge('cabin_co2', 'earth', co2(v)).verdict).toBe(expected);
  });
  it('showcase 3.4 mmHg: Earth NOMINAL, space WATCH ("missed by Earth")', () => {
    expect(judge('cabin_co2', 'earth', co2(3.4, 2.2)).verdict).toBe('NOMINAL');
    const s = judge('cabin_co2', 'space', co2(3.4, 2.2));
    expect(s.verdict).toBe('WATCH');
    expect(s.reason).toContain('NASA-STD-3001 limit');
    expect(s.sourceIds).toEqual(['SRC_STD3001_CO2']);
  });
  it('7-day mean from history daily means when avg7d is absent', () => {
    const h = [
      ...series('cabin_co2', [
        [137, 2.4],
        [138, 2.4],
        [139, 2.4],
        [140, 2.6],
        [141, 2.6],
        [142, 2.6],
      ]),
      obs('cabin_co2', 2.4, 143, {}, 0),
      obs('cabin_co2', 2.8, 143, {}, 60),
    ];
    const last = h.at(-1) as Observation;
    const r = SIGNALS.cabin_co2.space(last, ctx({ history: h }));
    // daily means 2.4 ×3, 2.6 ×3, day 143 mean(2.4, 2.8) = 2.6 → 2.514 → 2.5 → WATCH
    expect(r.verdict).toBe('WATCH');
    expect(r.numbers).toEqual({ last1h: 2.8, avg7d: 2.5 });
    expect(r.sourceIds).toEqual(['SRC_NASA_CO2_PAGE']);
  });
  it('ACT cites the ICES exposure bands and the demo registry; null value → NO_DATA', () => {
    expect(judge('cabin_co2', 'space', co2(7, 2)).sourceIds).toEqual([
      'SRC_STD3001_CO2',
      'SRC_CO2_ICES_LIMITS',
      'SRC_DEMO_RULE_BANDS',
    ]);
    expect(judge('cabin_co2', 'space', co2(3.4, 2)).sourceIds).not.toContain('SRC_DEMO_RULE_BANDS');
    expect(judge('cabin_co2', 'space', obs('cabin_co2', null, 143)).verdict).toBe('NO_DATA');
    expect(judge('cabin_co2', 'earth', obs('cabin_co2', null, 143)).verdict).toBe('NO_DATA');
  });
});

describe('cabin_temp and cabin_humidity (doc 07 §4.19)', () => {
  edges(
    'cabin_temp',
    ['space'],
    [
      [17.9, 'ACT'],
      [18.0, 'WATCH'],
      [18.1, 'WATCH'],
      [19.9, 'WATCH'],
      [20.0, 'NOMINAL'],
      [20.1, 'NOMINAL'],
      [24.9, 'NOMINAL'],
      [25.0, 'NOMINAL'],
      [25.1, 'WATCH'],
      [26.9, 'WATCH'],
      [27.0, 'WATCH'],
      [27.1, 'ACT'],
    ],
  );
  edges(
    'cabin_humidity',
    ['space'],
    [
      [24, 'ACT'],
      [25, 'WATCH'],
      [26, 'WATCH'],
      [29, 'WATCH'],
      [30, 'NOMINAL'],
      [31, 'NOMINAL'],
      [59, 'NOMINAL'],
      [60, 'NOMINAL'],
      [61, 'WATCH'],
      [74, 'WATCH'],
      [75, 'WATCH'],
      [76, 'ACT'],
    ],
  );
  it('earth is n/a; null → NO_DATA', () => {
    expect(judge('cabin_temp', 'earth', obs('cabin_temp', 22, 143)).verdict).toBe('NO_DATA');
    expect(judge('cabin_humidity', 'earth', obs('cabin_humidity', 45, 143)).verdict).toBe('NO_DATA');
    expect(judge('cabin_temp', 'space', obs('cabin_temp', null, 143)).verdict).toBe('NO_DATA');
    expect(judge('cabin_humidity', 'space', obs('cabin_humidity', null, 143)).verdict).toBe('NO_DATA');
  });
  it('temperature bands are verified (no demo), humidity bands are demo', () => {
    expect(judge('cabin_temp', 'space', obs('cabin_temp', 22, 143)).sourceIds).toEqual(['SRC_STD3001_ECLSS']);
    expect(judge('cabin_humidity', 'space', obs('cabin_humidity', 45, 143)).sourceIds).toEqual([
      'SRC_STD3001_ECLSS',
      'SRC_DEMO_RULE_BANDS',
    ]);
  });
});

describe('radiation_dose (doc 07 §4.20)', () => {
  const ledger = (projectedEndMsv: number, spe = 0): DoseLedger => ({
    crewId: 'c3',
    careerPreMissionMsv: 35,
    missionGcrMsv: 100,
    missionSpeMsvModeled: spe,
    totalMsv: 135 + spe,
    pctOfCareerLimit: 0.225,
    projectedEndMsv,
    pctProjected: projectedEndMsv / 600,
    speCurrentEventMsvModeled: spe,
    sourceIds: ['SRC_STD3001_RAD'],
  });
  const o = obs('radiation_dose', 135, 143);
  it.each([
    [474, 'NOMINAL'],
    [480, 'WATCH'],
    [486, 'WATCH'],
    [564, 'WATCH'],
    [570, 'ACT'],
    [576, 'ACT'],
    [477.3, 'NOMINAL'],
    [479.9, 'NOMINAL'],
    [479.94, 'NOMINAL'],
    [479.95, 'WATCH'], // rounds to 480.0
    [480.0, 'WATCH'],
    [569.9, 'WATCH'],
    [570.0, 'ACT'],
  ] as Array<[number, Verdict]>)('projected %s mSv → %s', (p, v) => {
    expect(judge('radiation_dose', 'space', o, { dose: ledger(p) }).verdict).toBe(v);
  });
  it.each([
    [124.99, 'NOMINAL'],
    [125, 'ACT'],
    [125.01, 'ACT'],
    [124.994, 'NOMINAL'],
    [124.995, 'ACT'], // rounds to 125.00
  ] as Array<[number, Verdict]>)('current SPE event %s mSv → %s', (spe, v) => {
    expect(judge('radiation_dose', 'space', o, { dose: ledger(300, spe) }).verdict).toBe(v);
  });
  it('no ledger → NO_DATA; earth n/a', () => {
    expect(judge('radiation_dose', 'space', o).verdict).toBe('NO_DATA');
    expect(judge('radiation_dose', 'earth', o, { dose: ledger(300) }).verdict).toBe('NO_DATA');
  });
  it('numbers and sources', () => {
    const r = judge('radiation_dose', 'space', o, { dose: ledger(498) });
    expect(r.numbers).toEqual({
      totalMsv: 135,
      projectedEndMsv: 498,
      pctProjected: 83,
      speCurrentEventMsv: 0,
    });
    expect(r.sourceIds).toEqual(['SRC_STD3001_RAD', 'SRC_DEMO_RADIATION_MODEL', 'SRC_DEMO_RULE_BANDS']);
  });
});

describe('amsler (doc 07 §4.10)', () => {
  const a = (count: number, day: number, eye: 'left' | 'right', comp?: Record<string, number>) =>
    obs('amsler', count, day, { context: { eye }, ...(comp ? { components: comp } : {}) });
  it('earth: 0 cells NOMINAL, 1 cell WATCH, new central ACT', () => {
    const z = a(0, 90, 'right');
    expect(SIGNALS.amsler.earth(z, ctx({ history: [z] })).verdict).toBe('NOMINAL');
    const one = a(1, 90, 'right', { newCells: 0 });
    expect(SIGNALS.amsler.earth(one, ctx({ history: [one] })).verdict).toBe('WATCH');
    const c = a(3, 90, 'right', { newCells: 1, newCentralCells: 1 });
    expect(SIGNALS.amsler.earth(c, ctx({ history: [c] })).verdict).toBe('ACT');
  });
  it('space: no new cell NOMINAL, 1 new cell WATCH, new central ACT', () => {
    const z = a(2, 120, 'right', { newCells: 0 });
    expect(SIGNALS.amsler.space(z, ctx({ history: [z] })).verdict).toBe('NOMINAL');
    const n = a(2, 120, 'right', { newCells: 1 });
    expect(SIGNALS.amsler.space(n, ctx({ history: [n] })).verdict).toBe('WATCH');
    const c = a(2, 120, 'right', { newCells: 1, newCentralCells: 1 });
    expect(SIGNALS.amsler.space(c, ctx({ history: [c] })).verdict).toBe('ACT');
  });
  it('estimates new cells from the previous map of the same eye; worse eye wins', () => {
    const h = [a(0, 60, 'right'), a(0, 60, 'left'), a(2, 90, 'right'), a(0, 90, 'left')];
    const r = SIGNALS.amsler.space(h[3] as Observation, ctx({ history: h }));
    expect(r.verdict).toBe('WATCH');
    expect(r.reason).toBe('Right eye: 2 new marked cell(s) vs the previous map.');
    const same = [a(2, 60, 'right'), a(2, 90, 'right')];
    expect(SIGNALS.amsler.space(same[1] as Observation, ctx({ history: same })).verdict).toBe('NOMINAL');
  });
  it('no count → NO_DATA; history fallback to the reading itself', () => {
    const n = obs('amsler', null, 90);
    expect(SIGNALS.amsler.earth(n, ctx({ history: [n] })).verdict).toBe('NO_DATA');
    expect(SIGNALS.amsler.earth(a(1, 90, 'left'), ctx({ history: [] })).verdict).toBe('WATCH');
    const unspecified = obs('amsler', 0, 90);
    expect(SIGNALS.amsler.space(unspecified, ctx({ history: [unspecified] })).reason).toBe(
      'Eye: no new marked cells vs the previous map.',
    );
  });
  it('WATCH template carries no protocol (assessSignal adds it only on a space WATCH)', () => {
    expect(SIGNALS.amsler.actions.WATCH).toEqual({
      text: 'Schedule imaging/remote eye exam.',
      kind: 'remeasure',
    });
  });
});

describe('near_acuity (doc 07 §4.11)', () => {
  const na = (v: number, day: number, eye: 'left' | 'right', withGlasses = false) =>
    obs('near_acuity', v, day, { context: { eye, withGlasses } });
  it.each([
    [0.29, 'NOMINAL'],
    [0.3, 'NOMINAL'],
    [0.31, 'WATCH'],
  ] as Array<[number, Verdict]>)('earth %s logMAR → %s', (v, expected) => {
    const o = na(v, 90, 'right');
    expect(SIGNALS.near_acuity.earth(o, ctx({ history: [o] })).verdict).toBe(expected);
  });
  it.each([0.2, 0.4])('earth cut-off is [demo]: %s logMAR cites SRC_DEMO_RULE_BANDS', (v) => {
    const o = na(v, 90, 'right');
    expect(SIGNALS.near_acuity.earth(o, ctx({ history: [o] })).sourceIds).toEqual([
      'SRC_EARTH_ACUITY',
      'SRC_DEMO_RULE_BANDS',
    ]);
  });
  const pre = [na(0, -30, 'right'), na(0, -20, 'right'), na(0.1, -30, 'left')];
  it.each([
    [0.09, true, 'EXPECTED'],
    [0.1, true, 'EXPECTED'],
    [0.11, true, 'EXPECTED'], // doc 07 §4.11 as amended (decision 6): 0.11–0.19 → EXPECTED [demo]
    [0.19, true, 'EXPECTED'],
    [0.11, false, 'EXPECTED'],
    [0.19, false, 'EXPECTED'],
    [0.2, true, 'WATCH'],
    [0.21, false, 'WATCH'],
    [0.05, false, 'NOMINAL'],
    [-0.05, true, 'EXPECTED'],
  ] as Array<[number, boolean, Verdict]>)(
    'space decline %s (glasses %s) → %s',
    (decline, glasses, expected) => {
      const o = na(decline, 90, 'right', glasses);
      expect(SIGNALS.near_acuity.space(o, ctx({ history: [...pre, o] })).verdict).toBe(expected);
    },
  );
  it('pre-flight per eye; falls back to ctx.preflight; worse eye wins', () => {
    const l = na(0.3, 90, 'left');
    const r = na(0.1, 90, 'right');
    const res = SIGNALS.near_acuity.space(r, ctx({ history: [...pre, l, r] }));
    expect(res.verdict).toBe('WATCH'); // left 0.3 − 0.1 = 0.2
    expect(res.reason).toContain('Left eye');
    const only = na(0.25, 90, 'right');
    expect(
      SIGNALS.near_acuity.space(
        only,
        ctx({ history: [only], preflight: { median: 0.1, n: 3, components: { right: 0.0 } } }),
      ).verdict,
    ).toBe('WATCH');
    expect(
      SIGNALS.near_acuity.space(only, ctx({ history: [only], preflight: { median: 0.1, n: 3 } })).verdict,
    ).toBe('EXPECTED'); // 0.25 − 0.10 = 0.15 → EXPECTED since decision 6
    expect(SIGNALS.near_acuity.space(only, ctx({ history: [only] })).verdict).toBe('NO_DATA');
  });
  it('no value → NO_DATA', () => {
    const n = obs('near_acuity', null, 90);
    expect(SIGNALS.near_acuity.earth(n, ctx({ history: [n] })).verdict).toBe('NO_DATA');
    expect(SIGNALS.near_acuity.space(n, ctx({ history: [n] })).verdict).toBe('NO_DATA');
    const u = obs('near_acuity', 0.4, 90);
    expect(SIGNALS.near_acuity.earth(u, ctx({ history: [] })).reason).toContain('Eye:');
  });
});

describe('face_fluid_index (doc 07 §4.12)', () => {
  it('increase in weightlessness → EXPECTED; never WATCH/ACT', () => {
    expect(judge('face_fluid_index', 'space', obs('face_fluid_index', 1.05, 30)).verdict).toBe('EXPECTED');
    expect(judge('face_fluid_index', 'space', obs('face_fluid_index', 1.8, 30)).verdict).toBe('EXPECTED');
    expect(judge('face_fluid_index', 'space', obs('face_fluid_index', 1.0, 30)).verdict).toBe('NOMINAL');
    expect(judge('face_fluid_index', 'space', obs('face_fluid_index', 1.05, -5)).verdict).toBe('NOMINAL');
    const surface = { ...ctx().profile, gravityG: 0.38 };
    expect(
      judge('face_fluid_index', 'space', obs('face_fluid_index', 1.05, 30), { profile: surface }).verdict,
    ).toBe('NOMINAL');
    expect(judge('face_fluid_index', 'space', obs('face_fluid_index', null, 30)).verdict).toBe('NO_DATA');
    expect(judge('face_fluid_index', 'earth', obs('face_fluid_index', 1.05, 30)).verdict).toBe('NO_DATA');
  });
});

describe('hematocrit (doc 07 §4.15)', () => {
  const male = { ...ctx().crew!, sex: 'male' as const };
  it.each([
    [38.4, 'WATCH'],
    [38.5, 'NOMINAL'],
    [50.0, 'NOMINAL'],
    [50.1, 'WATCH'],
  ] as Array<[number, Verdict]>)('earth male %s → %s', (v, e) => {
    expect(judge('hematocrit', 'earth', obs('hematocrit', v, 30), { crew: male }).verdict).toBe(e);
  });
  it.each([
    [34.9, 'WATCH'],
    [35.0, 'NOMINAL'],
    [45.0, 'NOMINAL'],
    [45.1, 'WATCH'],
  ] as Array<[number, Verdict]>)('earth female %s → %s', (v, e) => {
    expect(judge('hematocrit', 'earth', obs('hematocrit', v, 30)).verdict).toBe(e);
  });
  it('lab range printed with the sample overrides; no crew → NO_DATA', () => {
    const o = obs('hematocrit', 46, 30, { components: { refLow: 35, refHigh: 47 } });
    expect(judge('hematocrit', 'earth', o).verdict).toBe('NOMINAL');
    expect(judge('hematocrit', 'earth', obs('hematocrit', 46, 30), { crew: undefined }).verdict).toBe(
      'NO_DATA',
    );
    expect(judge('hematocrit', 'earth', obs('hematocrit', null, 30)).verdict).toBe('NO_DATA');
  });
  const pre: Partial<RuleCtx> = { preflight: { median: 40, n: 3 } };
  it.each([
    [40, 'NOMINAL'], // 0 %
    [39, 'NOMINAL'], // fall
    [40.4, 'EXPECTED'], // 1 %
    [44.8, 'EXPECTED'], // 12 %
    [45.2, 'WATCH'], // 13 %
  ] as Array<[number, Verdict]>)('space %s vs pre-flight 40 → %s', (v, e) => {
    expect(judge('hematocrit', 'space', obs('hematocrit', v, 30), pre).verdict).toBe(e);
  });
  it('space n/a pre-flight, without reference or value', () => {
    expect(judge('hematocrit', 'space', obs('hematocrit', 44, -3), pre).verdict).toBe('NO_DATA');
    expect(judge('hematocrit', 'space', obs('hematocrit', 44, 30)).verdict).toBe('NO_DATA');
    expect(judge('hematocrit', 'space', obs('hematocrit', null, 30), pre).verdict).toBe('NO_DATA');
  });
});

describe('wbc (doc 07 §4.16)', () => {
  edges(
    'wbc',
    ['earth'],
    [
      [3.7, 'WATCH'],
      [3.8, 'NOMINAL'],
      [10.8, 'NOMINAL'],
      [10.9, 'WATCH'],
    ],
  );
  const pre: Partial<RuleCtx> = { preflight: { median: 6, n: 3 } };
  it.each([
    [8.4, 'NOMINAL'], // +40 %
    [8.46, 'WATCH'], // +41 %
    [3.6, 'NOMINAL'], // −40 %
    [3.54, 'WATCH'], // −41 %
  ] as Array<[number, Verdict]>)('space %s vs pre-flight 6.0 → %s', (v, e) => {
    expect(judge('wbc', 'space', obs('wbc', v, 30), pre).verdict).toBe(e);
  });
  it('space n/a pre-flight, without reference or value', () => {
    expect(judge('wbc', 'space', obs('wbc', 9, -3), pre).verdict).toBe('NO_DATA');
    expect(judge('wbc', 'space', obs('wbc', 9, 30)).verdict).toBe('NO_DATA');
    expect(judge('wbc', 'space', obs('wbc', null, 30), pre).verdict).toBe('NO_DATA');
    expect(judge('wbc', 'earth', obs('wbc', null, 30)).verdict).toBe('NO_DATA');
  });
});

describe('symptoms (doc 07 §4.17)', () => {
  it('has no numeric verdict', () => {
    const o = obs('symptoms', 1, 143, { components: { headache: 1 } });
    expect(judge('symptoms', 'earth', o).verdict).toBe('NO_DATA');
    expect(judge('symptoms', 'space', o).verdict).toBe('NO_DATA');
  });
});
