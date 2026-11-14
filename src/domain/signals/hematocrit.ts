// doc 07 §4.15 Hematocrit — `hematocrit` (P1, extended).
// Observation: value = hematocrit in %; optional components { refLow, refHigh } = the lab reference range printed
// in the OSD-569 file for that sample. Without them the sex-specific OSD-569 ranges are used
// (38.5–50% for male, 35–45% for female crew; SRC_OSD569).
// Space rule: relative rise vs ctx.preflight.median, in flight only (missionDay ≥ 1).
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, isResult, valueOf } from './common';

export const HCT_RANGE = { male: { lo: 38.5, hi: 50 }, female: { lo: 35, hi: 45 } } as const;

/** Outside the lab range → WATCH (the verdict for an out-of-range value is a [demo] choice). */
export function hctEarthRule(lo: number, hi: number): BandRule {
  return {
    id: 'hematocrit.earth.labRange',
    layer: 'earth',
    precision: 1,
    unit: '%',
    bands: [
      {
        verdict: 'WATCH',
        max: lo,
        maxExclusive: true,
        demo: true,
        reason: `{v} is below the lab range ${lo}–${hi}%.`,
      },
      {
        verdict: 'WATCH',
        min: hi,
        minExclusive: true,
        demo: true,
        reason: `{v} is above the lab range ${lo}–${hi}%.`,
      },
      { verdict: 'NOMINAL', min: lo, max: hi, reason: `{v} is within the lab range ${lo}–${hi}%.` },
    ],
    sourceIds: ['SRC_OSD569'],
    nominalReason: `{v} is within the lab range ${lo}–${hi}%.`,
  };
}

export const HCT_SPACE_RULE: BandRule = {
  id: 'hematocrit.space.rise',
  layer: 'space',
  precision: 0,
  unit: '%',
  bands: [
    {
      verdict: 'WATCH',
      min: 12,
      minExclusive: true,
      demo: true,
      reason: 'Up {v} vs pre-flight: more than the known +12% in-flight rise.',
    },
    {
      verdict: 'EXPECTED',
      min: 0,
      minExclusive: true,
      max: 12,
      demo: true,
      reason: 'Up {v} vs pre-flight: within the known in-flight rise.',
    },
    { verdict: 'NOMINAL', max: 0, reason: 'Change vs pre-flight is {v}: no rise.' },
  ],
  sourceIds: ['SRC_HCT_FLIGHT'],
  nominalReason: 'Change vs pre-flight is {v}: no rise.',
};

function earth(o: Observation, ctx: RuleCtx): LayerResult {
  const v = valueOf(o, 'earth', 'hematocrit.earth.labRange');
  if (isResult(v)) return v;
  const lo = o.components?.refLow;
  const hi = o.components?.refHigh;
  if (typeof lo === 'number' && typeof hi === 'number') return evaluateBands(hctEarthRule(lo, hi), v);
  const sex = ctx.crew?.sex;
  if (sex === undefined)
    return notApplicable('earth', 'No lab range for this reading.', 'hematocrit.earth.na');
  return evaluateBands(hctEarthRule(HCT_RANGE[sex].lo, HCT_RANGE[sex].hi), v);
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const v = valueOf(o, 'space', HCT_SPACE_RULE.id);
  if (isResult(v)) return v;
  if (o.missionDay < 1)
    return notApplicable('space', 'Pre-flight sample: no in-flight rule applies.', 'hematocrit.space.na');
  const pre = ctx.preflight.median;
  if (pre === null || pre <= 0)
    return notApplicable('space', 'No pre-flight hematocrit to compare with.', 'hematocrit.space.na');
  return evaluateBands(HCT_SPACE_RULE, ((v - pre) / pre) * 100, { preflight: roundTo(pre, 1) });
}

export const hematocrit: SignalDef = {
  id: 'hematocrit',
  label: 'Hematocrit',
  shortWhat: 'The share of your blood volume made up of red blood cells, from a lab blood count.',
  whyInSpace:
    'Hematocrit was reported about 10–12% (relative) higher in flight than before flight, part of it from sample ' +
    'handling delay. ARGUS treats a rise of up to that size as expected.',
  howToMeasure: [
    'Give a blood sample per the on-board lab procedure.',
    'The value is entered from the lab result.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['vessels'],
  system: 'cardio',
  cadenceDays: 30,
  concerningDirection: 'both',
  // Disabled until the expected in-flight shift is source-verified (doc 08 §7).
  personal: { enabled: false, params: [{ direction: 'both', sigmaFloor: 1, aggregation: 'single' }] },
  earth,
  space,
  actions: {},
  sourceIds: ['SRC_OSD569', 'SRC_HCT_FLIGHT', NASA_RISKS, 'SRC_DEMO_RULE_BANDS'],
};
