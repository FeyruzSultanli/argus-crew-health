// doc 07 §4.19 Cabin temperature — `cabin_temp` (crewId = 'cabin').
// Observation: value = cabin air temperature in Cel (latest reading). NASA-STD-3001 zones are judged by the space
// layer; there is no Earth rule (n/a).
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import type { SignalDef } from '../types';
import { NASA_RISKS, earthNotApplicable, isResult, valueOf } from './common';

export const CABIN_TEMP_RULE: BandRule = {
  id: 'cabin_temp.space.zones',
  layer: 'space',
  precision: 1,
  unit: '°C',
  bands: [
    { verdict: 'ACT', max: 18, maxExclusive: true, reason: '{v} is below the 18–27 °C health limits.' },
    { verdict: 'ACT', min: 27, minExclusive: true, reason: '{v} is above the 18–27 °C health limits.' },
    {
      verdict: 'WATCH',
      min: 18,
      max: 20,
      maxExclusive: true,
      reason: '{v} is outside the 20–25 °C performance zone.',
    },
    {
      verdict: 'WATCH',
      min: 25,
      minExclusive: true,
      max: 27,
      reason: '{v} is outside the 20–25 °C performance zone.',
    },
    { verdict: 'NOMINAL', min: 20, max: 25, reason: '{v} is within the 20–25 °C performance zone.' },
  ],
  sourceIds: ['SRC_STD3001_ECLSS'],
  nominalReason: '{v} is within the 20–25 °C performance zone.',
};

export const cabinTemp: SignalDef = {
  id: 'cabin_temp',
  label: 'Cabin temperature',
  shortWhat: 'The temperature of the cabin air.',
  whyInSpace:
    'NASA-STD-3001 sets a performance zone of 20–25 °C and health limits of 18–27 °C for the cabin.',
  howToMeasure: ['Read automatically from the cabin sensor.'],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: [],
  system: 'environment',
  cadenceDays: 1,
  concerningDirection: 'both',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('cabin_temp'),
  space: (o) => {
    const v = valueOf(o, 'space', CABIN_TEMP_RULE.id);
    return isResult(v) ? v : evaluateBands(CABIN_TEMP_RULE, v);
  },
  actions: {},
  sourceIds: ['SRC_STD3001_ECLSS', NASA_RISKS],
};
