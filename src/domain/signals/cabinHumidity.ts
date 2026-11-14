// doc 07 §4.19 Cabin humidity — `cabin_humidity` (crewId = 'cabin').
// Observation: value = relative humidity in % (latest reading). Bands are a [demo] simplification of the
// NASA-STD-3001 V2 6012 temperature–humidity zone; judged by the space layer, no Earth rule (n/a).
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import type { SignalDef } from '../types';
import { NASA_RISKS, earthNotApplicable, isResult, valueOf } from './common';

export const CABIN_HUMIDITY_RULE: BandRule = {
  id: 'cabin_humidity.space.zones',
  layer: 'space',
  precision: 0,
  unit: '% RH',
  bands: [
    { verdict: 'ACT', max: 25, maxExclusive: true, demo: true, reason: '{v} is below 25% RH.' },
    { verdict: 'ACT', min: 75, minExclusive: true, demo: true, reason: '{v} is above 75% RH.' },
    { verdict: 'WATCH', min: 25, max: 29, demo: true, reason: '{v} is in the dry 25–29% RH band.' },
    { verdict: 'WATCH', min: 61, max: 75, demo: true, reason: '{v} is in the humid 61–75% RH band.' },
    {
      verdict: 'NOMINAL',
      min: 30,
      max: 60,
      demo: true,
      reason: '{v} is within the 30–60% RH performance zone.',
    },
  ],
  sourceIds: ['SRC_STD3001_ECLSS'],
  nominalReason: '{v} is within the 30–60% RH performance zone.',
};

export const cabinHumidity: SignalDef = {
  id: 'cabin_humidity',
  label: 'Cabin humidity',
  shortWhat: 'The relative humidity of the cabin air.',
  whyInSpace: 'NASA-STD-3001 sets a performance zone of 30–60% relative humidity for the cabin.',
  howToMeasure: ['Read automatically from the cabin sensor.'],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: [],
  system: 'environment',
  cadenceDays: 1,
  concerningDirection: 'both',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('cabin_humidity'),
  space: (o) => {
    const v = valueOf(o, 'space', CABIN_HUMIDITY_RULE.id);
    return isResult(v) ? v : evaluateBands(CABIN_HUMIDITY_RULE, v);
  },
  actions: {},
  sourceIds: ['SRC_STD3001_ECLSS', NASA_RISKS, 'SRC_DEMO_RULE_BANDS'],
};
