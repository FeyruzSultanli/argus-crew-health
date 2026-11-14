// Manual vitals validation at every doc 06 §3 range edge, systolic ≤ diastolic blocked, unit round-trips,
// and the saved observation shapes.
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  GLUCOSE_MGDL_PER_MMOL,
  type ManualDraft,
  cToF,
  convertEntry,
  displayRange,
  fToC,
  kgToLb,
  lbToKg,
  mgdlToMmol,
  mmolToMgdl,
  parseNumber,
  validateManualDraft,
} from './validation';
import { validateNewObservation } from '../../../services/validation';

const subject = { crewId: 'c3', missionDay: 143 };
const v = (patch: Partial<ManualDraft>) => validateManualDraft({ ...EMPTY_DRAFT, ...patch }, subject);
const ok = (patch: Partial<ManualDraft>) => expect(v(patch).ok, JSON.stringify(v(patch).errors)).toBe(true);
const bad = (patch: Partial<ManualDraft>, key: string) => expect(Object.keys(v(patch).errors)).toContain(key);

describe('unit conversions', () => {
  it('°C ↔ °F, mg/dL ↔ mmol/L (÷ 18.016), kg ↔ lb round-trip', () => {
    expect(GLUCOSE_MGDL_PER_MMOL).toBe(18.016);
    expect(cToF(37)).toBeCloseTo(98.6, 10);
    expect(fToC(98.6)).toBeCloseTo(37, 10);
    expect(fToC(cToF(36.4))).toBeCloseTo(36.4, 10);
    expect(mgdlToMmol(90.08)).toBeCloseTo(5, 10);
    expect(mmolToMgdl(mgdlToMmol(126))).toBeCloseTo(126, 10);
    expect(kgToLb(1)).toBeCloseTo(2.20462262, 7);
    expect(lbToKg(kgToLb(72.5))).toBeCloseTo(72.5, 10);
  });
  it('toggle conversion of the entered text', () => {
    expect(convertEntry('37', 'bodyTemp', 'C', 'F')).toBe('98.6');
    expect(convertEntry('98.6', 'bodyTemp', 'F', 'C')).toBe('37.0');
    expect(convertEntry('90', 'glucose', 'mg/dL', 'mmol/L')).toBe('5.0');
    expect(convertEntry('5.0', 'glucose', 'mmol/L', 'mg/dL')).toBe('90');
    expect(convertEntry('70', 'bodyMass', 'kg', 'lb')).toBe('154.3');
    expect(convertEntry('', 'bodyMass', 'kg', 'lb')).toBe('');
    expect(convertEntry('abc', 'bodyMass', 'kg', 'lb')).toBe('abc');
  });
  it('displays ranges in the unit shown', () => {
    expect(displayRange('bodyTemp', 'C')).toBe('30–45 °C');
    expect(displayRange('bodyTemp', 'F')).toBe('86.0–113.0 °F');
    expect(displayRange('glucose', 'mmol/L')).toBe('1.1–33.3 mmol/L');
    expect(displayRange('bodyMass', 'lb')).toBe('66.1–440.9 lb');
    expect(displayRange('heartRate')).toBe('25–220 bpm');
  });
});

describe('parseNumber', () => {
  it('empty → null, comma decimal, junk → NaN', () => {
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('36,6')).toBe(36.6);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1e3')).toBeNaN();
    expect(parseNumber('12abc')).toBeNaN();
  });
});

