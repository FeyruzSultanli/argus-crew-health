// doc 07 §4.17 Symptoms — `symptoms` (checklist). No numeric verdict: both rule layers are n/a.
// Symptoms raise protocol suggestions in combination with other signals (handbook/protocol module, not here).
// Observation: value = null (a checklist has no single number; no rule layer reads it); components = 0/1 flags
// keyed by SYMPTOM_KEYS (e.g. { headache: 1, rash: 0, … }), a missing key counts as 0. The Lab writes every key,
// the simulator only the ticked ones; src/services/validation.ts enforces this shape. Free-text notes are never
// scanned.
import type { SignalDef } from '../types';
import { NASA_RISKS, earthNotApplicable, spaceNotApplicable } from './common';

export const SYMPTOM_KEYS = [
  'headache',
  'congestion',
  'nausea',
  'rash',
  'back_pain',
  'vision_change',
  'insomnia',
  'low_mood',
  'fatigue',
] as const;
export type SymptomKey = (typeof SYMPTOM_KEYS)[number];

export const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  headache: 'Headache',
  congestion: 'Congestion',
  nausea: 'Nausea / motion sickness',
  rash: 'Rash',
  back_pain: 'Back pain',
  vision_change: 'Vision change',
  insomnia: 'Insomnia',
  low_mood: 'Low mood',
  fatigue: 'Fatigue',
};

export const symptoms: SignalDef = {
  id: 'symptoms',
  label: 'Symptoms',
  shortWhat:
    'A checklist of how you feel today: headache, congestion, nausea, rash, back pain, vision change, insomnia, ' +
    'low mood, fatigue.',
  whyInSpace:
    'Symptoms put the numbers in context: for example a headache together with high cabin CO₂, or a rash or ' +
    'fever with a raised heart rate, links to a protocol.',
  howToMeasure: ['Tick every symptom you have today.', 'Leave the list empty if you have none.'],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['skin'],
  system: 'behavioral',
  cadenceDays: 1,
  concerningDirection: 'up',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('symptoms'),
  space: spaceNotApplicable('symptoms', 'Symptoms have no numeric verdict; they feed protocol suggestions.'),
  actions: {},
  sourceIds: [NASA_RISKS],
};
