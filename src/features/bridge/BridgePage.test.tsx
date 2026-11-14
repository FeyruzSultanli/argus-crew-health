// Component tests: plan rows (status → checkbox, Start links, Skip) and role views. Live hooks are mocked with
// day-143-shaped fixtures so the page is tested as a pure function of (role, crew, missionDay).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mkAssessment, mkObs } from '../../domain/readiness/fixtures.test-utils';
import type { Assessment, CrewMember, Task } from '../../domain/types';
import { useSessionStore } from '../../state/session';
import { useMissionStore } from '../../state/mission';
import { useUiStore } from '../../state/ui';

const h = vi.hoisted(() => ({
  all: undefined as Record<string, Assessment[]> | undefined,
  plans: {} as Record<string, Task[] | undefined>,
  crew: [] as CrewMember[],
  setTaskStatus: vi.fn(() => Promise.resolve()),
  listeners: new Set<() => void>(),
}));
/** Replace the plans and notify the mocked live hook (like a Dexie write re-running useLiveQuery). */
const writePlans = (plans: Record<string, Task[] | undefined>) => {
  h.plans = plans;
  for (const l of h.listeners) l();
};

vi.mock('../../services/hooks', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (l: () => void) => {
    h.listeners.add(l);
    return () => h.listeners.delete(l);
  };
  return {
    useAllAssessments: () => h.all,
    useAssessments: (id: string) => h.all?.[id],
    useTodayPlan: (id: string) => useSyncExternalStore(subscribe, () => h.plans[id]),
    useCrew: () => h.crew,
    useSpaceWeatherView: () => undefined, // tile shows its placeholder; the radiation service has its own tests
  };
});
vi.mock('../../services/healthService', () => ({ setTaskStatus: h.setTaskStatus }));
vi.mock('./hooks', () => ({ useCrewHistories: () => ({}) }));

const { default: BridgePage } = await import('./BridgePage');

const member = (id: string, displayName: string, isCMO = false): CrewMember => ({
  id,
  displayName,
  role: isCMO ? 'Mission specialist' : 'Flight engineer',
  isCMO,
  sex: 'female',
  ageYears: 40,
  careerDoseMsvPreMission: 0,
  simulatedBaseline: { exercise_plan_min: 120 },
});

const task = (
  crewId: string,
  signalId: Task['signalId'],
  status: Task['status'],
  kind: Task['kind'] = 'measure',
): Task => ({
  id: `${crewId}:143:${signalId}`,
  crewId,
  missionDay: 143,
  kind,
  signalId,
  title: `Do ${signalId}`,
  why: 'Daily reading.',
  status,
  points: kind === 'checkin' ? 5 : 10,
});

function day143(): Record<string, Assessment[]> {
  return {
    c1: [mkAssessment('c1', 'sleep_duration', 'EXPECTED', { E: 'WATCH', numbers: { value: 6.6 } })],
    c2: [mkAssessment('c2', 'reaction_test', 'WATCH', { P: 'NOMINAL', S: 'WATCH', E: 'NO_DATA' })],
    c3: [
      mkAssessment('c3', 'heart_rate_rest', 'ACT', {
        P: 'ACT',
        S: 'NOMINAL',
        E: 'NOMINAL',
        caught: true,
        action: 'Tell the CMO. Check temperature and symptoms.',
      }),
      mkAssessment('c3', 'body_temp', 'WATCH', { P: 'WATCH', S: 'NOMINAL', E: 'NOMINAL', caught: true }),
      mkAssessment('c3', 'sleep_duration', 'EXPECTED', { E: 'WATCH', numbers: { value: 7.1 } }),
      mkAssessment('c3', 'mood', 'NOMINAL'),
    ],
    c4: [mkAssessment('c4', 'sleep_duration', 'EXPECTED', { E: 'WATCH', numbers: { value: 5.9 } })],
    cabin: [],
  };
}

