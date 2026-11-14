// MOCK personal series for /dev/ui and tests ONLY. Band = ref ± 2σ (doc 08 §6).
import type { PersonalResult } from '../../domain/types';
import type { FlagDensityDay } from '../../state/ui';

/**
 * K. Osei resting HR, days 127–143 (doc 08 TV-8): reference (58, 2) → band 54–62; days 127–140 at 58 NOMINAL;
 * 141 = 63 WATCH, 142 = 68 WATCH, 143 = 69 ACT.
 */
export const mockOseiHeartRateSeries: PersonalResult['series'] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    missionDay: 127 + i,
    value: 58,
    lo: 54,
    hi: 62,
    state: 'NOMINAL' as const,
  })),
  { missionDay: 141, value: 63, lo: 54, hi: 62, state: 'WATCH' },
  { missionDay: 142, value: 68, lo: 54, hi: 62, state: 'WATCH' },
  { missionDay: 143, value: 69, lo: 54, hi: 62, state: 'ACT' },
];

/**
 * Sleep (doc 08 TV-4): pre-flight nights [7.2, 6.9, 7.5, 7.0, 7.1] → median 7.1, σ 0.3 → band 6.5–7.7;
 * in flight the expected shift −0.9 h gives reference 6.2 → band 5.6–6.8; TV-4a 3-night mean 6.2 → NOMINAL.
 * Pre-flight day positions (L-50 … L-10) are display placement only.
 */
export const mockSleepSeries: PersonalResult['series'] = [
  { missionDay: -50, value: 7.2, lo: 6.5, hi: 7.7, state: 'NOMINAL' },
  { missionDay: -40, value: 6.9, lo: 6.5, hi: 7.7, state: 'NOMINAL' },
  { missionDay: -30, value: 7.5, lo: 6.5, hi: 7.7, state: 'NOMINAL' },
  { missionDay: -20, value: 7.0, lo: 6.5, hi: 7.7, state: 'NOMINAL' },
  { missionDay: -10, value: 7.1, lo: 6.5, hi: 7.7, state: 'NOMINAL' },
  { missionDay: 143, value: 6.2, lo: 5.6, hi: 6.8, state: 'NOMINAL' },
];

/**
 * Scrubber flag density built from the scenario days in seed/scenarios.json (one flag per affected crew member
 * per day; counts are illustrative, not engine output): CO₂ pocket 118–122, sleep debt 130–136, SANS drift 90,
 * silent infection 141–143 (WATCH, WATCH, ACT), SPE 143.
 */
export const mockFlagDensity: FlagDensityDay[] = [
  { missionDay: 90, watch: 1, act: 0 },
  ...[118, 119, 120, 121, 122].map((d) => ({ missionDay: d, watch: 2, act: d === 120 ? 1 : 0 })),
  ...[130, 131, 132, 133, 134, 135, 136].map((d) => ({
    missionDay: d,
    watch: 1,
    act: d === 133 || d === 136 ? 1 : 0,
  })),
  { missionDay: 141, watch: 1, act: 0 },
  { missionDay: 142, watch: 1, act: 0 },
  { missionDay: 143, watch: 1, act: 2 },
];
