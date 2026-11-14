// Settings: scenario picker, jump-to-day clamping, calibration maths, reset confirm flow, Limits table.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { limits } from '../handbook/content';
import { useMissionStore } from '../../state/mission';
import { DEFAULT_PROFILE_ID, getProfile } from '../../state/missionSelectors';
import { useUiStore } from '../../state/ui';
import {
  CALIBRATION_STORAGE_KEY,
  DEFAULT_CAMERA_FOV_DEG,
  cardHeightPx,
  cardWidthPxFromPxPerMm,
  loadCalibration,
  mmToPx,
  parseCalibration,
  pxPerMmFromCardWidth,
  saveCalibration,
} from './calibration';
import { DEMO_SCENARIOS, parseDayInput, scenarioTarget } from './demoScenarios';
import { renderAt } from './providers.test-utils';

const reset = vi.hoisted(() => ({ fn: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../services/boot', () => ({ resetDemoAndStores: reset.fn }));
const replay = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(), setSpeed: vi.fn() }));
vi.mock('../../services/replay', () => ({
  startReplay: replay.start,
  stopReplay: replay.stop,
  setReplaySpeed: replay.setSpeed,
}));

const { default: SettingsPage } = await import('./SettingsPage');
const { default: LimitsPage } = await import('./LimitsPage');

const mars = getProfile(DEFAULT_PROFILE_ID);
const iss = getProfile('iss');
const byId = (id: string) => {
  const s = DEMO_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

beforeEach(() => {
  localStorage.clear();
  reset.fn.mockClear();
  useMissionStore.setState({
    profileId: DEFAULT_PROFILE_ID,
    missionDay: 100,
    demo: { controlsVisible: false },
  });
  useUiStore.setState({ selectedCrewId: null });
});

describe('scenario targets (pure)', () => {
  it('silent-infection → day 143 + c3, Body link', () => {
    expect(scenarioTarget(byId('silent-infection'), mars)).toEqual({
      day: 143,
      crewId: 'c3',
      link: { to: '/body/c3', label: 'Open Body' },
      occurs: true,
    });
  });
  it('sans-drift → day 90 + c1', () => {
    const t = scenarioTarget(byId('sans-drift'), mars);
    expect([t.day, t.crewId]).toEqual([90, 'c1']);
  });
  it('co2-spike and spe-event link to Environment and select no single crew member', () => {
    expect(scenarioTarget(byId('co2-spike'), mars)).toMatchObject({ day: 122, crewId: null });
    expect(scenarioTarget(byId('co2-spike'), mars).link.to).toBe('/environment');
    expect(scenarioTarget(byId('spe-event'), mars).link.to).toBe('/environment');
  });
  it('normal-adaptation jumps to the profile demo day', () => {
    expect(scenarioTarget(byId('normal-adaptation'), mars).day).toBe(mars.demoMissionDay);
  });
  it('on ISS (demo day 90) the silent infection does not occur, the SANS drift does', () => {
    expect(scenarioTarget(byId('silent-infection'), iss).occurs).toBe(false);
    expect(scenarioTarget(byId('sans-drift'), iss).occurs).toBe(true);
  });
});

describe('jump to day (pure)', () => {
  it('accepts in-range days', () => {
    expect(parseDayInput('120', mars)).toEqual({ ok: true, day: 120, clamped: false });
    expect(parseDayInput('-30', mars)).toEqual({ ok: true, day: -30, clamped: false });
    expect(parseDayInput('L-30', mars)).toEqual({ ok: true, day: -30, clamped: false });
  });
  it('clamps above the demo day, below L-180 and maps day 0 to day 1', () => {
    expect(parseDayInput('500', mars)).toEqual({ ok: true, day: 143, clamped: true });
    expect(parseDayInput('-400', mars)).toEqual({ ok: true, day: -180, clamped: true });
    expect(parseDayInput('0', mars)).toEqual({ ok: true, day: 1, clamped: true });
    expect(parseDayInput('120', iss)).toEqual({ ok: true, day: 90, clamped: true });
  });
  it('rejects non-integers', () => {
    expect(parseDayInput('12.5', mars).ok).toBe(false);
    expect(parseDayInput('abc', mars).ok).toBe(false);
    expect(parseDayInput('', mars).ok).toBe(false);
  });
});

describe('calibration maths', () => {
  it('ID-1 card width → px per mm and back', () => {
    expect(pxPerMmFromCardWidth(856)).toBeCloseTo(10, 10);
    expect(cardWidthPxFromPxPerMm(10)).toBeCloseTo(856, 10);
    expect(cardHeightPx(856)).toBeCloseTo(539.8, 6);
    expect(mmToPx(5, 4)).toBe(20);
    expect(() => pxPerMmFromCardWidth(0)).toThrow(RangeError);
  });
  it('stored record is validated; defaults on garbage', () => {
    expect(parseCalibration(null)).toEqual({ pxPerMm: null, cameraFovDeg: DEFAULT_CAMERA_FOV_DEG });
    expect(parseCalibration({ pxPerMm: -1, cameraFovDeg: 500 })).toEqual({
      pxPerMm: null,
      cameraFovDeg: 120,
    });
    saveCalibration({ pxPerMm: 3.78, cameraFovDeg: 70 });
    expect(JSON.parse(localStorage.getItem(CALIBRATION_STORAGE_KEY) ?? '{}')).toEqual({
      pxPerMm: 3.78,
      cameraFovDeg: 70,
    });
    expect(loadCalibration()).toEqual({ pxPerMm: 3.78, cameraFovDeg: 70 });
    localStorage.setItem(CALIBRATION_STORAGE_KEY, '{not json');
    expect(loadCalibration().pxPerMm).toBeNull();
  });
});

describe('Settings page', () => {
  it('hides demo controls by default, shows them with ?demo=1', () => {
    renderAt(<SettingsPage />, '/settings');
    expect(screen.queryByTestId('demo-controls')).toBeNull();
    renderAt(<SettingsPage />, '/settings?demo=1');
    expect(screen.getByTestId('demo-controls')).toBeInTheDocument();
  });

  it('the toggle persists in the mission store demo flags', () => {
    renderAt(<SettingsPage />, '/settings');
    fireEvent.click(screen.getByRole('switch', { name: /Show demo controls/ }));
    expect(useMissionStore.getState().demo.controlsVisible).toBe(true);
    expect(screen.getByTestId('demo-controls')).toBeInTheDocument();
  });

  it('scenario picker: silent infection → MD 143 + K. Osei; SANS drift → MD 90 + R. Vance', () => {
    renderAt(<SettingsPage />, '/settings?demo=1');
    fireEvent.click(screen.getByRole('button', { name: /Jump to scenario: Silent infection/ }));
    expect(useMissionStore.getState().missionDay).toBe(143);
    expect(useUiStore.getState().selectedCrewId).toBe('c3');
    expect(screen.getByTestId('demo-selected-crew')).toHaveTextContent('K. Osei');
    expect(screen.getByTestId('scenario-result')).toHaveTextContent('MD 143');
    expect(within(screen.getByTestId('scenario-result')).getByRole('link')).toHaveAttribute(
      'href',
      '/body/c3',
    );
    fireEvent.click(screen.getByRole('button', { name: /Jump to scenario: Vision change/ }));
    expect(useMissionStore.getState().missionDay).toBe(90);
    expect(useUiStore.getState().selectedCrewId).toBe('c1');
  });

  it('scenario outside the current profile offers to switch to Mars transit', () => {
    useMissionStore.setState({ profileId: 'iss', missionDay: 90 });
    renderAt(<SettingsPage />, '/settings?demo=1');
    fireEvent.click(screen.getByRole('button', { name: /Jump to scenario: Silent infection/ }));
    expect(useMissionStore.getState().missionDay).toBe(90);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Mars transit and jump' }));
    expect(useMissionStore.getState().profileId).toBe('mars-transit');
    expect(useMissionStore.getState().missionDay).toBe(143);
  });

  it('jump to day clamps and says so', () => {
    renderAt(<SettingsPage />, '/settings?demo=1');
    fireEvent.change(screen.getByTestId('day-input'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(useMissionStore.getState().missionDay).toBe(1);
    expect(screen.getByTestId('day-message')).toHaveTextContent('no day 0');
  });

  it('replay control starts the SPE replay engine at the chosen speed', () => {
    renderAt(<SettingsPage />, '/settings?demo=1');
    const start = screen.getByRole('button', { name: 'Start replay' });
    expect(start).toBeEnabled();
    expect(screen.queryByTestId('replay-unavailable')).toBeNull();
    fireEvent.click(start);
    expect(replay.start).toHaveBeenCalledWith(600);
  });

  it('reset demo asks for confirmation, then calls resetDemoAndStores and shows a toast', async () => {
    renderAt(<SettingsPage />, '/settings');
    fireEvent.click(screen.getByTestId('reset-demo'));
    const dialog = await screen.findByRole('dialog', { name: 'Reset the demo?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(reset.fn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('reset-demo'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('reset-confirm'));
    });
    expect(reset.fn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Demo reset')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reset the demo?' })).toBeNull());
  });

  it('units switch through the ui store', () => {
    renderAt(<SettingsPage />, '/settings');
    fireEvent.click(screen.getByRole('radio', { name: '°F' }));
    fireEvent.click(screen.getByRole('radio', { name: 'mmol/L' }));
    expect(useUiStore.getState().units).toEqual({ temp: '[degF]', glucose: 'mmol/L' });
    expect(screen.getByText('English (only language in this build)')).toBeInTheDocument();
  });
});

