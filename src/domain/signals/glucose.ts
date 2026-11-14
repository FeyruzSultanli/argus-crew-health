// doc 07 §4.5 Blood glucose — `glucose`.
// Observation: value = glucose in mg/dL; context.glucose = 'fasting' | 'random' | 'post-meal'.
// Missing context is judged with the random/post-meal bands (the less strict set) and the reason says so.
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import type { LayerId, LayerResult, Observation, SignalDef } from '../types';
import { NASA_RISKS, isResult, valueOf } from './common';

const ADA = 'SRC_EARTH_GLUCOSE_ADA';

const FASTING_BANDS: Band[] = [
  { verdict: 'ACT', min: 126, reason: 'Fasting {v} is 126 mg/dL or more (repeat to confirm).' },
  { verdict: 'ACT', max: 54, maxExclusive: true, reason: 'Fasting {v} is below 54 mg/dL.' },
  { verdict: 'WATCH', min: 100, max: 125, reason: 'Fasting {v} is in the 100–125 mg/dL band.' },
  { verdict: 'WATCH', min: 54, max: 69, reason: 'Fasting {v} is in the low 54–69 mg/dL band.' },
  { verdict: 'NOMINAL', min: 70, max: 99, reason: 'Fasting {v} is within 70–99 mg/dL.' },
];

// The 140–199 band reuses the source's 2-hour tolerance-test range as a [demo] choice.
const RANDOM_BANDS: Band[] = [
  { verdict: 'ACT', min: 200, reason: '{v} is 200 mg/dL or more.' },
  { verdict: 'ACT', max: 54, maxExclusive: true, reason: '{v} is below 54 mg/dL.' },
  { verdict: 'WATCH', min: 140, max: 199, demo: true, reason: '{v} is in the 140–199 mg/dL band.' },
  { verdict: 'WATCH', min: 54, max: 69, reason: '{v} is in the low 54–69 mg/dL band.' },
  { verdict: 'NOMINAL', min: 70, max: 139, reason: '{v} is within 70–139 mg/dL.' },
];

function rule(layer: LayerId, fasting: boolean): BandRule {
  return {
    id: `glucose.${layer}.${fasting ? 'fasting' : 'random'}`,
    layer,
    precision: 0,
    unit: 'mg/dL',
    bands: fasting ? FASTING_BANDS : RANDOM_BANDS,
    // Space: same bands [demo]; context diet/inactivity and the CSA Earth-research link [SRC_CSA_WHY_SCIENCE].
    sourceIds: layer === 'earth' ? [ADA] : [ADA, 'SRC_CSA_WHY_SCIENCE', 'SRC_DEMO_RULE_BANDS'],
    nominalReason: fasting ? 'Fasting {v} is within 70–99 mg/dL.' : '{v} is within 70–139 mg/dL.',
  };
}

export const GLUCOSE_RULES = {
  earth: { fasting: rule('earth', true), random: rule('earth', false) },
  space: { fasting: rule('space', true), random: rule('space', false) },
} as const;

function judge(o: Observation, layer: 'earth' | 'space'): LayerResult {
  const fasting = o.context?.glucose === 'fasting';
  const r = fasting ? GLUCOSE_RULES[layer].fasting : GLUCOSE_RULES[layer].random;
  const v = valueOf(o, layer, r.id);
  if (isResult(v)) return v;
  const result = evaluateBands(r, v);
  if (o.context?.glucose === undefined) {
    return { ...result, reason: `${result.reason} No fasting state given; judged as random.` };
  }
  return result;
}

export const glucose: SignalDef = {
  id: 'glucose',
  label: 'Blood glucose',
  shortWhat:
    'The sugar level in your blood from a fingerstick, in mg/dL, noted as fasting, random or after a meal.',
  whyInSpace:
    'Diet and activity change in flight, and inadequate food and nutrition is a NASA human-research risk. ' +
    'Space findings also help Earth research on Type-2 diabetes.',
  howToMeasure: [
    'Wash and dry your hands.',
    'Use the lancet on the side of a fingertip.',
    'Put the first drop on the strip.',
    'Note whether you are fasting or not.',
  ],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['pancreas_liver'],
  system: 'metabolic',
  cadenceDays: 14,
  concerningDirection: 'both',
  // Personal layer: fasting readings only (the baseline engine filters on o.context.glucose === 'fasting').
  personal: { enabled: true, params: [{ direction: 'both', sigmaFloor: 5, aggregation: 'single' }] },
  earth: (o) => judge(o, 'earth'),
  space: (o) => judge(o, 'space'),
  actions: {},
  sourceIds: [ADA, 'SRC_CSA_WHY_SCIENCE', NASA_RISKS, 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_BASELINE_ENGINE'],
};