describe('validateManualDraft — doc 06 §3 range edges', () => {
  it('heart rate 25–220', () => {
    ok({ heartRate: '25' });
    ok({ heartRate: '220' });
    bad({ heartRate: '24.9' }, 'heartRate');
    bad({ heartRate: '221' }, 'heartRate');
    expect(v({ heartRate: '221' }).errors.heartRate).toBe('Heart rate must be between 25–220 bpm.');
  });
  it('blood pressure sys 60–260, dia 30–160', () => {
    ok({ systolic: '60', diastolic: '30' });
    ok({ systolic: '260', diastolic: '160' });
    bad({ systolic: '59', diastolic: '40' }, 'systolic');
    bad({ systolic: '261', diastolic: '80' }, 'systolic');
    bad({ systolic: '120', diastolic: '29' }, 'diastolic');
    bad({ systolic: '200', diastolic: '161' }, 'diastolic');
  });
  it('systolic ≤ diastolic is blocked with a clear message', () => {
    const r = v({ systolic: '80', diastolic: '90' });
    expect(r.ok).toBe(false);
    expect(r.observations).toEqual([]);
    expect(r.errors.bloodPressure).toBe('Systolic (80) must be higher than diastolic (90). Check the order of the two numbers.');
    bad({ systolic: '90', diastolic: '90' }, 'bloodPressure');
    ok({ systolic: '91', diastolic: '90' });
    expect(v({ systolic: '120' }).errors.bloodPressure).toBe('Blood pressure: enter both systolic and diastolic.');
  });
  it('SpO₂ 50–100', () => {
    ok({ spo2: '50' });
    ok({ spo2: '100' });
    bad({ spo2: '49' }, 'spo2');
    bad({ spo2: '100.1' }, 'spo2');
  });
  it('temperature 30–45 °C, also when entered in °F', () => {
    ok({ bodyTemp: '30' });
    ok({ bodyTemp: '45' });
    bad({ bodyTemp: '29.9' }, 'bodyTemp');
    bad({ bodyTemp: '45.1' }, 'bodyTemp');
    ok({ bodyTemp: '86', tempUnit: 'F' });
    ok({ bodyTemp: '113', tempUnit: 'F' });
    bad({ bodyTemp: '85.9', tempUnit: 'F' }, 'bodyTemp');
    bad({ bodyTemp: '113.1', tempUnit: 'F' }, 'bodyTemp');
    expect(v({ bodyTemp: '120', tempUnit: 'F' }).errors.bodyTemp).toBe('Temperature must be between 86.0–113.0 °F.');
  });
  it('glucose 20–600 mg/dL, also in mmol/L, and needs a context', () => {
    ok({ glucose: '20', glucoseContext: 'fasting' });
    ok({ glucose: '600', glucoseContext: 'random' });
    bad({ glucose: '19', glucoseContext: 'fasting' }, 'glucose');
    bad({ glucose: '601', glucoseContext: 'fasting' }, 'glucose');
    ok({ glucose: '1.11', glucoseUnit: 'mmol/L', glucoseContext: 'post-meal' }); // 19.998 → 20.0 mg/dL
    ok({ glucose: '33.3', glucoseUnit: 'mmol/L', glucoseContext: 'fasting' });
    bad({ glucose: '1.10', glucoseUnit: 'mmol/L', glucoseContext: 'fasting' }, 'glucose');
    bad({ glucose: '33.4', glucoseUnit: 'mmol/L', glucoseContext: 'fasting' }, 'glucose');
    expect(v({ glucose: '95' }).errors.glucoseContext).toBe('Glucose: choose fasting, random or post-meal.');
  });
  it('body mass 30–200 kg, also in lb', () => {
    ok({ bodyMass: '30' });
    ok({ bodyMass: '200' });
    bad({ bodyMass: '29.9' }, 'bodyMass');
    bad({ bodyMass: '200.1' }, 'bodyMass');
    ok({ bodyMass: '66.14', massUnit: 'lb' });
    ok({ bodyMass: '440.92', massUnit: 'lb' });
    bad({ bodyMass: '66.1', massUnit: 'lb' }, 'bodyMass');
    bad({ bodyMass: '441', massUnit: 'lb' }, 'bodyMass');
  });
  it('sleep 0–16 h, quality 1–5 needs hours', () => {
    ok({ sleepHours: '0' });
    ok({ sleepHours: '16' });
    bad({ sleepHours: '-0.5' }, 'sleepHours');
    bad({ sleepHours: '16.5' }, 'sleepHours');
    ok({ sleepHours: '6.5', sleepQuality: 1 });
    ok({ sleepHours: '6.5', sleepQuality: 5 });
    bad({ sleepHours: '6.5', sleepQuality: 0 }, 'sleepQuality');
    bad({ sleepHours: '6.5', sleepQuality: 6 }, 'sleepQuality');
    bad({ sleepQuality: 3 }, 'sleepQuality');
  });
  it('mood 1–5; a note needs a mood', () => {
    ok({ mood: 1 });
    ok({ mood: 5 });
    bad({ mood: 0 }, 'mood');
    bad({ mood: 6 }, 'mood');
    bad({ mood: 2.5 }, 'mood');
    bad({ moodNote: 'long shift' }, 'moodNote');
  });
  it('non-numbers, empty form, negative exercise minutes', () => {
    expect(v({ heartRate: 'sixty' }).errors.heartRate).toBe('Heart rate: enter a number.');
    expect(v({}).errors.form).toBe('Enter at least one value to save.');
    bad({ heartRate: '60', minutesSinceExercise: '-5' }, 'minutesSinceExercise');
  });
});

