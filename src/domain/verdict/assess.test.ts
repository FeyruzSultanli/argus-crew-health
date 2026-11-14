// assessSignal() — integration of rules + quality + injected personal result, incl. TV-4 of doc 08 §8.
import { describe, expect, it } from 'vitest';

import { FAIR, GOOD, POOR, ctx, layer, obs, series } from '../__tests__/fixtures';
import { median } from '../rules/history';
import { SIGNALS, signalList } from '../signals';
import type { DoseLedger, LayerResult, Observation, PersonalResult, QualityResult, RuleCtx } from '../types';
import { roundTo } from '../units';
import { assessMany, assessSignal, dayObservation, noPersonal } from './assess';
import { ADAPTATION_EXPLANATION, CAUGHT_ONLY_BY_PERSONAL_NOTE, VERDICT_MEANING } from './explain';

const personal = (verdict: LayerResult['verdict'], numbers: Record<string, number> = {}): PersonalResult => ({
  layer: 'personal',
  verdict,
  reason: `personal ${verdict}`,
  sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
  numbers,
  series: [],
});

describe('TV-4 (doc 08 §8): sleep, down direction with expected shift — integration', () => {
  // Pre-flight [7.2, 6.9, 7.5, 7.0, 7.1], floor 0.3 → median 7.1, MAD 0.1, σ = 0.3.
  const PRE = [7.2, 6.9, 7.5, 7.0, 7.1];
  const preObs = series(
    'sleep_duration',
    PRE.map((v, i): [number, number] => [-5 + i, v]),
  );
  const m = median(PRE) as number;
  const mad = median(PRE.map((v) => Math.abs(v - m))) as number;
  const sigma = Math.max(1.4826 * mad, 0.3);
  const shift =
    SIGNALS.sleep_duration.personal.expectedShift?.({ missionDay: 143, profile: ctx().profile }) ?? 0;

  /** Stand-in for the baseline engine on a single in-flight point: z_down, WATCH if z ≥ 2 (a single point never gives ACT). */
  const injected = (mean3: number, withShift: boolean): PersonalResult => {
    const ref = m + (withShift ? shift : 0);
    const z = roundTo((ref - mean3) / sigma, 2);
    return personal(z >= 2 ? 'WATCH' : 'NOMINAL', { ref, sigma, z });
  };

  const assessNights = (night: number, withShift = true) => {
    const nights = series('sleep_duration', [
      [141, night],
      [142, night],
      [143, night],
    ]);
    const all = [...preObs, ...nights];
    const c = ctx({ history: all, preflight: { median: m, n: PRE.length } });
    return assessSignal(SIGNALS.sleep_duration, all, c, injected(night, withShift));
  };

  it('reference: median 7.1, MAD 0.1, σ = 0.3, shift −0.9 → 6.2', () => {
    expect(m).toBe(7.1);
    expect(roundTo(mad, 2)).toBe(0.1);
    expect(sigma).toBe(0.3);
    expect(roundTo(m + shift, 2)).toBe(6.2);
  });

  it('TV-4a: 3-night mean 6.2 → personal NOMINAL, space EXPECTED, Earth WATCH → EXPECTED via adaptation', () => {
    const a = assessNights(6.2);
    expect(a.layers.personal.verdict).toBe('NOMINAL');
    expect(a.layers.personal.numbers?.z).toBe(0);
    expect(a.layers.space.verdict).toBe('EXPECTED');
    expect(a.layers.earth.verdict).toBe('WATCH');
    expect(a.verdict).toBe('EXPECTED');
    expect(a.drivenBy).toEqual(['space']);
    expect(a.explanation).toBe(ADAPTATION_EXPLANATION);
    expect(a.action).toEqual({
      text: 'Known change in space. Keep doing your countermeasures.',
      kind: 'none',
    });
    expect(a.caughtOnlyByPersonal).toBe(false);
  });

  it('TV-4b: 3-night mean 5.3 → z_down 3.0, all three WATCH → WATCH, not caught only by personal', () => {
    const a = assessNights(5.3);
    expect(a.layers.personal.numbers?.z).toBe(3);
    expect(a.layers.personal.verdict).toBe('WATCH');
    expect(a.layers.space.verdict).toBe('WATCH');
    expect(a.layers.earth.verdict).toBe('WATCH');
    expect(a.verdict).toBe('WATCH');
    expect(a.drivenBy).toEqual(['personal', 'space', 'earth']);
    expect(a.caughtOnlyByPersonal).toBe(false);
    expect(a.action.kind).toBe('remeasure');
  });

  it('TV-4c: shift disabled, mean 6.2 → z_down 3.0 → personal WATCH → combined WATCH', () => {
    const a = assessNights(6.2, false);
    expect(a.layers.personal.numbers?.z).toBe(3);
    expect(a.layers.personal.verdict).toBe('WATCH');
    expect(a.layers.space.verdict).toBe('EXPECTED');
    expect(a.verdict).toBe('WATCH');
    expect(a.drivenBy).toEqual(['personal', 'earth']);
  });
});