function renderBridge() {
  const router = createMemoryRouter(
    [
      { path: '/', Component: BridgePage },
      { path: '/body/:crewId', Component: () => <p>body page</p> },
      { path: '/lab/:flow', Component: () => <p>lab page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  h.all = day143();
  h.crew = [
    member('c1', 'R. Vance'),
    member('c2', 'M. Ito'),
    member('c3', 'K. Osei'),
    member('c4', 'L. Duarte', true),
  ];
  h.plans = {
    c3: [
      task('c3', 'reaction_test', 'due'),
      task('c3', 'blood_pressure', 'overdue'),
      task('c3', 'symptoms', 'due', 'checkin'),
      task('c3', 'heart_rate_rest', 'done'),
      task('c3', 'glucose', 'skipped'),
    ],
    c4: [task('c4', 'reaction_test', 'due')],
  };
  h.setTaskStatus.mockClear();
  useMissionStore.setState({ missionDay: 143, profileId: 'mars-transit' });
  useUiStore.setState({ selectedCrewId: null });
});

const signIn = (role: 'crew' | 'cmo' | 'surgeon', crewId: string | null) =>
  useSessionStore.setState({ role, crewId, signedIn: true });

describe('Today plan rows', () => {
  beforeEach(() => signIn('crew', 'c3'));

  it('checkbox state follows task.status', () => {
    renderBridge();
    const status = (id: string) => screen.getByTestId(`plan-row-${id}`).getAttribute('data-status');
    expect(status('reaction_test')).toBe('due');
    expect(
      within(screen.getByTestId('plan-row-heart_rate_rest')).getByRole('img', { name: 'Done' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('plan-row-blood_pressure')).getByRole('img', { name: 'Overdue' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('plan-row-glucose')).getByRole('img', { name: 'Skipped' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('plan-row-heart_rate_rest')).queryByRole('link', { name: /Start/ }),
    ).toBeNull();
  });

  it('Start deep-links to the Lab flow and selects the crew member first', async () => {
    const router = renderBridge();
    const start = screen.getByRole('link', { name: 'Start: Do reaction_test' });
    expect(start).toHaveAttribute('href', '/lab/pvt');
    expect(screen.getByRole('link', { name: 'Start: Do blood_pressure' })).toHaveAttribute(
      'href',
      '/lab/manual',
    );
    fireEvent.click(start);
    expect(useUiStore.getState().selectedCrewId).toBe('c3');
    await screen.findByText('lab page');
    expect(router.state.location.pathname).toBe('/lab/pvt');
  });

  it('Start of a check-in item focuses the Quick check-in on the page', () => {
    renderBridge();
    fireEvent.click(screen.getByRole('button', { name: 'Start: Do symptoms' }));
    expect(document.activeElement?.id).toBe('quick-checkin');
  });

  it('Skip and Undo call setTaskStatus', () => {
    renderBridge();
    fireEvent.click(screen.getByRole('button', { name: 'Skip: Do reaction_test' }));
    expect(h.setTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ signalId: 'reaction_test' }),
      'skipped',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo skip: Do glucose' }));
    expect(h.setTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ signalId: 'glucose' }), 'due');
  });

  it('re-renders when the hook returns a changed task list (reaction test saved → done)', () => {
    renderBridge();
    expect(screen.getByTestId('plan-row-reaction_test')).toHaveAttribute('data-status', 'due');
    act(() =>
      writePlans({
        ...h.plans,
        c3: (h.plans.c3 ?? []).map((t) =>
          t.signalId === 'reaction_test' ? { ...t, status: 'done' as const } : t,
        ),
      }),
    );
    expect(screen.getByTestId('plan-row-reaction_test')).toHaveAttribute('data-status', 'done');
  });
});

describe('role views', () => {
  it('crew member sees only own data: hero, plan, no Crew at a glance', () => {
    signIn('crew', 'c3');
    renderBridge();
    expect(
      screen.getByRole('heading', { level: 2, name: /K\. Osei — your status today/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('hero')).toHaveAttribute('data-verdict', 'ACT');
    // 100 − 25 (ACT) − 10 (WATCH) − 2 (the fixture's one overdue task) = 63; the shipped seed has no overdue task → 65
    expect(screen.getByTestId('readiness-ring')).toHaveAttribute('data-score', '63');
    expect(screen.getByTestId('hero-summary')).toHaveTextContent(
      'Resting heart rate needs action now; body temperature is on watch.',
    );
    expect(screen.queryByTestId('crew-at-a-glance')).toBeNull();
    expect(screen.queryByText('M. Ito')).toBeNull();
    expect(screen.getByTestId('caught-only-counter')).toHaveTextContent('2');
    expect(screen.getByText('Your signals today')).toBeInTheDocument();
  });

  it('CMO sees own hero plus Crew at a glance sorted by severity, K. Osei Act with the marker', () => {
    signIn('cmo', 'c4');
    renderBridge();
    expect(
      screen.getByRole('heading', { level: 2, name: /L\. Duarte — your status today/ }),
    ).toBeInTheDocument();
    const rows = within(screen.getByTestId('crew-at-a-glance')).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'crew-row-c3',
      'crew-row-c2',
      'crew-row-c4',
      'crew-row-c1',
    ]);
    const osei = screen.getByTestId('crew-row-c3');
    expect(within(osei).getByText('Act')).toBeInTheDocument();
    expect(within(osei).getByText('Caught only by personal baseline')).toBeInTheDocument();
    expect(within(osei).getByRole('link')).toHaveAttribute('href', '/body/c3');
    expect(screen.getByText('Across 4 crew today')).toBeInTheDocument();
  });

  it('CMO row click selects the crew member and opens the body view', async () => {
    signIn('cmo', 'c4');
    const router = renderBridge();
    fireEvent.click(within(screen.getByTestId('crew-row-c3')).getByRole('link'));
    expect(useUiStore.getState().selectedCrewId).toBe('c3');
    await screen.findByText('body page');
    expect(router.state.location.pathname).toBe('/body/c3');
  });

  it('flight surgeon sees a calm notice and no crew data', () => {
    signIn('surgeon', null);
    renderBridge();
    expect(screen.getByText(/shows only data received over the Earth link/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Earth link' })).toHaveAttribute('href', '/earth');
    expect(screen.queryByTestId('hero')).toBeNull();
    expect(screen.queryByText('K. Osei')).toBeNull();
  });

  it('loading → skeletons; no data → empty state', () => {
    signIn('crew', 'c3');
    h.all = undefined;
    const { unmount } = render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', Component: BridgePage }], { initialEntries: ['/'] })}
      />,
    );
    expect(screen.getByText('Loading your status')).toBeInTheDocument();
    unmount();
    h.all = { c3: [mkAssessment('c3', 'mood', 'NO_DATA')] };
    renderBridge();
    expect(screen.getByText('No readings yet for K. Osei')).toBeInTheDocument();
  });
});

describe('right column tiles', () => {
  it('cabin tile: CO₂ 1-h and 7-day rings with the sourced limits, temperature and humidity', () => {
    signIn('crew', 'c3');
    const co2 = mkAssessment('cabin', 'cabin_co2', 'NOMINAL', { numbers: { last1h: 2.4, avg7d: 2.3 } });
    co2.latest = { ...mkObs('cabin', 'cabin_co2', 143, 2.4), unit: 'mm[Hg]', components: { avg7d: 2.33 } };
    const temp = mkAssessment('cabin', 'cabin_temp', 'NOMINAL');
    temp.latest = { ...mkObs('cabin', 'cabin_temp', 143, 21.8), unit: 'Cel' };
    h.all = { ...day143(), cabin: [co2, temp] };
    renderBridge();
    const tile = screen.getByTestId('cabin-tile');
    expect(within(tile).getByText('CO₂ 1-h · mmHg')).toBeInTheDocument();
    expect(within(tile).getByText('CO₂ 7-day · mmHg')).toBeInTheDocument();
    expect(within(tile).getByText('3.0')).toBeInTheDocument();
    expect(within(tile).getByText('2.5')).toBeInTheDocument();
    expect(within(tile).getByText('21.8')).toBeInTheDocument();
    expect(within(tile).getByText('Simulated')).toBeInTheDocument();
  });

  it('space weather tile is an honest placeholder without state, and renders state when passed', async () => {
    const { SpaceWeatherTile } = await import('./SpaceWeatherTile');
    const { unmount } = render(
      <RouterProvider router={createMemoryRouter([{ path: '/', Component: () => <SpaceWeatherTile /> }])} />,
    );
    expect(screen.getByText(/Space weather feed connects here/)).toBeInTheDocument();
    expect(screen.getByText('SNAPSHOT')).toBeInTheDocument();
    expect(screen.queryByText('pfu')).toBeNull();
    unmount();
    const state = {
      mode: 'LIVE' as const,
      protons10: [
        { timeTag: '2026-11-14T10:00:00Z', energy: '>=10 MeV', fluxPfu: 0.3 },
        { timeTag: '2026-11-14T10:05:00Z', energy: '>=10 MeV', fluxPfu: 0.48 },
      ],
      protons100: [],
      sScale: 0 as const,
      s100Alert: false,
      sepEvents: [],
    };
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', Component: () => <SpaceWeatherTile state={state} /> }])}
      />,
    );
    expect(screen.getByText('0.48')).toBeInTheDocument();
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
    expect(screen.queryByText(/feed connects here/)).toBeNull();
    // LIVE numbers cite the NOAA source only (✓ verified).
    const tile = screen.getByTestId('space-weather-tile');
    for (const el of tile.querySelectorAll('[data-source-status]')) {
      expect(el.getAttribute('data-source-status')).toBe('verified');
    }
  });

  it('space weather tile in REPLAY: numbers cite the demo radiation model and carry the REPLAY label', async () => {
    const { SpaceWeatherTile } = await import('./SpaceWeatherTile');
    const state = {
      mode: 'REPLAY' as const,
      protons10: [{ timeTag: '2026-11-14T10:00:00Z', energy: '>=10 MeV', fluxPfu: 120 }],
      protons100: [],
      sScale: 2 as const,
      s100Alert: false,
      sepEvents: [],
    };
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', Component: () => <SpaceWeatherTile state={state} /> }])}
      />,
    );
    const tile = screen.getByTestId('space-weather-tile');
    const badges = [...tile.querySelectorAll('[data-source-status]')];
    expect(badges).toHaveLength(2); // S-scale and ≥10 MeV flux
    for (const el of badges) expect(el.getAttribute('data-source-status')).toBe('demo');
    // Mode badge + the label on both <Value>s.
    expect(within(tile).getAllByText('REPLAY').length).toBeGreaterThanOrEqual(3);
  });

  it('Earth link tile: 11 min modeled delay on Mars transit day 143', () => {
    signIn('crew', 'c3');
    renderBridge();
    const delay = screen.getByTestId('earth-delay');
    expect(delay).toHaveTextContent('11');
    expect(delay).toHaveTextContent('min');
    expect(delay).toHaveTextContent('modeled delay (demo)');
  });
});