describe('validateManualDraft — observations', () => {
  it('builds one observation per entered signal with canonical units and context', () => {
    const r = v({
      systolic: '118',
      diastolic: '76',
      heartRate: '58',
      spo2: '98',
      bodyTemp: '98.6',
      tempUnit: 'F',
      glucose: '5.0',
      glucoseUnit: 'mmol/L',
      glucoseContext: 'fasting',
      bodyMass: '154.3',
      massUnit: 'lb',
      sleepHours: '6.5',
      sleepQuality: 3,
      mood: 4,
      moodNote: '  one line about today ',
      symptoms: ['headache', 'fatigue'],
      posture: 'seated',
      minutesSinceExercise: '20',
    });
    expect(r.ok).toBe(true);
    const by = Object.fromEntries(r.observations.map((o) => [o.signalId, o]));
    expect(r.observations.map((o) => o.signalId)).toEqual([
      'blood_pressure',
      'heart_rate_rest',
      'spo2',
      'body_temp',
      'glucose',
      'body_mass',
      'sleep_duration',
      'mood',
      'symptoms',
    ]);
    for (const o of r.observations) {
      expect(o).toMatchObject({ crewId: 'c3', missionDay: 143, source: { kind: 'manual', label: 'MEASURED' }, quality: { score: 1, label: 'good', reasons: [] } });
    }
    expect(by.blood_pressure).toMatchObject({ value: null, unit: 'mm[Hg]', components: { systolic: 118, diastolic: 76 }, context: { posture: 'seated' }, note: 'Time since exercise: 20 min' });
    expect(by.heart_rate_rest).toMatchObject({ value: 58, unit: '/min' });
    expect(by.spo2).toMatchObject({ value: 98, unit: '%' });
    expect(by.body_temp).toMatchObject({ value: 37, unit: 'Cel' });
    expect(by.glucose).toMatchObject({ value: 90.1, unit: 'mg/dL', context: { glucose: 'fasting' } });
    expect(by.body_mass).toMatchObject({ value: 69.99, unit: 'kg' });
    expect(by.sleep_duration).toMatchObject({ value: 6.5, unit: 'h', components: { quality: 3 } });
    expect(by.mood).toMatchObject({ value: 4, unit: '{score}', note: 'one line about today' });
    expect(by.symptoms).toEqual(
      expect.objectContaining({
        value: null,
        unit: '1',
        components: { headache: 1, congestion: 0, nausea: 0, rash: 0, back_pain: 0, vision_change: 0, insomnia: 0, low_mood: 0, fatigue: 1 },
      }),
    );
  });
  it('"No symptoms" saves all nine at 0; nothing ticked saves no symptoms observation', () => {
    const none = v({ symptomsNone: true }).observations;
    expect(none).toHaveLength(1);
    expect(Object.values(none[0]?.components ?? {})).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(v({ mood: 3 }).observations.map((o) => o.signalId)).toEqual(['mood']);
  });
});

describe('Lab observations pass the data service validator (one symptoms convention)', () => {
  it('symptoms (ticked and "none"), mood and sleep from the check-in are storable as built', () => {
    for (const patch of [
      { symptoms: ['headache', 'fatigue'] as ManualDraft['symptoms'], mood: 4, sleepHours: '6.5' },
      { symptomsNone: true },
    ]) {
      const r = v(patch);
      expect(r.ok).toBe(true);
      for (const o of r.observations) expect(() => validateNewObservation(o)).not.toThrow();
      const sym = r.observations.find((o) => o.signalId === 'symptoms');
      expect(sym?.value).toBeNull();
    }
  });
});