describe('TV-8 shape (doc 08 §8): personal ACT on an Earth-normal heart rate', () => {
  it('day 143, 69 bpm, injected personal ACT → ACT, drivenBy [personal], caughtOnlyByPersonal', () => {
    const h = series('heart_rate_rest', [
      [141, 63],
      [142, 68],
      [143, 69],
    ]);
    const a = assessSignal(
      SIGNALS.heart_rate_rest,
      h,
      ctx({ history: h }),
      personal('ACT', { z: 5.5, cusum: 11.5 }),
    );
    expect(a.layers.earth.verdict).toBe('NOMINAL');
    expect(a.layers.space.verdict).toBe('NOMINAL');
    expect(a.verdict).toBe('ACT');
    expect(a.drivenBy).toEqual(['personal']);
    expect(a.caughtOnlyByPersonal).toBe(true);
    expect(a.action).toEqual({
      text: 'Tell the CMO. Check temperature and symptoms. Open protocol: Suspected infection / overreaching.',
      kind: 'protocol',
      protocolId: 'suspected-infection',
    });
    expect(a.explanation).toContain(CAUGHT_ONLY_BY_PERSONAL_NOTE);
    expect(a.latest?.value).toBe(69);
    expect(a.crewId).toBe('c3');
    expect(a.missionDay).toBe(143);
  });
});

