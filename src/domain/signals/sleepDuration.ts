// doc 07 §4.6 Sleep duration — `sleep_duration`.
// Observation: value = hours slept for the night ending on that mission day (one per day; if several, the latest
// counts); optional components.quality (1–5) is stored but not judged.
// Rules judge the 3-night mean computed from ctx.history: the daily values of the 3 mission days ending at the
// reading's day (no day 0); missing nights are skipped and the mean uses the nights present (numbers.n).
// The space rule reads ctx.sameDay.reaction_test (so reaction_test is evaluated before sleep_duration).
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { windowMean } from '../rules/history';
import { notApplicable } from '../rules/layer';
import type { LayerId, LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS } from './common';

export const SLEEP_WINDOW_NIGHTS = 3;

export const SLEEP_EARTH_RULE: BandRule = {
  id: 'sleep_duration.earth.mean3',
  layer: 'earth',
  precision: 1,
  unit: 'h',
  bands: [
    {
      verdict: 'WATCH',
      max: 7,
      maxExclusive: true,
      reason: '3-night mean {v} is under the 7 h adult advice.',
    },
  ],
  sourceIds: ['SRC_EARTH_SLEEP_7H'],
  nominalReason: '3-night mean {v} meets the 7 h adult advice.',
};

const SPACE_BANDS: Band[] = [
  { verdict: 'ACT', max: 5.0, maxExclusive: true, demo: true, reason: '3-night mean {v} is under 5.0 h.' },
  { verdict: 'WATCH', max: 5.5, maxExclusive: true, demo: true, reason: '3-night mean {v} is under 5.5 h.' },
  {
    verdict: 'EXPECTED',
    min: 5.5,
    max: 6.9,
    demo: true,
    reason: '3-night mean {v} is typical in flight; protect your sleep.',
  },
  { verdict: 'NOMINAL', min: 7.0, reason: '3-night mean {v} is 7.0 h or more.' },
];

export const SLEEP_SPACE_RULE: BandRule = {
  id: 'sleep_duration.space.mean3',
  layer: 'space',
  precision: 1,
  unit: 'h',
  bands: SPACE_BANDS,
  sourceIds: ['SRC_SLEEP_BARGER'],
  nominalReason: '3-night mean {v} is 7.0 h or more.',
};

/** In-flight expected shift −0.9 h (doc 08 §7, TV-4) [SRC_SLEEP_BARGER, SRC_DEMO_BASELINE_ENGINE]. */
export const SLEEP_EXPECTED_SHIFT_H = -0.9;

function threeNightMean(
  o: Observation,
  ctx: RuleCtx,
  layer: LayerId,
): { mean: number; n: number } | LayerResult {
  const w = windowMean(ctx.history, o.missionDay, SLEEP_WINDOW_NIGHTS, 'last');
  if (w.mean === null)
    return notApplicable(layer, 'No sleep reading in the last 3 nights.', `sleep_duration.${layer}.na`);
  return { mean: w.mean, n: w.n };
}

function earth(o: Observation, ctx: RuleCtx): LayerResult {
  const m = threeNightMean(o, ctx, 'earth');
  if ('layer' in m) return m;
  return evaluateBands(SLEEP_EARTH_RULE, m.mean, { n: m.n });
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const m = threeNightMean(o, ctx, 'space');
  if ('layer' in m) return m;
  const base = evaluateBands(SLEEP_SPACE_RULE, m.mean, { n: m.n });
  // ACT also when the mean is < 5.5 h AND the Reaction Self-Test is WATCH/ACT the same day [demo].
  const rt = ctx.sameDay.reaction_test?.verdict;
  const reactionFlagged = rt === 'WATCH' || rt === 'ACT';
  if (base.verdict === 'WATCH' && reactionFlagged) {
    return {
      ...base,
      verdict: 'ACT',
      ruleId: 'sleep_duration.space.mean3+reaction',
      reason: `${base.reason.replace(/\.$/, '')} and today’s Reaction Self-Test is flagged.`,
      sourceIds: [...new Set([...base.sourceIds, 'SRC_PVT_SPINOFF'])],
    };
  }
  return base;
}

export const sleepDuration: SignalDef = {
  id: 'sleep_duration',
  label: 'Sleep duration',
  shortWhat:
    'How many hours you slept, from a wearable or your own report. ARGUS judges the 3-night average.',
  whyInSpace:
    'NASA schedules 8.5 h of sleep, but measured sleep on ISS missions averaged about 6.1 h. ' +
    'Some short sleep is expected in flight; ARGUS watches for deeper drops.',
  howToMeasure: [
    'Wear the sleep wearable (actigraphy) overnight, or enter the hours you slept after waking.',
    'Rate your sleep quality from 1 to 5.',
  ],
  hazard: 'isolation',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['brain'],
  system: 'behavioral',
  cadenceDays: 1,
  concerningDirection: 'down',
  personal: {
    enabled: true,
    params: [{ direction: 'down', sigmaFloor: 0.3, aggregation: 'mean-3' }],
    expectedShift: (ctx) => (ctx.missionDay >= 1 ? SLEEP_EXPECTED_SHIFT_H : 0),
  },
  earth,
  space,
  actions: {},
  sourceIds: [
    'SRC_SLEEP_BARGER',
    'SRC_EARTH_SLEEP_7H',
    'SRC_PVT_SPINOFF',
    NASA_RISKS,
    'SRC_DEMO_RULE_BANDS',
    'SRC_DEMO_BASELINE_ENGINE',
  ],
};
