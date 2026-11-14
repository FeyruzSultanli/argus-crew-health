// Fixture builders for the Body page: MOCK assessments and series from src/test/fixtures (doc 08 TV-8 / TV-4).
// Used by the Body tests.
// Every signal without a fixture is NO_DATA.
import { CABIN_SIGNAL_IDS, signalList } from '../../domain/signals';
import type { Assessment, LayerResult, PersonalResult, SignalId } from '../../domain/types';
import { VERDICT_MEANING, actionFor, combine } from '../../domain/verdict';
import {
  mockAssessments,
  mockOseiHeartRateAct,
  mockOseiHeartRateSeries,
  mockSleepSeries,
} from '../../test/fixtures';

const FIXTURE_DAY = 143;
const CREW_IDS = ['c1', 'c2', 'c3', 'c4'] as const;

function noDataLayer(layer: LayerResult['layer']): LayerResult {
  return { layer, verdict: 'NO_DATA', reason: 'No recent reading.', sourceIds: [] };
}

function noData(crewId: string, signalId: SignalId, missionDay: number): Assessment {
  const def = signalList.find((d) => d.id === signalId);
  return {
    crewId,
    signalId,
    missionDay,
    layers: { personal: noDataLayer('personal'), space: noDataLayer('space'), earth: noDataLayer('earth') },
    quality: { score: 0, label: 'poor', reasons: ['no reading'] },
    verdict: 'NO_DATA',
    drivenBy: [],
    caughtOnlyByPersonal: false,
    action: def ? actionFor(def, 'NO_DATA') : { text: 'Measure to update.', kind: 'remeasure' },
    explanation: VERDICT_MEANING.NO_DATA,
  };
}

/** K. Osei resting HR on the series days 127–143: personal state from the mock series, combined by domain.combine. */
function oseiHeartRate(missionDay: number): Assessment | undefined {
  if (missionDay === FIXTURE_DAY) return mockOseiHeartRateAct;
  const point = mockOseiHeartRateSeries.find((p) => p.missionDay === missionDay);
  const def = signalList.find((d) => d.id === 'heart_rate_rest');
  if (!point || !def) return undefined;
  const base = mockOseiHeartRateAct;
  const personal: LayerResult = {
    ...base.layers.personal,
    verdict: point.state,
    reason: VERDICT_MEANING[point.state],
    numbers: undefined,
  };
  const c = combine(personal, base.layers.space, base.layers.earth, base.quality, def);
  return {
    ...base,
    missionDay,
    latest: base.latest && {
      ...base.latest,
      id: `mock-c3-heart_rate_rest-${missionDay}`,
      value: point.value,
      missionDay,
    },
    layers: { ...base.layers, personal },
    verdict: c.verdict,
    drivenBy: c.drivenBy,
    caughtOnlyByPersonal: c.caughtOnlyByPersonal,
    action: c.action,
    explanation: c.explanation,
  };
}

function fixtureFor(crewId: string, signalId: SignalId, missionDay: number): Assessment | undefined {
  if (crewId === 'c3' && signalId === 'heart_rate_rest') return oseiHeartRate(missionDay);
  if (missionDay !== FIXTURE_DAY) return undefined;
  return mockAssessments.find((a) => a.crewId === crewId && a.signalId === signalId);
}

/** One Assessment per registered signal of the subject. */
export function buildAssessments(crewId: string | 'cabin', missionDay: number): Assessment[] {
  const ids =
    crewId === 'cabin'
      ? signalList.filter((d) => CABIN_SIGNAL_IDS.includes(d.id))
      : signalList.filter((d) => !CABIN_SIGNAL_IDS.includes(d.id));
  return ids.map((d) => fixtureFor(crewId, d.id, missionDay) ?? noData(crewId, d.id, missionDay));
}

/** All crew (c1…c4) plus 'cabin'. */
export function buildAllAssessments(missionDay: number): Record<string, Assessment[]> {
  const out: Record<string, Assessment[]> = {};
  for (const id of CREW_IDS) out[id] = buildAssessments(id, missionDay);
  out.cabin = buildAssessments('cabin', missionDay);
  return out;
}

function seriesFor(crewId: string, signalId: SignalId): PersonalResult['series'] {
  if (crewId === 'c3' && signalId === 'heart_rate_rest') return mockOseiHeartRateSeries;
  if (crewId === 'c1' && signalId === 'sleep_duration') return mockSleepSeries;
  return [];
}

/** Personal series up to a day. */
export function buildSeries(crewId: string, signalId: SignalId, upToDay: number): PersonalResult['series'] {
  return seriesFor(crewId, signalId).filter((p) => p.missionDay <= upToDay);
}