describe('no data and staleness (FR-SIG-5)', () => {
  it('no observation → NO_DATA, Measure to update', () => {
    const a = assessSignal(SIGNALS.spo2, [], ctx(), noPersonal());
    expect(a.verdict).toBe('NO_DATA');
    expect(a.latest).toBeUndefined();
    expect(a.action).toEqual({ text: 'Measure to update.', kind: 'remeasure' });
    expect(a.explanation).toBe(VERDICT_MEANING.NO_DATA);
    expect(a.quality.label).toBe('poor');
    expect(a.layers.space.verdict).toBe('NO_DATA');
  });
  it('cabin signal without data keeps crewId cabin', () => {
    expect(assessSignal(SIGNALS.cabin_co2, [], ctx({ crew: undefined }), noPersonal()).crewId).toBe('cabin');
  });
  it('older than cadence × 1.5 → verdict kept, action re-measure, explanation notes the age', () => {
    const o = obs('heart_rate_rest', 70, 141);
    const a = assessSignal(SIGNALS.heart_rate_rest, [o], ctx({ history: [o] }), noPersonal());
    expect(a.verdict).toBe('NOMINAL');
    expect(a.action).toEqual({ text: 'Measure to update.', kind: 'remeasure' });
    expect(a.explanation).toContain('2 d old');
    expect((a.quality as QualityResult).stale).toBe('remeasure');
  });
  it('re-measure due keeps a flag action', () => {
    const o = obs('heart_rate_rest', 120, 141);
    const a = assessSignal(SIGNALS.heart_rate_rest, [o], ctx({ history: [o] }), noPersonal());
    expect(a.verdict).toBe('WATCH');
    expect(a.action.text).toBe('Re-measure after 20 min seated rest (camera or wearable).');
  });
  it('older than cadence × 3 → NO_DATA whatever the old reading said', () => {
    const o = obs('heart_rate_rest', 150, 139);
    const a = assessSignal(SIGNALS.heart_rate_rest, [o], ctx({ history: [o] }), personal('ACT'));
    expect(a.layers.earth.verdict).toBe('ACT');
    expect(a.verdict).toBe('NO_DATA');
    expect(a.drivenBy).toEqual([]);
    expect(a.caughtOnlyByPersonal).toBe(false);
    expect(a.action.text).toBe('Measure to update.');
    expect(a.explanation).toBe('No recent reading: the last one is 4 d old. Measure to update.');
  });
  it('weekly signal at 10 days is fresh, at 11 days re-measure, at 22 days no data', () => {
    const at = (d: number) => {
      const o = obs('spo2', 97, 143 - d);
      return (assessSignal(SIGNALS.spo2, [o], ctx({ history: [o] }), noPersonal()).quality as QualityResult)
        .stale;
    };
    expect(at(10)).toBe('fresh');
    expect(at(11)).toBe('remeasure');
    expect(at(21)).toBe('remeasure');
    expect(at(22)).toBe('no-data');
  });
  it('observations after ctx.missionDay are ignored', () => {
    const h = [obs('heart_rate_rest', 70, 143), obs('heart_rate_rest', 150, 144)];
    const a = assessSignal(SIGNALS.heart_rate_rest, h, ctx({ history: h }), noPersonal());
    expect(a.verdict).toBe('NOMINAL');
    expect(a.latest?.missionDay).toBe(143);
  });
});

describe('quality (doc 07 §3 steps 6 and 9)', () => {
  it('a poor camera reading alone caps a personal ACT at WATCH with the re-measure action', () => {
    const o = obs('heart_rate_rest', 69, 143, { quality: POOR });
    const a = assessSignal(SIGNALS.heart_rate_rest, [o], ctx({ history: [o] }), personal('ACT'));
    expect(a.verdict).toBe('WATCH');
    expect(a.action).toEqual({ text: 'Reading quality is poor. Re-measure.', kind: 'remeasure' });
  });
  it('a fair reading added to a good one does not weaken the day (best reading quality wins)', () => {
    const h = [
      obs('heart_rate_rest', 69, 143, {}, 0),
      obs('heart_rate_rest', 70, 143, { quality: FAIR }, 30),
    ];
    const a = assessSignal(SIGNALS.heart_rate_rest, h, ctx({ history: h }), personal('ACT'));
    expect(a.quality.label).toBe('good');
    expect(a.verdict).toBe('ACT');
  });
  it('fair-only day softens a personal-only ACT', () => {
    const o = obs('heart_rate_rest', 69, 143, { quality: FAIR });
    expect(assessSignal(SIGNALS.heart_rate_rest, [o], ctx({ history: [o] }), personal('ACT')).verdict).toBe(
      'WATCH',
    );
  });
});

