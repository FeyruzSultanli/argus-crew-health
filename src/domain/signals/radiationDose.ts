// doc 07 §4.20 Radiation dose — `radiation_dose` (doc 10).
// The rule reads ctx.dose (DoseLedger, filled by the radiation service); without it the layer is NO_DATA. Observations are
// optional: assessSignal evaluates this signal from ctx.dose even when no observation exists.
// projectedEndMsv is rounded to 0.1 mSv (display precision, doc 10 §4) and compared with 80 % / 95 % of 600 mSv
// (480.0 / 570.0 mSv); speCurrentEventMsvModeled is rounded to 0.01 mSv and compared with 50 % of 250 mSv (125). The shelter advisory is an environment banner and does not change this verdict (doc 07 §4.20).
import type { Band, BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { notApplicable, worstOf } from '../rules/layer';
import type { LayerResult, RuleCtx, SignalDef } from '../types';
import { roundTo } from '../units';
import { NASA_RISKS, earthNotApplicable } from './common';

/** NASA-STD-3001 V1 4030 career limit and V1 4031 SPE design limit [SRC_STD3001_RAD]. */
export const CAREER_LIMIT_MSV = 600;
export const SPE_LIMIT_MSV = 250;

/** [demo] fractions of the career limit (doc 07 §4.20). */
export const CAREER_WATCH_FRACTION = 0.8;
export const CAREER_ACT_FRACTION = 0.95;

const CAREER_BANDS: Band[] = [
  {
    verdict: 'ACT',
    min: CAREER_LIMIT_MSV * CAREER_ACT_FRACTION,
    demo: true,
    reason: 'Projected end-of-mission dose {v} is 95% or more of the 600 mSv career limit.',
  },
  {
    verdict: 'WATCH',
    min: CAREER_LIMIT_MSV * CAREER_WATCH_FRACTION,
    demo: true,
    reason: 'Projected end-of-mission dose {v} is 80% or more of the 600 mSv career limit.',
  },
];

export const DOSE_CAREER_RULE: BandRule = {
  id: 'radiation_dose.space.projected',
  layer: 'space',
  precision: 1,
  unit: 'mSv',
  bands: CAREER_BANDS,
  sourceIds: ['SRC_STD3001_RAD', 'SRC_DEMO_RADIATION_MODEL'],
  nominalReason: 'Projected end-of-mission dose {v} is under 80% of the 600 mSv career limit.',
};

export const DOSE_SPE_RULE: BandRule = {
  id: 'radiation_dose.space.spe',
  layer: 'space',
  precision: 2,
  unit: 'mSv',
  bands: [
    {
      verdict: 'ACT',
      min: SPE_LIMIT_MSV * 0.5,
      demo: true,
      reason: 'Modeled dose of the current solar event is {v}: half of the 250 mSv limit or more.',
    },
  ],
  sourceIds: ['SRC_STD3001_RAD', 'SRC_DEMO_RADIATION_MODEL'],
  nominalReason: 'Modeled dose of the current solar event is {v}.',
};

function space(_o: unknown, ctx: RuleCtx): LayerResult {
  const d = ctx.dose;
  if (d === undefined) return notApplicable('space', 'No dose ledger yet.', 'radiation_dose.space.na');
  const career = evaluateBands(DOSE_CAREER_RULE, d.projectedEndMsv);
  const spe = evaluateBands(DOSE_SPE_RULE, d.speCurrentEventMsvModeled);
  const worst = worstOf([career, spe]);
  return {
    ...worst,
    sourceIds: [...new Set([...worst.sourceIds, ...d.sourceIds])],
    numbers: {
      totalMsv: roundTo(d.totalMsv, 1),
      projectedEndMsv: roundTo(d.projectedEndMsv, 1),
      pctProjected: roundTo(((career.numbers?.value ?? 0) / CAREER_LIMIT_MSV) * 100, 0),
      speCurrentEventMsv: roundTo(d.speCurrentEventMsvModeled, 2),
    },
  };
}

export const radiationDose: SignalDef = {
  id: 'radiation_dose',
  label: 'Radiation dose',
  shortWhat:
    'Your effective radiation dose in mSv: career dose before this mission plus this mission so far.',
  whyInSpace:
    'Space radiation is one of NASA’s five hazards. NASA-STD-3001 limits career dose to below 600 mSv and asks ' +
    'for exposure as low as reasonably achievable.',
  howToMeasure: [
    'Wear your personal dosimeter.',
    'ARGUS adds the daily cosmic-ray dose and any modeled solar-event dose to your ledger.',
  ],
  hazard: 'radiation',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['whole_body'],
  system: 'environment',
  cadenceDays: 1,
  concerningDirection: 'up',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('radiation_dose'),
  space,
  actions: {},
  sourceIds: ['SRC_STD3001_RAD', 'SRC_NASA_HAZARDS', NASA_RISKS, 'SRC_DEMO_RADIATION_MODEL'],
};
