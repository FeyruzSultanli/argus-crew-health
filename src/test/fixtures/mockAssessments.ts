// MOCK data for /dev/ui and component tests ONLY. Never import from a screen.
// Numbers follow the docs' own examples: doc 08 TV-8 (K. Osei silent infection, day 143) and TV-4a/b (sleep);
// action texts are doc 07 §4.1 (heart rate) and the generic templates of doc 07 §3.
import type { Assessment, LayerResult, Observation, Quality } from '../../domain/types';

const GOOD: Quality = { score: 1, label: 'good', reasons: [] };

function obs(
  crewId: string,
  signalId: Observation['signalId'],
  value: number | null,
  unit: string,
  missionDay: number,
): Observation {
  return {
    id: `mock-${crewId}-${signalId}-${missionDay}`,
    crewId,
    signalId,
    value,
    unit,
    effectiveAt: '2026-11-14T07:30:00Z',
    missionDay,
    source: { kind: 'simulated', label: 'SIMULATED' },
    quality: GOOD,
  };
}

const noData = (layer: LayerResult['layer']): LayerResult => ({
  layer,
  verdict: 'NO_DATA',
  reason: 'No recent reading.',
  sourceIds: [],
});

/** K. Osei (c3), resting HR, day 143 — TV-8: x 69, z 5.5, S 11.5 → personal ACT; Earth/space NOMINAL. */
export const mockOseiHeartRateAct: Assessment = {
  crewId: 'c3',
  signalId: 'heart_rate_rest',
  missionDay: 143,
  latest: obs('c3', 'heart_rate_rest', 69, '/min', 143),
  layers: {
    personal: {
      layer: 'personal',
      verdict: 'ACT',
      reason: 'Your pulse is higher than usual: 69 vs your usual 58 for three days in a row.',
      sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
      numbers: { z: 5.5, cusum: 11.5, ref: 58, sigma: 2 },
    },
    space: {
      layer: 'space',
      verdict: 'NOMINAL',
      reason: 'Inside the space band 50–100 bpm.',
      sourceIds: ['SRC_DEMO_RULE_BANDS', 'SRC_NASA_RISKS'],
    },
    earth: {
      layer: 'earth',
      verdict: 'NOMINAL',
      reason: 'Inside the Earth reference range.',
      sourceIds: ['SRC_EARTH_VITALS_GENERAL', 'SRC_DEMO_RULE_BANDS'],
    },
  },
  quality: GOOD,
  verdict: 'ACT',
  drivenBy: ['personal'],
  caughtOnlyByPersonal: true,
  action: {
    text: 'Tell the CMO. Check temperature and symptoms. Open protocol: Suspected infection / overreaching.',
    kind: 'protocol',
    protocolId: 'suspected-infection',
  },
  explanation:
    'Only your personal baseline flags this: 69 bpm is normal for Earth and space rules, but not for you.',
};

/** R. Vance (c1), sleep, TV-4a: 3-night mean 6.2 h → personal NOMINAL, space EXPECTED, Earth WATCH → EXPECTED. */
export const mockSleepExpected: Assessment = {
  crewId: 'c1',
  signalId: 'sleep_duration',
  missionDay: 143,
  latest: obs('c1', 'sleep_duration', 6.2, 'h', 143),
  layers: {
    personal: {
      layer: 'personal',
      verdict: 'NOMINAL',
      reason: 'At your in-flight reference of 6.2 h.',
      sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
      numbers: { z: 0, ref: 6.2, sigma: 0.3 },
    },
    space: {
      layer: 'space',
      verdict: 'EXPECTED',
      reason: 'Typical in flight; protect your sleep.',
      sourceIds: ['SRC_SLEEP_BARGER'],
    },
    earth: {
      layer: 'earth',
      verdict: 'WATCH',
      reason: 'Below the 7 h adults are advised to sleep.',
      sourceIds: ['SRC_EARTH_SLEEP_7H'],
    },
  },
  quality: GOOD,
  verdict: 'EXPECTED',
  drivenBy: ['space'],
  caughtOnlyByPersonal: false,
  action: { text: 'Known change in space. Keep doing your countermeasures.', kind: 'none' },
  explanation: 'Earth would flag this, but it is a known adaptation in space.',
};