describe('daily aggregation of the judged value', () => {
  it('daily median for heart rate', () => {
    const h = [
      obs('heart_rate_rest', 60, 143, {}, 0),
      obs('heart_rate_rest', 140, 143, {}, 1),
      obs('heart_rate_rest', 70, 143, {}, 2),
    ];
    const a = assessSignal(SIGNALS.heart_rate_rest, h, ctx({ history: h }), noPersonal());
    expect(a.layers.earth.numbers?.value).toBe(70);
    expect(a.verdict).toBe('NOMINAL');
    expect(a.latest?.value).toBe(70);
  });
  it('daily median per blood-pressure component', () => {
    const bp = (s: number, d: number, minute: number) =>
      obs('blood_pressure', null, 143, { components: { systolic: s, diastolic: d } }, minute);
    const h = [bp(120, 70, 0), bp(190, 125, 1), bp(124, 78, 2)];
    const a = assessSignal(SIGNALS.blood_pressure, h, ctx({ history: h }), noPersonal());
    expect(a.layers.earth.numbers).toEqual({ systolic: 124, diastolic: 78 });
    expect(a.verdict).toBe('NOMINAL');
  });
  it('daily max for body temperature', () => {
    const h = [
      obs('body_temp', 36.8, 143, {}, 0),
      obs('body_temp', 38.2, 143, {}, 1),
      obs('body_temp', 37, 143, {}, 2),
    ];
    const a = assessSignal(SIGNALS.body_temp, h, ctx({ history: h }), noPersonal());
    expect(a.verdict).toBe('ACT');
    expect(a.drivenBy).toEqual(['space', 'earth']);
  });
  it('single aggregation takes the latest reading of the day', () => {
    const h = [obs('body_mass', 70, 143, {}, 0), obs('body_mass', 76, 143, {}, 5)];
    expect(dayObservation(SIGNALS.body_mass, h)?.value).toBe(76);
    expect(dayObservation(SIGNALS.body_mass, [])).toBeUndefined();
    expect(dayObservation(SIGNALS.heart_rate_rest, [h[0] as Observation])?.value).toBe(70);
  });
});

describe('special signals', () => {
  const ledger: DoseLedger = {
    crewId: 'c1',
    careerPreMissionMsv: 120,
    missionGcrMsv: 257,
    missionSpeMsvModeled: 0,
    totalMsv: 377,
    pctOfCareerLimit: 0.63,
    projectedEndMsv: 498,
    pctProjected: 0.83,
    speCurrentEventMsvModeled: 0,
    sourceIds: ['SRC_STD3001_RAD'],
  };
  it('radiation_dose is judged from ctx.dose even without observations', () => {
    const a = assessSignal(SIGNALS.radiation_dose, [], ctx({ dose: ledger }), noPersonal());
    expect(a.verdict).toBe('WATCH');
    expect(a.drivenBy).toEqual(['space']);
    expect(a.crewId).toBe('c1');
    expect(a.latest?.source.kind).toBe('derived');
    expect(a.layers.earth.verdict).toBe('NO_DATA');
  });
  it('radiation_dose without a ledger is NO_DATA', () => {
    expect(assessSignal(SIGNALS.radiation_dose, [], ctx(), noPersonal()).verdict).toBe('NO_DATA');
  });
  it('symptoms: fresh checklist → NO_DATA with no action and a plain reason', () => {
    const o = obs('symptoms', 1, 143, { components: { headache: 1 } });
    const a = assessSignal(SIGNALS.symptoms, [o], ctx({ history: [o] }), noPersonal());
    expect(a.verdict).toBe('NO_DATA');
    expect(a.action).toEqual({ text: 'No action needed.', kind: 'none' });
    expect(a.explanation).toBe(
      'No verdict from the rules: Symptoms have no numeric verdict; they feed protocol suggestions.',
    );
  });
  it('noPersonal is a personal NO_DATA layer', () => {
    expect(noPersonal()).toMatchObject({ layer: 'personal', verdict: 'NO_DATA', sourceIds: [] });
    expect(noPersonal('Thin baseline').reason).toBe('Thin baseline');
  });
  it('a LayerResult with the wrong layer id is normalised to personal', () => {
    const o = obs('spo2', 97, 143);
    const a = assessSignal(SIGNALS.spo2, [o], ctx({ history: [o] }), layer('space', 'WATCH'));
    expect(a.layers.personal.layer).toBe('personal');
    expect(a.verdict).toBe('WATCH');
    expect(a.caughtOnlyByPersonal).toBe(true);
  });
});

