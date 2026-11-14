// doc 07 §4.3 Oxygen saturation — `spo2`.
// Observation: value = SpO₂ in %. Several readings a day → daily median.
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import type { SignalDef } from '../types';
import { NASA_RISKS, isResult, valueOf } from './common';

// The source states only "95–100 % is normal"; the band edges below 95 % are [demo] (doc 07 §4.3).
const SPO2_BANDS: Band[] = [
  { verdict: 'ACT', max: 90, maxExclusive: true, demo: true, reason: '{v} is below 90%.' },
  { verdict: 'WATCH', min: 90, max: 94, demo: true, reason: '{v} is in the 90–94% band.' },
  { verdict: 'NOMINAL', min: 95, reason: '{v} is 95% or more.' },
];

export const SPO2_EARTH_RULE: BandRule = {
  id: 'spo2.earth.bands',
  layer: 'earth',
  precision: 0,
  unit: '%',
  bands: SPO2_BANDS,
  sourceIds: ['SRC_EARTH_VITALS_GENERAL'],
  nominalReason: '{v} is 95% or more.',
};

// Space: same bands; context EVA pre-breathe / hypoxia risk [SRC_NASA_RISKS].
export const SPO2_SPACE_RULE: BandRule = {
  ...SPO2_EARTH_RULE,
  id: 'spo2.space.bands',
  layer: 'space',
  sourceIds: ['SRC_EARTH_VITALS_GENERAL', NASA_RISKS],
};

export const spo2: SignalDef = {
  id: 'spo2',
  label: 'Oxygen saturation',
  shortWhat:
    'The share of your blood’s haemoglobin that carries oxygen, read with a fingertip pulse oximeter.',
  whyInSpace:
    'Hypoxia is a NASA human-research risk, and EVA pre-breathe protocols raise mild hypoxia risk. ' +
    'Cabin oxygen is shown in the Environment panel.',
  howToMeasure: [
    'Warm your finger; no nail polish.',
    'Keep still for 30 s.',
    'Read when the number is stable.',
  ],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['lungs'],
  system: 'cardio',
  cadenceDays: 7,
  concerningDirection: 'down',
  personal: { enabled: true, params: [{ direction: 'down', sigmaFloor: 1, aggregation: 'daily-median' }] },
  earth: (o) => {
    const v = valueOf(o, 'earth', SPO2_EARTH_RULE.id);
    return isResult(v) ? v : evaluateBands(SPO2_EARTH_RULE, v);
  },
  space: (o) => {
    const v = valueOf(o, 'space', SPO2_SPACE_RULE.id);
    return isResult(v) ? v : evaluateBands(SPO2_SPACE_RULE, v);
  },
  actions: {},
  sourceIds: ['SRC_EARTH_VITALS_GENERAL', NASA_RISKS, 'SRC_DEMO_BASELINE_ENGINE'],
};
