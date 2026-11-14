// Builds the reaction_test observation (doc 06 §3, doc 07 §4.9): value = mean response speed (/s),
// components = { medianRtMs, lapses, falseStarts, nStimuli }. Only derived numbers are saved.
import type { NewObservation } from '../../../domain/types';
import type { PvtScore } from '../../../measurement/pvt';
import type { PvtTestMode } from './testMode';

/** doc 06 §3 valid input range for reaction_test (rejects impossible values; not a clinical threshold). */
export const REACTION_VALID_RANGE = { lo: 1.0, hi: 10.0 } as const;

export type ReactionObservationResult = { ok: true; observation: NewObservation } | { ok: false; reason: string };

export interface ReactionObservationOpts {
  crewId: string;
  missionDay: number;
  /** ISI seed of the session (doc 09 §4 "store seed"). */
  seed: number;
  testMode: PvtTestMode | null;
}

export const PVT_METHOD = 'PVT-B style';
/** Source of the PVT-B metric definitions (duration, ISI, lapse threshold). */
export const PVT_METHOD_SOURCE = ['SRC_PVT_B_BASNER2011'] as const;

export function buildReactionObservation(score: PvtScore, opts: ReactionObservationOpts): ReactionObservationResult {
  if (score.meanSpeed === null || score.medianRtMs === null) {
    return { ok: false, reason: 'No valid responses were recorded, so there is no result to save.' };
  }
  const speed = Math.round(score.meanSpeed * 1000) / 1000;
  if (speed < REACTION_VALID_RANGE.lo || speed > REACTION_VALID_RANGE.hi) {
    return {
      ok: false,
      reason: `Mean response speed ${speed.toFixed(2)} /s is outside the accepted range ${REACTION_VALID_RANGE.lo.toFixed(1)}–${REACTION_VALID_RANGE.hi.toFixed(1)} /s, so it was not saved. Please retake the test.`,
    };
  }
  // The seed has no field of its own in the Observation contract; it is kept in the method text.
  const source: NewObservation['source'] = opts.testMode
    ? { kind: 'simulated', method: `${PVT_METHOD}; scripted test mode (${opts.testMode.profile}); ISI seed ${opts.seed}`, label: 'SIMULATED' }
    : { kind: 'manual', method: `${PVT_METHOD}; ISI seed ${opts.seed}`, label: 'MEASURED' };
  return {
    ok: true,
    observation: {
      crewId: opts.crewId,
      signalId: 'reaction_test',
      value: speed,
      unit: '/s',
      components: {
        medianRtMs: Math.round(score.medianRtMs),
        lapses: score.lapses,
        falseStarts: score.falseStarts,
        nStimuli: score.nStimuli,
      },
      missionDay: opts.missionDay,
      source,
      quality: { score: 1, label: 'good', reasons: [] },
    },
  };
}