describe('assessMany: evaluation order fills ctx.sameDay', () => {
  const base: Omit<RuleCtx, 'history' | 'preflight' | 'sameDay'> = {
    missionDay: 143,
    profile: ctx().profile,
    crew: ctx().crew,
  };
  const sleep = series('sleep_duration', [
    [141, 5.2],
    [142, 5.2],
    [143, 5.2],
  ]);
  const pre = series(
    'reaction_test',
    [
      [-21, 3.6],
      [-14, 3.6],
      [-7, 3.6],
    ],
    { components: { lapses: 2 } },
  );

  it('reaction_test WATCH today turns sleep < 5.5 h into ACT', () => {
    const rt = [...pre, obs('reaction_test', 3.2, 143, { components: { lapses: 6 } })];
    const out = assessMany(signalList, base, (def) =>
      def.id === 'reaction_test'
        ? { observations: rt }
        : def.id === 'sleep_duration'
          ? { observations: sleep }
          : undefined,
    );
    expect(out.map((a) => a.signalId)).toEqual(['reaction_test', 'sleep_duration']);
    expect(out[0]?.layers.space.verdict).toBe('WATCH');
    expect(out[1]?.layers.space.verdict).toBe('ACT');
    expect(out[1]?.verdict).toBe('ACT');
  });
  it('a reaction test from another day does not count as same day', () => {
    const rt = [...pre, obs('reaction_test', 3.2, 140, { components: { lapses: 6 } })];
    const out = assessMany(signalList, base, (def) =>
      def.id === 'reaction_test'
        ? { observations: rt }
        : def.id === 'sleep_duration'
          ? { observations: sleep }
          : undefined,
    );
    expect(out[1]?.layers.space.verdict).toBe('WATCH');
  });
  it('uses the given preflight and personal inputs', () => {
    const mass = [obs('body_mass', 72, 143)];
    const out = assessMany([SIGNALS.body_mass], base, () => ({
      observations: mass,
      preflight: { median: 80, n: 5 },
      personal: personal('WATCH'),
    }));
    expect(out[0]?.verdict).toBe('ACT');
    expect(out[0]?.layers.personal.verdict).toBe('WATCH');
  });
});

