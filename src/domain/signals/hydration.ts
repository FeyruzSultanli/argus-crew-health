// doc 07 §4.13 Hydration — `hydration` (L/day).
// Observation: value = litres of water drunk that mission day (the day's total; if several, the latest counts).
// Both layers (doc 07 "S/E") judge the 2-day mean from ctx.history (the 2 mission days ending at the reading's
// day, no day 0; a missing day is skipped).
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { windowMean } from '../rules/history';
import { notApplicable } from '../rules/layer';
import type { LayerId, LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS } from './common';

export const HYDRATION_WINDOW_DAYS = 2;

function rule(layer: LayerId): BandRule {
  return {
    id: `hydration.${layer}.mean2`,
    layer,
    precision: 1,
    unit: 'L',
    bands: [
      {
        verdict: 'WATCH',
        max: 2.0,
        maxExclusive: true,
        demo: true,
        reason: '2-day mean {v} per day is under 2.0 L.',
      },
    ],
    sourceIds: ['SRC_STD3001_ECLSS', 'SRC_KIDNEY_STONE_NASA'],
    nominalReason: '2-day mean {v} per day is 2.0 L or more.',
  };
}

export const HYDRATION_RULES = { earth: rule('earth'), space: rule('space') } as const;

function judge(o: Observation, ctx: RuleCtx, layer: 'earth' | 'space'): LayerResult {
  const w = windowMean(ctx.history, o.missionDay, HYDRATION_WINDOW_DAYS, 'last');
  if (w.mean === null)
    return notApplicable(layer, 'No water intake logged in the last 2 days.', `hydration.${layer}.na`);
  return evaluateBands(HYDRATION_RULES[layer], w.mean, { n: w.n });
}

export const hydration: SignalDef = {
  id: 'hydration',
  label: 'Water intake',
  shortWhat: 'How many litres of water you drank in the day.',
  whyInSpace:
    'NASA provisions at least 2.5 L of water per crewmember per day. Bone calcium loss and low urine volume ' +
    'raise kidney-stone risk in flight.',
  howToMeasure: ['Enter the total litres you drank today.', 'Log at about the same time each day.'],
  hazard: 'environment',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['kidneys'],
  system: 'metabolic',
  cadenceDays: 1,
  concerningDirection: 'down',
  personal: { enabled: true, params: [{ direction: 'down', sigmaFloor: 0.2, aggregation: 'mean-2' }] },
  earth: (o, ctx) => judge(o, ctx, 'earth'),
  space: (o, ctx) => judge(o, ctx, 'space'),
  actions: {},
  sourceIds: [
    'SRC_STD3001_ECLSS',
    'SRC_KIDNEY_STONE_NASA',
    NASA_RISKS,
    'SRC_DEMO_RULE_BANDS',
    'SRC_DEMO_BASELINE_ENGINE',
  ],
};
