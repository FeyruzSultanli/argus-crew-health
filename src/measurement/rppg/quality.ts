// rPPG measurement quality — docs/09_MEASUREMENT_LAB.md §1.3.
// ALL thresholds below are demo parameters (our own choices) → SRC_DEMO_QUALITY_SCORES. Show "Demo parameter"
// wherever they are displayed.
import type { Quality } from '../../domain/types';
import type { CheckId, CheckLabel, QualityCheck } from './types';

export const QUALITY_SOURCE_ID = 'SRC_DEMO_QUALITY_SCORES';

export const QUALITY_THRESHOLDS = {
  /** Spectral SNR, dB: good ≥ 3, fair 0–3, poor < 0. */
  snrDb: { good: 3, fair: 0 },
  /** |HR(first 15 s) − HR(last 15 s)|, bpm: good ≤ 5, fair ≤ 10, poor > 10. */
  consistencyBpm: { good: 5, fair: 10 },
  /** SD of the landmark centroid, px at 640 px width: good ≤ 3, fair ≤ 8, poor > 8. */
  motionPx: { good: 3, fair: 8 },
  /** Mean ROI luminance and clipped %: good 60–200 & < 2 %, fair 40–220 & < 5 %, otherwise poor. */
  lighting: { good: { lo: 60, hi: 200, clipBelow: 2 }, fair: { lo: 40, hi: 220, clipBelow: 5 } },
  /** % of frames with a usable face: good ≥ 95, fair ≥ 80, poor < 80. */
  facePct: { good: 95, fair: 80 },
} as const;

const NORM: Record<CheckLabel, number> = { good: 1, fair: 0.5, poor: 0 };
const RANK: Record<CheckLabel, number> = { good: 0, fair: 1, poor: 2 };

function make(id: CheckId, label: CheckLabel, value: number, reason: string, value2?: number): QualityCheck {
  const c: QualityCheck = { id, label, norm: NORM[label], value };
  if (value2 !== undefined) c.value2 = value2;
  if (label !== 'good') c.reason = reason;
  return c;
}

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : x > 0 ? '∞' : '−∞');

export function checkSnr(db: number): QualityCheck {
  const t = QUALITY_THRESHOLDS.snrDb;
  const label: CheckLabel = db >= t.good ? 'good' : db >= t.fair ? 'fair' : 'poor';
  return make('snr', label, db, `weak pulse signal (SNR ${fmt(db)} dB)`);
}

export function checkConsistency(diffBpm: number): QualityCheck {
  const t = QUALITY_THRESHOLDS.consistencyBpm;
  const label: CheckLabel = diffBpm <= t.good ? 'good' : diffBpm <= t.fair ? 'fair' : 'poor';
  return make('consistency', label, diffBpm, `pulse changed by ${fmt(diffBpm, 0)} bpm between the first and last 15 s`);
}

export function checkMotion(sdPx: number): QualityCheck {
  const t = QUALITY_THRESHOLDS.motionPx;
  const label: CheckLabel = sdPx <= t.good ? 'good' : sdPx <= t.fair ? 'fair' : 'poor';
  return make('motion', label, sdPx, label === 'poor' ? 'too much movement' : 'some movement');
}

export function checkLighting(lum: number, clipPct: number): QualityCheck {
  const { good, fair } = QUALITY_THRESHOLDS.lighting;
  const label: CheckLabel =
    lum >= good.lo && lum <= good.hi && clipPct < good.clipBelow
      ? 'good'
      : lum >= fair.lo && lum <= fair.hi && clipPct < fair.clipBelow
        ? 'fair'
        : 'poor';
  const parts: string[] = [];
  if (lum < good.lo) parts.push(lum < fair.lo ? 'too dark' : 'a bit dark');
  if (lum > good.hi) parts.push(lum > fair.hi ? 'too bright' : 'a bit bright');
  if (clipPct >= good.clipBelow) parts.push(`overexposed skin (${fmt(clipPct)} % clipped)`);
  return make('lighting', label, lum, parts.join(', '), clipPct);
}

export function checkFacePresence(pct: number): QualityCheck {
  const t = QUALITY_THRESHOLDS.facePct;
  const label: CheckLabel = pct >= t.good ? 'good' : pct >= t.fair ? 'fair' : 'poor';
  return make('face', label, pct, `face not found or head tilted in ${fmt(100 - pct, 0)} % of frames`);
}

/** label = worst check; score = mean of normalised checks; reasons = plain words of every non-good check. */
export function combineQuality(checks: QualityCheck[]): Quality {
  if (checks.length === 0) return { score: 0, label: 'poor', reasons: ['no measurement data'] };
  let worst: CheckLabel = 'good';
  let sum = 0;
  const reasons: string[] = [];
  for (const c of checks) {
    if (RANK[c.label] > RANK[worst]) worst = c.label;
    sum += c.norm;
    if (c.reason) reasons.push(c.reason);
  }
  return { score: Math.round((sum / checks.length) * 100) / 100, label: worst, reasons };
}

export interface QualityInput {
  snrDb: number;
  /** Omitted for live estimates (needs the full 30 s). */
  consistencyBpm?: number;
  motionSdPx: number;
  meanLum: number;
  clipPct: number;
  facePct: number;
}

export function assessQuality(q: QualityInput): { quality: Quality; checks: QualityCheck[] } {
  const checks = [checkSnr(q.snrDb)];
  if (q.consistencyBpm !== undefined) checks.push(checkConsistency(q.consistencyBpm));
  checks.push(checkMotion(q.motionSdPx), checkLighting(q.meanLum, q.clipPct), checkFacePresence(q.facePct));
  return { quality: combineQuality(checks), checks };
}
