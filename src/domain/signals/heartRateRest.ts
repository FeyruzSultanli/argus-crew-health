// doc 07 §4.1 Resting heart rate — `heart_rate_rest`.
// Observation: value = resting heart rate in /min (bpm). Several readings a day → daily median.
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import type { SignalDef } from '../types';
import { NASA_RISKS, isResult, valueOf } from './common';

// All band edges are [demo] (doc 07 §4.1: "band edges demo").
const HR_BANDS: Band[] = [
  { verdict: 'ACT', max: 40, maxExclusive: true, demo: true, reason: '{v} is below 40 bpm.' },
  { verdict: 'ACT', min: 130, minExclusive: true, demo: true, reason: '{v} is above 130 bpm.' },
  { verdict: 'WATCH', min: 40, max: 49, demo: true, reason: '{v} is in the low 40–49 bpm band.' },
  { verdict: 'WATCH', min: 101, max: 130, demo: true, reason: '{v} is in the high 101–130 bpm band.' },
  { verdict: 'NOMINAL', min: 50, max: 100, demo: true, reason: '{v} is within 50–100 bpm.' },
];

export const HR_EARTH_RULE: BandRule = {
  id: 'heart_rate_rest.earth.bands',
  layer: 'earth',
  precision: 0,
  unit: 'bpm',
  bands: HR_BANDS,
  sourceIds: ['SRC_EARTH_VITALS_GENERAL'],
  nominalReason: '{v} is within 50–100 bpm.',
};

// Space: same bands as Earth; no published in-flight resting-HR rule used [demo].
export const HR_SPACE_RULE: BandRule = {
  ...HR_EARTH_RULE,
  id: 'heart_rate_rest.space.bands',
  layer: 'space',
  sourceIds: [NASA_RISKS],
};

export const heartRateRest: SignalDef = {
  id: 'heart_rate_rest',
  label: 'Resting heart rate',
  shortWhat: 'How many times your heart beats per minute while you sit quietly at rest.',
  whyInSpace:
    'Weightlessness alters circulation; cardiovascular adaptation is a NASA human-research risk. ' +
    'A rise against your own usual rate can matter even when it stays inside the normal Earth range.',
  howToMeasure: [
    'Rest seated (restrained) and quiet before you measure.',
    'Use the camera pulse in the Lab, a wearable or a pulse oximeter.',
    'Measure at the same time of day, before exercise.',
    'Enter the reading in beats per minute.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['heart'],
  system: 'cardio',
  cadenceDays: 1,
  concerningDirection: 'both',
  personal: { enabled: true, params: [{ direction: 'both', sigmaFloor: 2, aggregation: 'daily-median' }] },
  earth: (o) => {
    const v = valueOf(o, 'earth', HR_EARTH_RULE.id);
    return isResult(v) ? v : evaluateBands(HR_EARTH_RULE, v);
  },
  space: (o) => {
    const v = valueOf(o, 'space', HR_SPACE_RULE.id);
    return isResult(v) ? v : evaluateBands(HR_SPACE_RULE, v);
  },
  actions: {
    WATCH: { text: 'Re-measure after 20 min seated rest (camera or wearable).', kind: 'remeasure' },
    ACT: {
      text: 'Tell the CMO. Check temperature and symptoms. Open protocol: Suspected infection / overreaching.',
      kind: 'protocol',
      protocolId: 'suspected-infection',
    },
  },
  sourceIds: [NASA_RISKS, 'SRC_EARTH_VITALS_GENERAL', 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_BASELINE_ENGINE'],
};
