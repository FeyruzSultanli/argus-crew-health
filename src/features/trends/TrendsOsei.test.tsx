// Acceptance: K. Osei's heart-rate chart has the excursion 63 / 68 / 69 on MD 141–143 with WATCH / WATCH / ACT
// and an ACT marker on MD 143, built from the generated mission (fake-indexeddb) exactly as the page builds it.
import 'fake-indexeddb/auto';

import { render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getSignal } from '../../domain/signals';
import { ArgusDB } from '../../services/db';
import { resetDemo } from '../../services/demo';
import { createHealthService, personalSeries, personalTracks } from '../../services/healthService';
import { presetRange } from './axis';
import { ChartCard } from './ChartCard';
import { eventsFor } from './events';
import { buildTrendModel } from './trendData';
import type { TrendModel } from './trendData';

const database = new ArgusDB('argus-trends-test');
const svc = createHealthService(database);
let model: TrendModel;
let model140: TrendModel;

async function hrModel(day: number): Promise<TrendModel> {
  const def = getSignal('heart_rate_rest');
  const [series, tracks, observations, assessments] = await Promise.all([
    personalSeries('c3', 'heart_rate_rest', day, database),
    personalTracks('c3', 'heart_rate_rest', day, database),
    svc.observations({ crewId: 'c3', signalId: 'heart_rate_rest', fromDay: -180, toDay: day }),
    svc.assess('c3', day),
  ]);
  const personal = assessments.find((a) => a.signalId === 'heart_rate_rest')?.layers.personal;
  return buildTrendModel({ def, range: presetRange('30', day), series, tracks, observations, personal });
}

beforeAll(async () => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  await resetDemo('mars-transit', { database, now: new Date('2026-11-14T15:52:00Z') });
  model = await hrModel(143);
  model140 = await hrModel(140);
}, 60_000);
afterAll(async () => {
  database.close();
  await database.delete();
});

describe('K. Osei resting heart rate trend (seeded mission)', () => {
  it('has the excursion 63 / 68 / 69 on MD 141–143 with WATCH / WATCH / ACT above a 54–62 band', () => {
    const pts = model.tracks[0]?.points ?? [];
    const exc = pts
      .filter((p) => p.missionDay >= 141)
      .map((p) => [p.missionDay, Math.round(p.value), p.state]);
    expect(exc).toEqual([
      [141, 63, 'WATCH'],
      [142, 68, 'WATCH'],
      [143, 69, 'ACT'],
    ]);
    const d143 = pts.find((p) => p.missionDay === 143);
    expect(Math.round(d143?.lo ?? 0)).toBe(54);
    expect(Math.round(d143?.hi ?? 0)).toBe(62);
    expect(model.markers.at(-1)).toMatchObject({ missionDay: 143, state: 'ACT' });
    expect(model.preflightBand).toBeDefined();
  });

  it('renders an accessible ACT marker for MD 143 and the Silent infection event', () => {
    const range = presetRange('30', 143);
    render(
      <ChartCard
        def={getSignal('heart_rate_rest')}
        model={model}
        range={range}
        todayDay={143}
        verdict="ACT"
        events={eventsFor('c3', 'heart_rate_rest', range)}
      />,
    );
    const flagged = screen.getByRole('list', { name: 'Resting heart rate: flagged days' });
    const act = within(flagged).getByTestId('flag-heart_rate_rest-act-143');
    expect(act).toHaveTextContent('MD 143');
    expect(act).toHaveTextContent('Act');
    expect(act).toHaveTextContent('69');
    expect(screen.getByTestId('event-silent-infection')).toHaveTextContent('Silent infection');
  });

  it('at MD 140 the excursion is not in view', () => {
    expect(model140.tracks[0]?.points.some((p) => p.missionDay > 140)).toBe(false);
    expect(model140.markers.filter((m) => m.state === 'ACT')).toEqual([]);
  });
});
