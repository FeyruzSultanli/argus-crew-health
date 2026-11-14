// doc 07 §4.2 Blood pressure — `blood_pressure`.
// Observation: components { systolic, diastolic } in mm[Hg]; `value` is not used (may be null).
// Several readings a day → daily median per component.
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable, worstOf } from '../rules/layer';
import type { LayerId, LayerResult, Observation, SignalDef } from '../types';
import { NASA_RISKS } from './common';

const BP_SOURCE = 'SRC_EARTH_BP_ACC_AHA';

// ACC/AHA categories [verified]; the low edges (< 90 / < 60) are [demo]. "Normal" and "elevated" are merged
// into NOMINAL (say so in the source drawer).
const SYSTOLIC_BANDS: Band[] = [
  { verdict: 'ACT', min: 180, minExclusive: true, reason: 'Systolic {v} is above 180 mmHg.' },
  { verdict: 'WATCH', min: 130, max: 180, reason: 'Systolic {v} is in the 130–180 mmHg band.' },
  {
    verdict: 'WATCH',
    max: 90,
    maxExclusive: true,
    demo: true,
    reason: 'Systolic {v} is below 90 mmHg (low).',
  },
];
const DIASTOLIC_BANDS: Band[] = [
  { verdict: 'ACT', min: 120, minExclusive: true, reason: 'Diastolic {v} is above 120 mmHg.' },
  { verdict: 'WATCH', min: 80, max: 120, reason: 'Diastolic {v} is in the 80–120 mmHg band.' },
  {
    verdict: 'WATCH',
    max: 60,
    maxExclusive: true,
    demo: true,
    reason: 'Diastolic {v} is below 60 mmHg (low).',
  },
];

function rule(layer: LayerId, component: 'systolic' | 'diastolic', extraSources: string[]): BandRule {
  return {
    id: `blood_pressure.${layer}.${component}`,
    layer,
    precision: 0,
    unit: 'mmHg',
    bands: component === 'systolic' ? SYSTOLIC_BANDS : DIASTOLIC_BANDS,
    sourceIds: [BP_SOURCE, ...extraSources],
    nominalReason:
      component === 'systolic'
        ? 'Systolic {v} is within 90–129 mmHg.'
        : 'Diastolic {v} is within 60–79 mmHg.',
  };
}

export const BP_RULES = {
  earth: { systolic: rule('earth', 'systolic', []), diastolic: rule('earth', 'diastolic', []) },
  // Space: same bands [demo]; context fluid shift / orthostatic intolerance [SRC_NASA_RISKS].
  space: {
    systolic: rule('space', 'systolic', [NASA_RISKS, 'SRC_DEMO_RULE_BANDS']),
    diastolic: rule('space', 'diastolic', [NASA_RISKS, 'SRC_DEMO_RULE_BANDS']),
  },
} as const;

function evaluateBp(o: Observation, layer: 'earth' | 'space'): LayerResult {
  const sys = o.components?.systolic;
  const dia = o.components?.diastolic;
  if (typeof sys !== 'number' || typeof dia !== 'number') {
    return notApplicable(layer, 'This reading has no systolic/diastolic pair.', `blood_pressure.${layer}.na`);
  }
  const s = evaluateBands(BP_RULES[layer].systolic, sys);
  const d = evaluateBands(BP_RULES[layer].diastolic, dia);
  const worst = worstOf([s, d]);
  const systolic = s.numbers?.value ?? sys;
  const diastolic = d.numbers?.value ?? dia;
  const reason =
    worst.verdict === 'NOMINAL'
      ? `${systolic}/${diastolic} mmHg is within 90–129 / 60–79 mmHg.`
      : worst.reason;
  return { ...worst, reason, numbers: { systolic, diastolic } };
}

export const bloodPressure: SignalDef = {
  id: 'blood_pressure',
  label: 'Blood pressure',
  shortWhat:
    'The pressure in your arteries when the heart beats (systolic) and between beats (diastolic), in mmHg.',
  whyInSpace:
    'In weightlessness body fluid shifts toward the head. On return to gravity, keeping blood pressure up ' +
    'when standing can be hard (orthostatic intolerance).',
  howToMeasure: [
    'Rest 5 min seated (restrained in microgravity).',
    'Support the arm at heart level and use the correct cuff size.',
    'Do not talk during the reading.',
    'Take 2 readings 1 min apart and enter the average.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['heart', 'vessels'],
  system: 'cardio',
  cadenceDays: 7,
  concerningDirection: 'up',
  personal: {
    enabled: true,
    params: [
      { direction: 'up', sigmaFloor: 5, aggregation: 'daily-median', component: 'systolic' },
      { direction: 'up', sigmaFloor: 4, aggregation: 'daily-median', component: 'diastolic' },
    ],
  },
  earth: (o) => evaluateBp(o, 'earth'),
  space: (o) => evaluateBp(o, 'space'),
  actions: {
    WATCH: { text: 'Re-measure twice, 1 min apart, seated, arm at heart level.', kind: 'remeasure' },
    ACT: {
      text: 'Re-measure now; if still above 180/120 tell the CMO immediately and notify the flight surgeon.',
      kind: 'tell-cmo',
    },
  },
  sourceIds: [BP_SOURCE, NASA_RISKS, 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_BASELINE_ENGINE'],
};
