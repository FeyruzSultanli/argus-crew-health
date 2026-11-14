// Builds the vision observations (doc 06 §3, doc 07 §4.10–4.11). One observation per eye; only derived numbers.
// amsler: value = distinct marked cells; components { newCells, newCentralCells, centralCells, peripheralCells };
//         attachments [{ kind: 'amsler-map', ref: <visionMaps id> }].
// near_acuity: value = logMAR; context { eye, withGlasses }; components { lastPassedLogMAR, extraCorrect,
//         resolutionLimited }. The orientation seed goes into source.method (as the reaction test does).
import type { NewObservation, Quality } from '../../../domain/types';
import type { AcuityScore, AmslerDiff } from '../../../measurement/vision';

export type Eye = 'left' | 'right';
export const EYES: readonly Eye[] = ['right', 'left'];
export const eyeName = (e: Eye): string => (e === 'right' ? 'Right eye' : 'Left eye');
export const otherEye = (e: Eye): Eye => (e === 'right' ? 'left' : 'right');

export const AMSLER_METHOD = 'Amsler grid (on-screen)';
export const ACUITY_METHOD = 'Tumbling E (on-screen)';
export const TEST_MODE_TEXT = 'TEST MODE — scripted input';

export const DISTANCE_NOT_MEASURED = 'viewing distance not measured by camera';
export const CALIBRATION_NOT_VERIFIED = 'Screen calibration set by the user with a card; not independently verified.';

/** How the viewing distance was set up. 'ruler' = measured by the user (quality 'fair', doc 09 §3.1). */
export type DistanceMethod = 'ruler' | 'camera';

/** Quality score for a 'fair' reading — an internal demo parameter (SRC_DEMO_QUALITY_SCORES), never shown. */
const FAIR_SCORE = 0.5;

export function visionQuality(distance: DistanceMethod, extraReasons: readonly string[] = []): Quality {
  const reasons = [...(distance === 'ruler' ? [DISTANCE_NOT_MEASURED] : []), ...extraReasons];
  return reasons.length > 0 ? { score: FAIR_SCORE, label: 'fair', reasons } : { score: 1, label: 'good', reasons: [] };
}

function sourceOf(method: string, testMode: boolean): NewObservation['source'] {
  return testMode
    ? { kind: 'simulated', method: `${method}; scripted test mode`, label: 'SIMULATED' }
    : { kind: 'manual', method, label: 'MEASURED' };
}

export interface AmslerObsInput {
  crewId: string;
  missionDay: number;
  eye: Eye;
  diff: AmslerDiff;
  mapId: string;
  distance: DistanceMethod;
  testMode: boolean;
}

export function buildAmslerObservation(i: AmslerObsInput): NewObservation {
  return {
    crewId: i.crewId,
    signalId: 'amsler',
    value: i.diff.count,
    unit: '{areas}',
    components: {
      newCells: i.diff.newCells,
      newCentralCells: i.diff.newCentralCells,
      centralCells: i.diff.centralCount,
      peripheralCells: i.diff.count - i.diff.centralCount,
    },
    missionDay: i.missionDay,
    context: { eye: i.eye },
    attachments: [{ kind: 'amsler-map', ref: i.mapId }],
    source: sourceOf(AMSLER_METHOD, i.testMode),
    quality: visionQuality(i.distance),
  };
}

export const resolutionLimitText = (logMAR: number): string => `screen resolution limit reached at logMAR ${logMAR.toFixed(1)}`;

export interface AcuityObsInput {
  crewId: string;
  missionDay: number;
  eye: Eye;
  score: AcuityScore;
  withGlasses: boolean;
  seed: number;
  distance: DistanceMethod;
  testMode: boolean;
}

export type AcuityObsResult = { ok: true; observation: NewObservation } | { ok: false; reason: string };

export function buildAcuityObservation(i: AcuityObsInput): AcuityObsResult {
  const { score } = i;
  if (score.logMAR === null || score.lastPassed === null) {
    return { ok: false, reason: `${eyeName(i.eye)}: no line was passed (fewer than 3 of 5 on the largest line), so there is no score to save.` };
  }
  const extra = score.resolutionLimited && score.limitLogMAR !== null ? [resolutionLimitText(score.limitLogMAR)] : [];
  return {
    ok: true,
    observation: {
      crewId: i.crewId,
      signalId: 'near_acuity',
      value: score.logMAR,
      unit: '{logMAR}',
      components: {
        lastPassedLogMAR: score.lastPassed,
        extraCorrect: score.extraCorrect,
        resolutionLimited: score.resolutionLimited ? 1 : 0,
      },
      missionDay: i.missionDay,
      context: { eye: i.eye, withGlasses: i.withGlasses },
      source: sourceOf(`${ACUITY_METHOD}; seed ${i.seed}`, i.testMode),
      quality: visionQuality(i.distance, extra),
    },
  };
}
