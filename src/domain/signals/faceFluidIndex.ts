// doc 07 §4.12 Face fluid-shift index — `face_fluid_index` (experimental, P2). UI badge "Experimental — not validated".
// Observation: value = mean(feature_today / feature_preflight_mean) over the width features (doc 09 §2), so
// 1.00 = same as the pre-flight scans. The space layer gives EXPECTED for an increase (> 1.00) in weightlessness
// (profile.gravityG = 0, in flight) and NOMINAL otherwise; it never gives WATCH/ACT. Earth: n/a.
import { layerResult } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, earthNotApplicable, isResult, valueOf } from './common';

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const v = valueOf(o, 'space', 'face_fluid_index.space');
  if (isResult(v)) return v;
  const ratio = roundTo(v, 2);
  const pct = roundTo((ratio - 1) * 100, 0);
  const weightless = ctx.profile.gravityG === 0 && o.missionDay >= 1;
  if (ratio > 1 && weightless) {
    return layerResult(
      'space',
      'EXPECTED',
      `Face width is ${pct}% above your pre-flight scans: a known fluid shift in weightlessness. Trend only.`,
      [NASA_RISKS],
      'face_fluid_index.space.increase',
      { value: ratio },
    );
  }
  return layerResult(
    'space',
    'NOMINAL',
    `Face width is ${pct}% vs your pre-flight scans. Trend only.`,
    [NASA_RISKS],
    'face_fluid_index.space.trend',
    { value: ratio },
  );
}

export const faceFluidIndex: SignalDef = {
  id: 'face_fluid_index',
  label: 'Face fluid-shift index',
  shortWhat:
    'Experimental — not validated. Your face width from the camera, compared with your own pre-flight scans.',
  whyInSpace:
    'Weightlessness shifts body fluid toward the head (the “puffy face” adaptation). No validated threshold ' +
    'exists, so this index is a trend only and never raises Watch or Act.',
  howToMeasure: [
    'Face the camera straight on with a neutral expression.',
    'Hold still for 3 s.',
    'Only numbers are stored; a snapshot is saved only if you opt in.',
  ],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['face'],
  system: 'cardio',
  cadenceDays: 30,
  concerningDirection: 'up',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('face_fluid_index'),
  space,
  actions: {},
  sourceIds: [NASA_RISKS],
};
