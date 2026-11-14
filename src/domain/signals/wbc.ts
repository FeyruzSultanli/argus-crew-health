// doc 07 §4.16 White blood cells — `wbc` (P1, extended).
// Observation: value = leukocytes in 10*3/uL. Earth: OSD-569 lab range 3.8–10.8 ×10³/µL; outside → WATCH (the
// verdict for an out-of-range value is a [demo] choice). Space: WATCH if more than 40% above or below
// ctx.preflight.median [demo]; in flight only.
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, isResult, valueOf } from './common';

export const WBC_RANGE = { lo: 3.8, hi: 10.8 } as const;

export const WBC_EARTH_RULE: BandRule = {
  id: 'wbc.earth.labRange',
  layer: 'earth',
  precision: 1,
  unit: '×10³/µL',
  bands: [
    {
      verdict: 'WATCH',
      max: WBC_RANGE.lo,
      maxExclusive: true,
      demo: true,
      reason: '{v} is below the lab range 3.8–10.8.',
    },
    {
      verdict: 'WATCH',
      min: WBC_RANGE.hi,
      minExclusive: true,
      demo: true,
      reason: '{v} is above the lab range 3.8–10.8.',
    },
    {
      verdict: 'NOMINAL',
      min: WBC_RANGE.lo,
      max: WBC_RANGE.hi,
      reason: '{v} is within the lab range 3.8–10.8.',
    },
  ],
  sourceIds: ['SRC_OSD569'],
  nominalReason: '{v} is within the lab range 3.8–10.8.',
};

export const WBC_SPACE_RULE: BandRule = {
  id: 'wbc.space.change',
  layer: 'space',
  precision: 0,
  unit: '%',
  bands: [
    {
      verdict: 'WATCH',
      min: 40,
      minExclusive: true,
      demo: true,
      reason: '{v} above your pre-flight count (more than 40%).',
    },
    {
      verdict: 'WATCH',
      max: -40,
      maxExclusive: true,
      demo: true,
      reason: '{v} vs your pre-flight count (more than 40% lower).',
    },
  ],
  sourceIds: [NASA_RISKS],
  nominalReason: '{v} vs your pre-flight count: within ±40%.',
};

function earth(o: Observation): LayerResult {
  const v = valueOf(o, 'earth', WBC_EARTH_RULE.id);
  return isResult(v) ? v : evaluateBands(WBC_EARTH_RULE, v);
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const v = valueOf(o, 'space', WBC_SPACE_RULE.id);
  if (isResult(v)) return v;
  if (o.missionDay < 1)
    return notApplicable('space', 'Pre-flight sample: no in-flight rule applies.', 'wbc.space.na');
  const pre = ctx.preflight.median;
  if (pre === null || pre <= 0)
    return notApplicable('space', 'No pre-flight count to compare with.', 'wbc.space.na');
  return evaluateBands(WBC_SPACE_RULE, ((v - pre) / pre) * 100, { preflight: roundTo(pre, 1) });
}

export const wbc: SignalDef = {
  id: 'wbc',
  label: 'White blood cells',
  shortWhat: 'The number of white blood cells, the immune system’s cells, from a lab blood count.',
  whyInSpace:
    'The immune system changes in flight, and dormant viruses can reactivate, for example as rashes.',
  howToMeasure: [
    'Give a blood sample per the on-board lab procedure.',
    'The value is entered from the lab result.',
  ],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['vessels'],
  system: 'metabolic',
  cadenceDays: 30,
  concerningDirection: 'both',
  // Disabled: the space rule (±40%) handles it (doc 08 §7).
  personal: { enabled: false, params: [{ direction: 'both', sigmaFloor: 0.4, aggregation: 'single' }] },
  earth,
  space,
  actions: {},
  sourceIds: ['SRC_OSD569', NASA_RISKS, 'SRC_DEMO_RULE_BANDS'],
};
