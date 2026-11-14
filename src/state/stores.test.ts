import { beforeEach, describe, expect, it } from 'vitest';

import { useMissionStore } from './mission';
import { DEMO_PIN, useSessionStore } from './session';
import { useUiStore } from './ui';

beforeEach(() => {
  localStorage.clear();
  useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143 });
  useSessionStore.getState().signOut();
});

describe('useMissionStore', () => {
  it('defaults to Mars transit, day 143', () => {
    const s = useMissionStore.getState();
    expect(s.profileId).toBe('mars-transit');
    expect(s.missionDay).toBe(143);
  });
  it('setMissionDay clamps and skips day 0', () => {
    const { setMissionDay } = useMissionStore.getState();
    setMissionDay(0);
    expect(useMissionStore.getState().missionDay).toBe(1);
    setMissionDay(999);
    expect(useMissionStore.getState().missionDay).toBe(143);
    setMissionDay(-999);
    expect(useMissionStore.getState().missionDay).toBe(-180);
  });
  it('setProfile jumps to that profile’s demo day; resetToToday returns there', () => {
    useMissionStore.getState().setProfile('iss');
    expect(useMissionStore.getState().missionDay).toBe(90);
    useMissionStore.getState().setMissionDay(10);
    useMissionStore.getState().resetToToday();
    expect(useMissionStore.getState().missionDay).toBe(90);
  });
  it('persists profile and day to localStorage', () => {
    useMissionStore.getState().setMissionDay(120);
    expect(localStorage.getItem('argus.mission')).toContain('"missionDay":120');
  });
});

describe('useSessionStore', () => {
  it('rejects a wrong PIN', () => {
    expect(useSessionStore.getState().signIn({ role: 'cmo', pin: '0000' })).toBe(false);
    expect(useSessionStore.getState().signedIn).toBe(false);
  });
  it('crew needs a valid crew id', () => {
    expect(useSessionStore.getState().signIn({ role: 'crew', pin: DEMO_PIN })).toBe(false);
    expect(useSessionStore.getState().signIn({ role: 'crew', crewId: 'c9', pin: DEMO_PIN })).toBe(false);
    expect(useSessionStore.getState().signIn({ role: 'crew', crewId: 'c3', pin: DEMO_PIN })).toBe(true);
    expect(useSessionStore.getState()).toMatchObject({ role: 'crew', crewId: 'c3', signedIn: true });
  });
  it('CMO signs in as L. Duarte (c4); surgeon has no crew id', () => {
    useSessionStore.getState().signIn({ role: 'cmo', pin: DEMO_PIN });
    expect(useSessionStore.getState().crewId).toBe('c4');
    useSessionStore.getState().signIn({ role: 'surgeon', crewId: 'c1', pin: DEMO_PIN });
    expect(useSessionStore.getState()).toMatchObject({ role: 'surgeon', crewId: null });
  });
});

describe('useUiStore', () => {
  it('has the documented defaults', () => {
    const s = useUiStore.getState();
    expect(s).toMatchObject({
      layerLens: 'combined',
      theme: 'dark',
      gloveMode: false,
      spaceWeatherMode: 'SNAPSHOT',
      flagDensity: [],
    });
    expect(s.units).toEqual({ temp: 'Cel', glucose: 'mg/dL' });
  });
  it('persists only preferences', () => {
    useUiStore.getState().setTheme('hc');
    useUiStore.getState().setSelectedCrew('c3');
    const saved = localStorage.getItem('argus.ui') ?? '';
    expect(saved).toContain('"theme":"hc"');
    expect(saved).not.toContain('selectedCrewId');
    useUiStore.getState().setTheme('dark');
  });
});
