// NOAA solar radiation storm scale (doc 10 §2) [SRC_NOAA_SWPC_PROTONS · verified].
// S1–S5 on the ≥10 MeV integral flux: 10 / 100 / 1,000 / 10,000 / 100,000 pfu. s100Alert = ≥100 MeV flux ≥ 1 pfu.
// NOAA requires sustained exceedance for official thresholds; for display we debounce: a level (or the alert) holds
// only when the latest 3 consecutive 5-min samples are all at or above its threshold. A single dip below resets it.
import type { ProtonSample, SScale } from '../types';

export const S_SCALE_SOURCE_IDS = ['SRC_NOAA_SWPC_PROTONS'] as const;

/** ≥10 MeV thresholds in pfu for S1 … S5 (index 0 = S1). */
export const S_THRESHOLDS_PFU = [10, 100, 1_000, 10_000, 100_000] as const;
/** ≥100 MeV alert threshold in pfu. */
export const S100_ALERT_PFU = 1;
/** Number of consecutive samples that must all exceed a threshold (debounce). */
export const DEBOUNCE_POINTS = 3;

/** Instantaneous S level of one ≥10 MeV flux value (no debounce). */
export function sLevelOf(fluxPfu: number): SScale {
  let level = 0;
  for (const t of S_THRESHOLDS_PFU) if (fluxPfu >= t) level++;
  return level as SScale;
}

/** Threshold (pfu) of an S level ≥ 1. */
export function sThreshold(level: Exclude<SScale, 0>): number {
  return S_THRESHOLDS_PFU[level - 1] as number;
}

function minOfLast(samples: readonly ProtonSample[], end: number, n: number): number | null {
  if (end + 1 < n) return null;
  let m = Infinity;
  for (let i = end - n + 1; i <= end; i++) m = Math.min(m, (samples[i] as ProtonSample).fluxPfu);
  return m;
}

/**
 * Debounced S level at sample index `end` (default: the latest sample): the highest level whose threshold the last
 * 3 samples up to `end` all reach. Fewer than 3 samples → S0. Samples must be one channel, oldest first.
 */
export function debouncedSScale(protons10: readonly ProtonSample[], end = protons10.length - 1): SScale {
  const m = minOfLast(protons10, end, DEBOUNCE_POINTS);
  return m === null ? 0 : sLevelOf(m);
}

/** Debounced ≥100 MeV alert at sample index `end` (default latest): the last 3 samples all ≥ 1 pfu. */
export function debouncedS100Alert(
  protons100: readonly ProtonSample[],
  end = protons100.length - 1,
): boolean {
  const m = minOfLast(protons100, end, DEBOUNCE_POINTS);
  return m !== null && m >= S100_ALERT_PFU;
}

/** Human label: "S0 — no storm", "S2 — moderate" (NOAA scale words). */
export const S_SCALE_WORD: Record<SScale, string> = {
  0: 'No storm',
  1: 'Minor',
  2: 'Moderate',
  3: 'Strong',
  4: 'Severe',
  5: 'Extreme',
};
