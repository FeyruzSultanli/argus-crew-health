// doc 07 §4.11 Near visual acuity — `near_acuity` (logMAR, per eye; higher = worse).
// Observation: value = logMAR score; context.eye = 'left' | 'right'; context.withGlasses = true when measured
// with (anticipation) glasses. Pre-flight reference per eye = median of that eye's pre-flight readings in
// ctx.history (missionDay ≤ −1); fallback ctx.preflight.components[eye], then ctx.preflight.median.
// Both layers judge every eye tested on the reading's day (latest per eye) and report the worse eye.
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { chronological, median } from '../rules/history';
import { notApplicable, worstOf } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS } from './common';

type Eye = 'left' | 'right' | 'unspecified';
const eyeOf = (o: Observation): Eye => o.context?.eye ?? 'unspecified';
const eyeLabel = (e: Eye): string => (e === 'left' ? 'Left eye' : e === 'right' ? 'Right eye' : 'Eye');

export function acuityEarthRule(eye: Eye): BandRule {
  return {
    id: 'near_acuity.earth.cutoff',
    layer: 'earth',
    precision: 2,
    unit: 'logMAR',
    bands: [
      {
        verdict: 'WATCH',
        min: 0.3,
        minExclusive: true,
        // 20/40 ≈ 0.30 logMAR is sourced; 20/40 as a near-acuity screening cut-off is [demo] (doc 07 §4.11).
        demo: true,
        reason: `${eyeLabel(eye)}: {v} is worse than 0.30 logMAR (≈ 20/40).`,
      },
    ],
    sourceIds: ['SRC_EARTH_ACUITY'],
    nominalReason: `${eyeLabel(eye)}: {v} is 0.30 logMAR or better.`,
  };
}

/** Space bands on the decline vs pre-flight (logMAR, two decimals). EXPECTED needs glasses [demo]. */
export function acuitySpaceRule(eye: Eye, withGlasses: boolean): BandRule {
  const name = eyeLabel(eye);
  const bands: Band[] = [
    { verdict: 'WATCH', min: 0.2, demo: true, reason: `${name}: {v} worse than pre-flight (0.20 or more).` },
    // Decision 6 (docs/DECISIONS.md): a decline of 0.11–0.19 is also EXPECTED, with or without glasses [demo].
    {
      verdict: 'EXPECTED',
      min: 0.11,
      max: 0.19,
      demo: true,
      reason: `${name}: {v} change vs pre-flight — within the known hyperopic shift in space.`,
    },
  ];
  if (withGlasses) {
    bands.push({
      verdict: 'EXPECTED',
      max: 0.1,
      demo: true,
      reason: `${name}: {v} change vs pre-flight, corrected with glasses — a known space change.`,
    });
  }
  return {
    id: 'near_acuity.space.decline',
    layer: 'space',
    precision: 2,
    unit: 'logMAR',
    bands,
    sourceIds: ['SRC_SANS_EYE_NATURE'],
    nominalReason: `${name}: {v} change vs pre-flight.`,
  };
}

function latestPerEye(o: Observation, ctx: RuleCtx): Map<Eye, Observation> {
  const all = chronological(ctx.history.length > 0 ? ctx.history : [o]);
  const byEye = new Map<Eye, Observation>();
  for (const r of all)
    if (r.missionDay === o.missionDay && typeof r.value === 'number') byEye.set(eyeOf(r), r);
  return byEye;
}

export function preflightAcuity(eye: Eye, ctx: RuleCtx): number | null {
  const pre = ctx.history
    .filter((r) => r.missionDay <= -1 && eyeOf(r) === eye)
    .map((r) => r.value)
    .filter((v): v is number => typeof v === 'number');
  const m = median(pre);
  if (m !== null) return m;
  const comp = eye === 'unspecified' ? undefined : ctx.preflight.components?.[eye];
  return typeof comp === 'number' ? comp : ctx.preflight.median;
}

function earth(o: Observation, ctx: RuleCtx): LayerResult {
  const eyes = [...latestPerEye(o, ctx)];
  if (eyes.length === 0)
    return notApplicable('earth', 'This reading has no logMAR value.', 'near_acuity.earth.na');
  return worstOf(eyes.map(([eye, r]) => evaluateBands(acuityEarthRule(eye), r.value as number)));
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const eyes = [...latestPerEye(o, ctx)];
  if (eyes.length === 0)
    return notApplicable('space', 'This reading has no logMAR value.', 'near_acuity.space.na');
  const results = eyes.map(([eye, r]) => {
    const pre = preflightAcuity(eye, ctx);
    if (pre === null) {
      return notApplicable(
        'space',
        `${eyeLabel(eye)}: no pre-flight acuity to compare with.`,
        'near_acuity.space.na',
      );
    }
    const decline = (r.value as number) - pre;
    return evaluateBands(acuitySpaceRule(eye, r.context?.withGlasses === true), decline, { preflight: pre });
  });
  return worstOf(results);
}

export const nearAcuity: SignalDef = {
  id: 'near_acuity',
  label: 'Near visual acuity',
  shortWhat: 'The smallest tumbling-E letters you can read on screen at 60 cm, in logMAR (lower is better).',
  whyInSpace:
    'A far-sighted (hyperopic) shift is a known feature of SANS; Space Anticipation Glasses are kept aboard ' +
    'the ISS to correct it. Screening only.',
  howToMeasure: [
    'Calibrate the screen once per device.',
    'Sit 60 cm from the screen (an intermediate-distance test, not a 40-cm near card).',
    'Test one eye at a time.',
    'Give the direction of each E with the arrow keys or the large buttons.',
    'Note whether you wore glasses.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['eyes'],
  system: 'neuro-eye',
  cadenceDays: 30,
  concerningDirection: 'up',
  // Per eye: the baseline engine runs the series per o.context.eye.
  personal: { enabled: true, params: [{ direction: 'up', sigmaFloor: 0.05, aggregation: 'single' }] },
  earth,
  space,
  actions: {},
  sourceIds: [
    'SRC_EARTH_ACUITY',
    'SRC_SANS_EYE_NATURE',
    'SRC_OCULAR_CADENCE',
    NASA_RISKS,
    'SRC_DEMO_RULE_BANDS',
    'SRC_DEMO_BASELINE_ENGINE',
  ],
};
