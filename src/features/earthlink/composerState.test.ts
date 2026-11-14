import { describe, expect, it } from 'vitest';

import { composerProblems, daysBefore, defaultComposer, earthLinkHref, toRequest } from './composerState';

const ALL = ['c1', 'c2', 'c3', 'c4'];

describe('composer defaults and /earth query', () => {
  it('CMO: everyone by default, last 7 days, flags only', () => {
    expect(defaultComposer({ role: 'cmo', ownCrewId: 'c4', missionDay: 143, allCrewIds: ALL })).toEqual({
      crewIds: ALL,
      fromDay: 137,
      toDay: 143,
      flagsOnly: true,
      note: '',
    });
  });

  it('CMO: ?crew=c3&flags=1 prefills K. Osei only; unknown ids ignored; from/to clamped', () => {
    const s = defaultComposer({
      role: 'cmo',
      ownCrewId: 'c4',
      missionDay: 143,
      allCrewIds: ALL,
      search: new URLSearchParams('crew=c3,zz&flags=0&from=-500&to=999'),
    });
    expect(s.crewIds).toEqual(['c3']);
    expect(s.flagsOnly).toBe(false);
    expect(s.fromDay).toBe(-180);
    expect(s.toDay).toBe(143);
  });

  it('crew member: own data only, whatever the query says', () => {
    const s = defaultComposer({ role: 'crew', ownCrewId: 'c2', missionDay: 143, allCrewIds: ALL, search: new URLSearchParams('crew=c3') });
    expect(s.crewIds).toEqual(['c2']);
  });

  it('period skips day 0; request keeps the note as written; problems; href', () => {
    expect(daysBefore(3, 6)).toBe(-4);
    expect(toRequest({ crewIds: ['c3'], fromDay: 137, toDay: 143, flagsOnly: true, note: '  ' })).toEqual({
      crewIds: ['c3'],
      fromDay: 137,
      toDay: 143,
      flagsOnly: true,
    });
    expect(toRequest({ crewIds: ['c3'], fromDay: 137, toDay: 143, flagsOnly: true, note: ' as is ' }).note).toBe(' as is ');
    expect(composerProblems({ crewIds: [], fromDay: 144, toDay: 143, flagsOnly: true, note: '' }, 143)).toHaveLength(2);
    expect(earthLinkHref(['c3'])).toBe('/earth?crew=c3&flags=1');
    expect(earthLinkHref(['c1', 'c3'], false)).toBe('/earth?crew=c1,c3&flags=0');
  });
});
