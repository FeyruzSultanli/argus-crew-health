// doc 07 §4.4 Body temperature — `body_temp`.
// Observation: value = body (core/oral/ear) temperature in Cel. Several readings a day → daily max.
// Wearable *skin* temperature must not be judged against these bands; if such a stream is imported it is
// trend-only (observations with source.method === 'skin' get n/a on both rule layers).
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable } from '../rules/layer';
import type { LayerResult, Observation, SignalDef } from '../types';
import { NASA_RISKS, isResult, valueOf } from './common';

// The source gives a normal range of 36.5–37.3 °C; all ARGUS band edges are [demo] (doc 07 §4.4).
const TEMP_BANDS: Band[] = [
  { verdict: 'ACT', min: 38.0, demo: true, reason: '{v} is 38.0 °C or more.' },
  { verdict: 'ACT', max: 35.0, maxExclusive: true, demo: true, reason: '{v} is below 35.0 °C.' },
  { verdict: 'WATCH', min: 37.5, max: 37.9, demo: true, reason: '{v} is in the raised 37.5–37.9 °C band.' },
  { verdict: 'WATCH', min: 35.0, max: 36.0, demo: true, reason: '{v} is in the low 35.0–36.0 °C band.' },
  { verdict: 'NOMINAL', min: 36.1, max: 37.4, demo: true, reason: '{v} is within 36.1–37.4 °C.' },
];

export const TEMP_EARTH_RULE: BandRule = {
  id: 'body_temp.earth.bands',
  layer: 'earth',
  precision: 1,
  unit: '°C',
  bands: TEMP_BANDS,
  sourceIds: ['SRC_EARTH_VITALS_GENERAL'],
  nominalReason: '{v} is within 36.1–37.4 °C.',
};

// Space: same bands as Earth in the demo [demo]; the reported ~1 °C in-flight rise is context only
// [SRC_CORE_TEMP_STAHN], expected shift kept at 0.
export const TEMP_SPACE_RULE: BandRule = {
  ...TEMP_EARTH_RULE,
  id: 'body_temp.space.bands',
  layer: 'space',
  sourceIds: ['SRC_EARTH_VITALS_GENERAL', 'SRC_CORE_TEMP_STAHN', 'SRC_DEMO_RULE_BANDS'],
};

function judge(o: Observation, rule: BandRule): LayerResult {
  if (o.source.method === 'skin') {
    return notApplicable(rule.layer, 'Skin temperature is shown as a trend only.', `${rule.id}.skin`);
  }
  const v = valueOf(o, rule.layer, rule.id);
  return isResult(v) ? v : evaluateBands(rule, v);
}

export const bodyTemp: SignalDef = {
  id: 'body_temp',
  label: 'Body temperature',
  shortWhat: 'Your body (core) temperature, taken with an oral or ear thermometer.',
  whyInSpace:
    'Resting core body temperature was reported about 1 °C higher on the ISS, developing over about ' +
    '2.5 months. ARGUS shows this as context and does not shift your reference.',
  howToMeasure: [
    'Use the same device and site (mouth or ear) each time.',
    'Note if you measured after exercise.',
    'Wearable skin temperature is not body temperature; it is shown as a trend only.',
  ],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['skin'],
  system: 'metabolic',
  cadenceDays: 1,
  concerningDirection: 'up',
  // Do not enable an expected shift in the demo (doc 07 §4.4).
  personal: { enabled: true, params: [{ direction: 'up', sigmaFloor: 0.2, aggregation: 'daily-max' }] },
  earth: (o) => judge(o, TEMP_EARTH_RULE),
  space: (o) => judge(o, TEMP_SPACE_RULE),
  actions: {},
  sourceIds: [
    'SRC_EARTH_VITALS_GENERAL',
    'SRC_CORE_TEMP_STAHN',
    'SRC_DEMO_RULE_BANDS',
    'SRC_DEMO_BASELINE_ENGINE',
  ],
};
