// PVT comparison block: neutral line while the domain hooks return undefined; verdict, layers and the action text
// verbatim once they return data; baseline lapses and last night's sleep from the record.
import 'fake-indexeddb/auto';

import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Assessment, NewObservation, PersonalResult, Quality } from '../../../domain/types';
import { db } from '../../../services/db';
import { healthService } from '../../../services/healthService';
import { PvtEvaluation, VERDICT_PENDING } from './PvtEvaluation';

const data = vi.hoisted(() => ({
  assessments: undefined as Assessment[] | undefined,
  series: undefined as PersonalResult['series'] | undefined,
}));
vi.mock('../labData', () => ({
  useAssessments: () => data.assessments,
  usePersonalSeries: () => data.series,
  useTodayPlan: () => undefined,
}));

const good: Quality = { score: 1, label: 'good', reasons: [] };
const sim = { kind: 'simulated', label: 'SIMULATED' } as const;
const run = (missionDay: number, lapses: number): NewObservation => ({
  crewId: 'c3',
  signalId: 'reaction_test',
  value: 3.8,
  unit: '/s',
  components: { medianRtMs: 260, lapses, falseStarts: 0, nStimuli: 64 },
  missionDay,
  source: sim,
  quality: good,
});

beforeAll(async () => {
  for (const o of [run(-30, 1), run(-23, 3), run(-16, 2), run(136, 2)]) await healthService.addObservation(o);
  await healthService.addObservation({ crewId: 'c3', signalId: 'sleep_duration', value: 5.9, unit: 'h', missionDay: 143, source: sim, quality: good });
});
afterAll(async () => {
  db.close();
  await db.delete();
});
beforeEach(() => {
  data.assessments = undefined;
  data.series = undefined;
});

const layer = (l: 'personal' | 'space' | 'earth', verdict: Assessment['verdict']) => ({ layer: l, verdict, reason: `${l} reason`, sourceIds: [] });

describe('PvtEvaluation', () => {
  it('without domain data: honest neutral lines; baseline lapses and sleep from the record', async () => {
    render(<PvtEvaluation crewId="c3" crewName="K. Osei" missionDay={143} saved />);
    expect(screen.getByRole('heading', { name: "Compared with K. Osei's simulated baseline" })).toBeInTheDocument();
    expect(screen.getByTestId('pvt-verdict-pending')).toHaveTextContent(VERDICT_PENDING);
    expect(screen.getByText('The personal band appears once the reading is evaluated.')).toBeInTheDocument();
    // median of pre-flight lapses 1, 3, 2 = 2 (day 136 is in flight, not pre-flight)
    expect(await screen.findByTestId('pvt-baseline-lapses')).toHaveTextContent('2');
    expect(screen.getByTestId('pvt-baseline-lapses')).toHaveTextContent('median of 3 runs');
    expect(await screen.findByText('5.9')).toBeInTheDocument();
  });

  it('with an assessment for today: StatusPill, layers and the action text verbatim', () => {
    data.series = [
      { missionDay: 136, value: 3.8, lo: 3.4, hi: 4.2, state: 'NOMINAL' },
      { missionDay: 143, value: 2.2, lo: 3.4, hi: 4.2, state: 'ACT' },
    ];
    data.assessments = [
      {
        crewId: 'c3',
        signalId: 'reaction_test',
        missionDay: 143,
        latest: { ...run(143, 45), id: 'x', missionDay: 143, effectiveAt: '2026-11-14T10:00:00Z' },
        layers: { personal: layer('personal', 'ACT'), space: layer('space', 'ACT'), earth: layer('earth', 'NO_DATA') },
        quality: good,
        verdict: 'ACT',
        drivenBy: ['personal', 'space'],
        caughtOnlyByPersonal: false,
        action: { text: 'ACTION TEXT FROM THE DOMAIN', kind: 'tell-cmo' },
        explanation: 'x',
      },
    ];
    render(<PvtEvaluation crewId="c3" crewName="K. Osei" missionDay={143} saved />);
    const v = screen.getByTestId('pvt-verdict');
    expect(v).toHaveTextContent('Act');
    expect(v).toHaveTextContent('ACTION TEXT FROM THE DOMAIN');
    expect(screen.getByRole('img', { name: /Mean response speed, 2 days/ })).toBeInTheDocument();
  });

  it('before saving, a stale assessment is not shown as this run’s verdict', () => {
    data.assessments = [
      {
        crewId: 'c3',
        signalId: 'reaction_test',
        missionDay: 143,
        layers: { personal: layer('personal', 'NOMINAL'), space: layer('space', 'NOMINAL'), earth: layer('earth', 'NO_DATA') },
        quality: good,
        verdict: 'NOMINAL',
        drivenBy: [],
        caughtOnlyByPersonal: false,
        action: { text: 'none', kind: 'none' },
        explanation: 'x',
      },
    ];
    render(<PvtEvaluation crewId="c3" crewName="K. Osei" missionDay={143} saved={false} />);
    expect(screen.getByTestId('pvt-verdict-pending')).toBeInTheDocument();
  });
});
