// doc 07 §4.7 Mood — `mood`.
// Observation: value = self-rating 1–5 (one per day; if several, the latest counts); optional `note`.
// The space rule judges the 3-day mean from ctx.history (days ending at the reading's day, no day 0; days without
// a rating are skipped). No keyword matching on the note: it is stored and shown to the CMO, nothing else.
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { windowMean } from '../rules/history';
import { notApplicable } from '../rules/layer';
import type { ActionTemplate, Observation, RuleCtx, SignalDef } from '../types';
import { NASA_RISKS, earthNotApplicable } from './common';

export const MOOD_WINDOW_DAYS = 3;

// [demo] band edges; mean rounded to one decimal before the test.
export const MOOD_SPACE_RULE: BandRule = {
  id: 'mood.space.mean3',
  layer: 'space',
  precision: 1,
  unit: '',
  bands: [
    { verdict: 'ACT', max: 1.5, demo: true, reason: '3-day mean mood {v} is 1.5 or lower.' },
    { verdict: 'WATCH', max: 2.5, demo: true, reason: '3-day mean mood {v} is 2.5 or lower.' },
  ],
  sourceIds: [],
  nominalReason: '3-day mean mood {v} is above 2.5.',
};

const MOOD_ACTION: ActionTemplate = {
  text: 'Tell the CMO. You can ask for a private conference with the flight surgeon.',
  kind: 'tell-cmo',
};

function space(o: Observation, ctx: RuleCtx) {
  const w = windowMean(ctx.history, o.missionDay, MOOD_WINDOW_DAYS, 'last');
  if (w.mean === null) return notApplicable('space', 'No mood rating in the last 3 days.', 'mood.space.na');
  return evaluateBands(MOOD_SPACE_RULE, w.mean, { n: w.n });
}

export const mood: SignalDef = {
  id: 'mood',
  label: 'Mood',
  shortWhat:
    'A daily self-rating of how you feel, from 1 (very low) to 5 (very good), with an optional note.',
  whyInSpace:
    'Isolation and confinement are one of NASA’s five hazards, and behavioural changes are a NASA ' +
    'human-research risk. Your note is shown only to the CMO; it is never scanned.',
  howToMeasure: ['Pick one of the 5 faces.', 'Optionally add one line about today.'],
  hazard: 'isolation',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['brain'],
  system: 'behavioral',
  cadenceDays: 1,
  concerningDirection: 'down',
  personal: { enabled: true, params: [{ direction: 'down', sigmaFloor: 0.4, aggregation: 'mean-3' }] },
  earth: earthNotApplicable('mood'),
  space,
  actions: { WATCH: MOOD_ACTION, ACT: MOOD_ACTION },
  sourceIds: [NASA_RISKS, 'SRC_NASA_HAZARDS', 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_BASELINE_ENGINE'],
};
