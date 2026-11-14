// doc 07 §4.8 Body mass — `body_mass`.
// Observation: value = body mass in kg (single reading). Rules compare with ctx.preflight.median (kg):
// loss % = (pre − value) / pre × 100, rounded to an integer % before the band test.
// "within 30 days" of doc 07 §4.8 is not modeled as a time window: the loss is always vs the pre-flight median.
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable } from '../rules/layer';
import type { LayerId, LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, isResult, valueOf } from './common';

function rule(layer: LayerId): BandRule {
  return {
    id: `body_mass.${layer}.loss`,
    layer,
    precision: 0,
    unit: '%',
    bands: [
      { verdict: 'ACT', min: 10, demo: true, reason: 'Mass is down {v} vs pre-flight (10% or more).' },
      { verdict: 'WATCH', min: 5, demo: true, reason: 'Mass is down {v} vs pre-flight (5% or more).' },
    ],
    // Space: same [demo]; context NASA plans ~3,035 kcal/day [SRC_STD3001_ECLSS].
    sourceIds: layer === 'space' ? ['SRC_STD3001_ECLSS'] : [],
    nominalReason: 'Mass loss vs pre-flight is {v}, under 5% (a negative loss is a gain).',
  };
}

export const MASS_RULES = { earth: rule('earth'), space: rule('space') } as const;

function judge(o: Observation, ctx: RuleCtx, layer: 'earth' | 'space'): LayerResult {
  const r = MASS_RULES[layer];
  const v = valueOf(o, layer, r.id);
  if (isResult(v)) return v;
  const pre = ctx.preflight.median;
  if (pre === null || pre <= 0)
    return notApplicable(layer, 'No pre-flight mass to compare with.', `${r.id}.na`);
  const lossPct = ((pre - v) / pre) * 100;
  return evaluateBands(r, lossPct, { massKg: roundTo(v, 1), preflightKg: roundTo(pre, 1) });
}

export const bodyMass: SignalDef = {
  id: 'body_mass',
  label: 'Body mass',
  shortWhat: 'Your body mass in kilograms, compared with your pre-flight mass.',
  whyInSpace:
    'Losing mass in flight can mean you are not eating enough; NASA plans an average of about 3,035 kcal ' +
    'per crewmember per day.',
  howToMeasure: ['Use the mass-measurement device per its procedure.', 'Measure at the same time of day.'],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['muscles'],
  system: 'musculoskeletal',
  cadenceDays: 7,
  concerningDirection: 'down',
  personal: { enabled: true, params: [{ direction: 'down', sigmaFloor: 0.5, aggregation: 'single' }] },
  earth: (o, ctx) => judge(o, ctx, 'earth'),
  space: (o, ctx) => judge(o, ctx, 'space'),
  actions: {},
  sourceIds: ['SRC_STD3001_ECLSS', NASA_RISKS, 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_BASELINE_ENGINE'],
};
