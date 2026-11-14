// Quality layer: staleness (doc 04 FR-SIG-5) + pass-through of the best reading's quality (doc 07 §3 step 9).
import type { Observation, QualityResult } from '../types';
import { missionDaysBetween } from '../units';

/** FR-SIG-5 multipliers — demo parameters [SRC_DEMO_QUALITY_SCORES]. */
export const STALE_REMEASURE_FACTOR = 1.5;
export const STALE_NO_DATA_FACTOR = 3;
export const QUALITY_SOURCE_IDS = ['SRC_DEMO_QUALITY_SCORES'] as const;

const LABEL_RANK: Record<QualityResult['label'], number> = { poor: 0, fair: 1, good: 2 };

/** Best-quality reading: highest score, then best label, then the later reading. */
export function bestReading(observations: readonly Observation[]): Observation | undefined {
  let best: Observation | undefined;
  for (const o of observations) {
    if (
      best === undefined ||
      o.quality.score > best.quality.score ||
      (o.quality.score === best.quality.score &&
        LABEL_RANK[o.quality.label] >= LABEL_RANK[best.quality.label])
    ) {
      best = o;
    }
  }
  return best;
}

export type Staleness = QualityResult['stale'];

/** 'remeasure' when older than cadence × 1.5, 'no-data' when older than cadence × 3 (FR-SIG-5). */
export function staleness(ageDays: number, cadenceDays: number): Staleness {
  if (ageDays > cadenceDays * STALE_NO_DATA_FACTOR) return 'no-data';
  if (ageDays > cadenceDays * STALE_REMEASURE_FACTOR) return 'remeasure';
  return 'fresh';
}

/**
 * @param observationsOfDay readings of the latest mission day that has a reading
 * @param latestObservationDay that mission day (null when the signal has no reading at all)
 * @param missionDay the day being assessed
 * @param cadenceDays the signal's expected measurement interval
 */
export function evaluateQuality(
  observationsOfDay: readonly Observation[],
  latestObservationDay: number | null,
  missionDay: number,
  cadenceDays: number,
): QualityResult {
  const best = bestReading(observationsOfDay);
  if (best === undefined || latestObservationDay === null) {
    return { score: 0, label: 'poor', reasons: ['No reading yet'], stale: 'no-data' };
  }
  const age = Math.max(0, missionDaysBetween(latestObservationDay, missionDay));
  const stale = staleness(age, cadenceDays);
  const reasons = [...best.quality.reasons];
  if (stale === 'remeasure') reasons.push(`Last reading ${age} d ago — re-measure due`);
  if (stale === 'no-data') reasons.push(`Last reading ${age} d ago — too old to judge`);
  return { score: best.quality.score, label: best.quality.label, reasons, stale };
}
