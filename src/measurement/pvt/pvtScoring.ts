// Reaction Self-Test metrics — docs/09_MEASUREMENT_LAB.md §4, doc 07 §4.9.
// Median RT and mean response speed (mean of 1000/RT, s⁻¹) use valid responses only: false starts are excluded,
// a 30-s timeout counts as a lapse with RT = 30 000 ms. Performance score = 1 − (lapses + false starts) / number of
// stimuli [SRC_PVT_B_BASNER2011].
import type { PvtResponse } from './pvtEngine';

export interface PvtScore {
  /** Stimuli shown (responded or timed out). Presses with no stimulus are not stimuli. */
  nStimuli: number;
  /** Responses used for median RT and speed (stimulus shown, not a false start). */
  nRtResponses: number;
  medianRtMs: number | null;
  /** Mean of 1000/RT over valid responses, s⁻¹. */
  meanSpeed: number | null;
  lapses: number;
  falseStarts: number;
  timeouts: number;
  /** 0..1; null when no stimulus was shown. Clamped at 0 (presses with no stimulus can outnumber stimuli). */
  performanceScore: number | null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function scorePvt(responses: readonly PvtResponse[]): PvtScore {
  const nStimuli = responses.filter((r) => r.stimulus).length;
  const rts = responses
    .filter((r) => r.stimulus && r.kind !== 'false-start' && r.rtMs !== null)
    .map((r) => r.rtMs as number);
  const lapses = responses.filter((r) => r.kind === 'lapse').length;
  const falseStarts = responses.filter((r) => r.kind === 'false-start').length;
  const timeouts = responses.filter((r) => r.timedOut).length;
  const meanSpeed = rts.length ? rts.reduce((acc, rt) => acc + 1000 / rt, 0) / rts.length : null;
  const performanceScore = nStimuli > 0 ? Math.max(0, Math.min(1, 1 - (lapses + falseStarts) / nStimuli)) : null;
  return { nStimuli, nRtResponses: rts.length, medianRtMs: median(rts), meanSpeed, lapses, falseStarts, timeouts, performanceScore };
}