/** M. Ito (c2), sleep, TV-4b: 3-night mean 5.3 h → WATCH on all three layers. */
export const mockSleepWatch: Assessment = {
  crewId: 'c2',
  signalId: 'sleep_duration',
  missionDay: 143,
  latest: obs('c2', 'sleep_duration', 5.3, 'h', 143),
  layers: {
    personal: {
      layer: 'personal',
      verdict: 'WATCH',
      reason: 'Shorter than your usual in-flight sleep (single point).',
      sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
      numbers: { z: 3, ref: 6.2, sigma: 0.3 },
    },
    space: {
      layer: 'space',
      verdict: 'WATCH',
      reason: 'Below 5.5 h, under the in-flight norm.',
      sourceIds: ['SRC_SLEEP_BARGER', 'SRC_DEMO_RULE_BANDS'],
    },
    earth: {
      layer: 'earth',
      verdict: 'WATCH',
      reason: 'Below the 7 h adults are advised to sleep.',
      sourceIds: ['SRC_EARTH_SLEEP_7H'],
    },
  },
  quality: GOOD,
  verdict: 'WATCH',
  drivenBy: ['personal', 'space', 'earth'],
  caughtOnlyByPersonal: false,
  action: { text: 'Re-measure. If it is still outside your usual range, tell the CMO.', kind: 'remeasure' },
  explanation: 'All three layers flag short sleep.',
};

/** L. Duarte (c4), glucose with no recent reading → NO_DATA (doc 07 §3 step 2; generic NO_DATA action). */
export const mockGlucoseNoData: Assessment = {
  crewId: 'c4',
  signalId: 'glucose',
  missionDay: 143,
  layers: { personal: noData('personal'), space: noData('space'), earth: noData('earth') },
  quality: { score: 0, label: 'poor', reasons: ['no reading'] },
  verdict: 'NO_DATA',
  drivenBy: [],
  caughtOnlyByPersonal: false,
  action: { text: 'Measure to update.', kind: 'remeasure' },
  explanation: 'No recent reading.',
};

/** L. Duarte (c4), resting HR at her simulated baseline 64 (seed/crew.json) → NOMINAL everywhere. */
export const mockDuarteHeartRateNominal: Assessment = {
  crewId: 'c4',
  signalId: 'heart_rate_rest',
  missionDay: 143,
  latest: obs('c4', 'heart_rate_rest', 64, '/min', 143),
  layers: {
    personal: {
      layer: 'personal',
      verdict: 'NOMINAL',
      reason: 'Within your usual range.',
      sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
    },
    space: {
      layer: 'space',
      verdict: 'NOMINAL',
      reason: 'Inside the space band.',
      sourceIds: ['SRC_DEMO_RULE_BANDS'],
    },
    earth: {
      layer: 'earth',
      verdict: 'NOMINAL',
      reason: 'Inside the Earth reference range.',
      sourceIds: ['SRC_EARTH_VITALS_GENERAL'],
    },
  },
  quality: GOOD,
  verdict: 'NOMINAL',
  drivenBy: ['personal', 'space', 'earth'],
  caughtOnlyByPersonal: false,
  action: { text: '', kind: 'none' },
  explanation: 'Within your usual range.',
};

/** One mock assessment per verdict, most severe first, across the four crew. */
export const mockAssessments: readonly Assessment[] = [
  mockOseiHeartRateAct,
  mockSleepWatch,
  mockSleepExpected,
  mockDuarteHeartRateNominal,
  mockGlucoseNoData,
];