describe('regression cases', () => {
  it('a poor reading is left out of the day aggregate when a better one exists', () => {
    const h = [
      obs('heart_rate_rest', 70, 143, {}, 0),
      obs('heart_rate_rest', 150, 143, { quality: POOR }, 10),
    ];
    const a = assessSignal(SIGNALS.heart_rate_rest, h, ctx({ history: h }), noPersonal());
    expect(a.layers.earth.numbers?.value).toBe(70);
    expect(a.quality.label).toBe('good');
    expect(a.verdict).toBe('NOMINAL');
    expect(dayObservation(SIGNALS.heart_rate_rest, h)?.value).toBe(70);
  });
  it('all-poor day uses the poor readings and the poor-quality gate fires', () => {
    const h = [
      obs('heart_rate_rest', 150, 143, { quality: POOR }, 0),
      obs('heart_rate_rest', 140, 143, { quality: POOR }, 10),
    ];
    const a = assessSignal(SIGNALS.heart_rate_rest, h, ctx({ history: h }), noPersonal());
    expect(a.layers.earth.numbers?.value).toBe(145);
    expect(a.verdict).toBe('WATCH');
    expect(a.action).toEqual({ text: 'Reading quality is poor. Re-measure.', kind: 'remeasure' });
  });
  it('a fair reading still counts next to a good one (only poor is excluded)', () => {
    const h = [
      obs('heart_rate_rest', 60, 143, {}, 0),
      obs('heart_rate_rest', 80, 143, { quality: FAIR }, 10),
    ];
    expect(dayObservation(SIGNALS.heart_rate_rest, h)?.value).toBe(70);
  });
  it('radiation_dose: a current ctx.dose is judged even with an old observation', () => {
    const ledger: DoseLedger = {
      crewId: 'c3',
      careerPreMissionMsv: 35,
      missionGcrMsv: 250,
      missionSpeMsvModeled: 0,
      totalMsv: 285,
      pctOfCareerLimit: 0.475,
      projectedEndMsv: 500,
      pctProjected: 0.83,
      speCurrentEventMsvModeled: 0,
      sourceIds: ['SRC_STD3001_RAD'],
    };
    const old = obs('radiation_dose', 200, 100);
    const a = assessSignal(
      SIGNALS.radiation_dose,
      [old],
      ctx({ history: [old], dose: ledger }),
      noPersonal(),
    );
    expect(a.verdict).toBe('WATCH');
    expect(a.latest?.missionDay).toBe(143);
    expect(a.latest?.source.kind).toBe('derived');
    expect((a.quality as QualityResult).stale).toBe('fresh');
    // without a ledger the old observation alone is NO_DATA (space rule needs ctx.dose)
    expect(assessSignal(SIGNALS.radiation_dose, [old], ctx({ history: [old] }), noPersonal()).verdict).toBe(
      'NO_DATA',
    );
  });
  describe('amsler vision-change protocol only on a space WATCH (new cells)', () => {
    const a = (count: number, day: number, comp: Record<string, number>, q = GOOD) =>
      obs('amsler', count, day, { context: { eye: 'right' }, components: comp, quality: q });
    it('new cells → space WATCH → protocol vision-change', () => {
      const o = a(2, 90, { newCells: 2 });
      const r = assessSignal(SIGNALS.amsler, [o], ctx({ missionDay: 90, history: [o] }), noPersonal());
      expect(r.verdict).toBe('WATCH');
      expect(r.action).toEqual({
        text: 'Schedule imaging/remote eye exam.',
        kind: 'protocol',
        protocolId: 'vision-change',
      });
    });
    it('old unchanged cell → Earth-only WATCH → text without protocol', () => {
      const o = a(2, 90, { newCells: 0 });
      const r = assessSignal(SIGNALS.amsler, [o], ctx({ missionDay: 90, history: [o] }), noPersonal());
      expect(r.layers.space.verdict).toBe('NOMINAL');
      expect(r.layers.earth.verdict).toBe('WATCH');
      expect(r.verdict).toBe('WATCH');
      expect(r.action).toEqual({ text: 'Schedule imaging/remote eye exam.', kind: 'remeasure' });
      expect(r.action.protocolId).toBeUndefined();
    });
    it('poor quality keeps the re-measure action without protocol', () => {
      const o = a(2, 90, { newCells: 2 }, POOR);
      const r = assessSignal(SIGNALS.amsler, [o], ctx({ missionDay: 90, history: [o] }), noPersonal());
      expect(r.action).toEqual({ text: 'Reading quality is poor. Re-measure.', kind: 'remeasure' });
    });
  });
  it('caught-only-by-personal wording is neutral about EXPECTED / n/a layers', () => {
    expect(CAUGHT_ONLY_BY_PERSONAL_NOTE).toBe(
      'Only your personal baseline caught this; the Earth and space rules do not flag it.',
    );
    expect(CAUGHT_ONLY_BY_PERSONAL_NOTE).not.toMatch(/normal value/);
    const h = series('sleep_duration', [
      [141, 6.0],
      [142, 6.0],
      [143, 7.2],
    ]);
    const r = assessSignal(SIGNALS.sleep_duration, h, ctx({ history: h }), personal('WATCH'));
    expect(r.layers.space.verdict).toBe('EXPECTED');
    expect(r.layers.earth.verdict).toBe('WATCH');
    expect(r.caughtOnlyByPersonal).toBe(false);
    const s = series('sleep_duration', [
      [141, 7.2],
      [142, 7.2],
      [143, 7.2],
    ]);
    const r2 = assessSignal(SIGNALS.sleep_duration, s, ctx({ history: s }), personal('WATCH'));
    expect(r2.caughtOnlyByPersonal).toBe(true);
    expect(r2.explanation).toContain('do not flag it');
  });
});
