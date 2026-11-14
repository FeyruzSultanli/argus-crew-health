// doc 07 §4.9 Reaction Self-Test — `reaction_test` (doc 09 §4).
// Observation: value = mean response speed (mean of 1000/RT_ms, unit /s); components = { medianRtMs, lapses
// (RT ≥ 355 ms), falseStarts, nStimuli }. Baseline lapses = ctx.preflight.components.lapses (median of the
// pre-flight runs). The personal layer judges the speed (value).
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS, earthNotApplicable } from './common';

export const LAPSES_WATCH_EXCESS = 3;
export const LAPSES_ACT_EXCESS = 6;

/** Band rule on the lapse count, with edges at baseline + 3 / + 6 [demo]. */
export function reactionSpaceRule(baselineLapses: number): BandRule {
  const watchAt = baselineLapses + LAPSES_WATCH_EXCESS;
  const actAt = baselineLapses + LAPSES_ACT_EXCESS;
  return {
    id: 'reaction_test.space.lapses',
    layer: 'space',
    precision: 0,
    unit: 'lapses',
    bands: [
      {
        verdict: 'ACT',
        min: actAt,
        demo: true,
        reason: `{v}: ${LAPSES_ACT_EXCESS} or more above your pre-flight median of ${baselineLapses}.`,
      },
      {
        verdict: 'WATCH',
        min: watchAt,
        demo: true,
        reason: `{v}: ${LAPSES_WATCH_EXCESS} or more above your pre-flight median of ${baselineLapses}.`,
      },
    ],
    sourceIds: ['SRC_COGNITION', 'SRC_PVT_SPINOFF'],
    nominalReason: `{v}: fewer than ${LAPSES_WATCH_EXCESS} above your pre-flight median of ${baselineLapses}.`,
  };
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const lapses = o.components?.lapses;
  if (typeof lapses !== 'number') {
    return notApplicable('space', 'This run has no lapse count.', 'reaction_test.space.na');
  }
  const baseline = ctx.preflight.components?.lapses;
  if (typeof baseline !== 'number') {
    return notApplicable('space', 'No pre-flight runs to compare lapses with.', 'reaction_test.space.na');
  }
  return evaluateBands(reactionSpaceRule(baseline), lapses, { lapses, baselineLapses: baseline });
}

export const reactionTest: SignalDef = {
  id: 'reaction_test',
  label: 'Reaction Self-Test',
  shortWhat:
    'A 3-minute test of how fast you respond to a counter on screen; it also counts slow responses (lapses).',
  whyInSpace:
    'Modeled on NASA’s 3-minute PVT-B, used on the ISS as the Reaction Self-Test to tell astronauts when ' +
    'their performance drops below optimal, for example after poor sleep.',
  howToMeasure: [
    'Use the same device each time.',
    'Sit somewhere quiet for 3 minutes.',
    'Respond as soon as the counter appears; do not press early.',
  ],
  hazard: 'isolation',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['brain'],
  system: 'behavioral',
  cadenceDays: 7,
  concerningDirection: 'down',
  personal: { enabled: true, params: [{ direction: 'down', sigmaFloor: 0.1, aggregation: 'single' }] },
  earth: earthNotApplicable('reaction_test'),
  space,
  actions: {},
  sourceIds: [
    'SRC_COGNITION',
    'SRC_PVT_SPINOFF',
    'SRC_PVT_B_BASNER2011',
    NASA_RISKS,
    'SRC_DEMO_RULE_BANDS',
    'SRC_DEMO_BASELINE_ENGINE',
  ],
};
