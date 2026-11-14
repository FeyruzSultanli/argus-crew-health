// doc 07 §4.18 Cabin CO₂ — `cabin_co2` (crewId = 'cabin').
// Observation: value = latest 1-hour average ppCO₂ in mm[Hg]; components.avg7d = 7-day average (mmHg) when the
// environment model provides it. Without avg7d the rule computes the 7-day mean of the daily means (mean of each
// day's readings) over the 7 mission days ending at the reading's day, from ctx.history.
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { windowMean } from '../rules/history';
import { worstOf } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, isResult, valueOf } from './common';

export const CO2_WINDOW_DAYS = 7;

export const CO2_SPACE_1H_RULE: BandRule = {
  id: 'cabin_co2.space.1h',
  layer: 'space',
  precision: 1,
  unit: 'mmHg',
  bands: [
    {
      verdict: 'ACT',
      min: 6.8,
      demo: true,
      reason: '1-h average {v} is 6.8 mmHg or more (time-limited exposure band).',
      sourceIds: ['SRC_CO2_ICES_LIMITS'],
    },
    {
      verdict: 'WATCH',
      min: 3,
      minExclusive: true,
      reason: '1-h average {v} is above the NASA-STD-3001 limit of 3 mmHg.',
    },
  ],
  sourceIds: ['SRC_STD3001_CO2'],
  nominalReason: '1-h average {v} is within the 3 mmHg limit.',
};

export const CO2_SPACE_7D_RULE: BandRule = {
  id: 'cabin_co2.space.7d',
  layer: 'space',
  precision: 1,
  unit: 'mmHg',
  bands: [
    { verdict: 'WATCH', min: 2.5, reason: '7-day average {v} is 2.5 mmHg or more: headache risk above 1%.' },
  ],
  sourceIds: ['SRC_NASA_CO2_PAGE'],
  nominalReason: '7-day average {v} is below 2.5 mmHg.',
};

export const CO2_EARTH_RULE: BandRule = {
  id: 'cabin_co2.earth.workplace',
  layer: 'earth',
  precision: 1,
  unit: 'mmHg',
  bands: [
    {
      verdict: 'WATCH',
      min: 3.8,
      minExclusive: true,
      reason: '{v} is above the 5,000 ppm (3.8 mmHg) workplace limit.',
    },
  ],
  sourceIds: ['SRC_NASA_CO2_PAGE', 'SRC_OSHA_CO2'],
  nominalReason: '{v} is within the 5,000 ppm (3.8 mmHg) workplace limit.',
};

/** 7-day average: components.avg7d if present, else the mean of daily means from ctx.history. */
export function co2SevenDay(o: Observation, ctx: RuleCtx): number | null {
  const given = o.components?.avg7d;
  if (typeof given === 'number') return given;
  return windowMean(ctx.history.length > 0 ? ctx.history : [o], o.missionDay, CO2_WINDOW_DAYS, 'mean').mean;
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const v = valueOf(o, 'space', CO2_SPACE_1H_RULE.id);
  if (isResult(v)) return v;
  const oneHour = evaluateBands(CO2_SPACE_1H_RULE, v);
  const avg7d = co2SevenDay(o, ctx);
  if (avg7d === null) return oneHour;
  const sevenDay = evaluateBands(CO2_SPACE_7D_RULE, avg7d);
  const worst = worstOf([oneHour, sevenDay]);
  return { ...worst, numbers: { last1h: roundTo(v, 1), avg7d: roundTo(avg7d, 1) } };
}

export const cabinCo2: SignalDef = {
  id: 'cabin_co2',
  label: 'Cabin CO₂',
  shortWhat: 'The partial pressure of carbon dioxide in the cabin air, in mmHg.',
  whyInSpace:
    'NASA-STD-3001 limits the 1-hour average to 3 mmHg; headaches are reported from about 2.8 mmHg. Keeping ' +
    'headache risk below 1% needs a 7-day average below 2.5 mmHg.',
  howToMeasure: ['Read automatically from the cabin CO₂ sensor.'],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: [],
  system: 'environment',
  cadenceDays: 1,
  concerningDirection: 'up',
  personal: { enabled: false, params: [] },
  earth: (o) => {
    const v = valueOf(o, 'earth', CO2_EARTH_RULE.id);
    return isResult(v) ? v : evaluateBands(CO2_EARTH_RULE, v);
  },
  space,
  actions: {},
  sourceIds: ['SRC_STD3001_CO2', 'SRC_NASA_CO2_PAGE', 'SRC_CO2_ICES_LIMITS', 'SRC_OSHA_CO2', NASA_RISKS],
};