describe('Limits page', () => {
  it('renders every limits.json row with its kind and source badge', () => {
    renderAt(<LimitsPage />, '/limits');
    const table = screen.getByTestId('limits-table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(limits.dataKinds.length);
    for (const r of limits.dataKinds) {
      const row = within(table)
        .getByRole('rowheader', { name: new RegExp(r.label.replace(/[()]/g, '.')) })
        .closest('tr') as HTMLElement;
      expect(row).toHaveAttribute('data-kind', r.kind);
      expect((row as HTMLTableRowElement).cells[0]).toHaveTextContent(limits.kindLabels[r.kind]);
      if (r.sourceIds.length > 0)
        expect(within(row).getByRole('button', { name: /^Sources:/ })).toBeInTheDocument();
    }
  });
  it('shows the not-a-medical-device statement, non-goals, honest rPPG placeholder and credits', () => {
    renderAt(<LimitsPage />, '/limits');
    expect(screen.getByTestId('not-medical-device')).toHaveTextContent(limits.notMedicalDevice);
    for (const g of limits.nonGoals) expect(screen.getByText(g)).toBeInTheDocument();
    expect(screen.getByTestId('rppg-placeholder')).toHaveTextContent(
      'No paired validation against a reference device has been done yet.',
    );
    expect(
      within(screen.getByTestId('credits-table')).getByText(
        'HRA 3D Reference Library, HuBMAP Consortium / NIH 3D (3DPX-021022, 3DPX-021627)',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No NASA logos or insignia are used; the ARGUS mark is our own.'),
    ).toBeInTheDocument();
  });
});
