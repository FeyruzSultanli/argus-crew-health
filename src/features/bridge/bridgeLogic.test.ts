import { describe, expect, it } from 'vitest';

import { mkAssessment } from '../../domain/readiness/fixtures.test-utils';
import type { CrewMember } from '../../domain/types';
import { countAcrossCrew, countLayerFlags } from './counters';
import { sortCrewRows } from './crewRows';
import { startTarget } from './planLinks';
import { labelInSentence, summarize, topFlag } from './summary';

// Day-143 shape of the shipped seed.
const c3 = [
  mkAssessment('c3', 'heart_rate_rest', 'ACT', {
    P: 'ACT',
    S: 'NOMINAL',
    E: 'NOMINAL',
    caught: true,
    action: 'Tell the CMO.',
  }),
  mkAssessment('c3', 'body_temp', 'WATCH', { P: 'WATCH', S: 'NOMINAL', E: 'NOMINAL', caught: true }),
  mkAssessment('c3', 'sleep_duration', 'EXPECTED', {
    P: 'NOMINAL',
    S: 'EXPECTED',
    E: 'WATCH',
    drivenBy: ['space'],
  }),
  mkAssessment('c3', 'hematocrit', 'EXPECTED', { P: 'NO_DATA', S: 'EXPECTED', E: 'NOMINAL' }),
  mkAssessment('c3', 'mood', 'NOMINAL'),
  mkAssessment('c3', 'symptoms', 'NO_DATA'),
];
const c2 = [
  mkAssessment('c2', 'reaction_test', 'WATCH', {
    P: 'NOMINAL',
    S: 'WATCH',
    E: 'NO_DATA',
    drivenBy: ['space'],
  }),
  mkAssessment('c2', 'sleep_duration', 'EXPECTED', { P: 'NOMINAL', S: 'EXPECTED', E: 'WATCH' }),
  mkAssessment('c2', 'hematocrit', 'EXPECTED', { P: 'NO_DATA', S: 'EXPECTED', E: 'WATCH' }),
];
const c4 = [
  mkAssessment('c4', 'sleep_duration', 'EXPECTED', { P: 'NOMINAL', S: 'EXPECTED', E: 'WATCH' }),
  mkAssessment('c4', 'mood', 'NOMINAL'),
];
const cabin = [mkAssessment('cabin', 'cabin_co2', 'WATCH', { S: 'WATCH', E: 'WATCH' })];

describe('countLayerFlags (FR-SIG-6)', () => {
  it('counts WATCH/ACT per layer, caught-only-by-personal and Earth false alarms', () => {
    expect(countLayerFlags(c3)).toEqual({
      personal: 2,
      space: 0,
      earth: 1,
      flagged: 2,
      caughtOnlyByPersonal: 2,
      earthFalseAlarms: 1,
    });
  });

  it('across the crew, cabin excluded', () => {
    const byCrew = { c2, c3, c4, cabin };
    expect(countAcrossCrew(byCrew, ['c2', 'c3', 'c4'])).toEqual({
      personal: 2,
      space: 1,
      earth: 4,
      flagged: 3,
      caughtOnlyByPersonal: 2,
      earthFalseAlarms: 4,
    });
    expect(countLayerFlags(cabin).space).toBe(0);
  });

  it('Earth WATCH under a combined WATCH is a flag but not a false alarm', () => {
    const a = mkAssessment('c1', 'glucose', 'WATCH', { P: 'NOMINAL', S: 'WATCH', E: 'WATCH' });
    expect(countLayerFlags([a])).toMatchObject({ earth: 1, earthFalseAlarms: 0 });
  });
});

describe('summarize (hero one-liner)', () => {
  it('ACT first, then WATCH, then EXPECTED, in two sentences', () => {
    expect(summarize(c3)).toBe(
      'Resting heart rate needs action now; body temperature is on watch. Expected in space: sleep duration and hematocrit.',
    );
  });
  it('keeps names with inner capitals', () => {
    expect(summarize(c2)).toBe(
      'Reaction Self-Test is on watch. Expected in space: sleep duration and hematocrit.',
    );
    expect(labelInSentence('Amsler grid')).toBe('Amsler grid');
    expect(labelInSentence('Near visual acuity')).toBe('near visual acuity');
  });
  it('nothing flagged but adaptations', () => {
    expect(summarize(c4)).toBe('Nothing on Watch or Act. Expected in space: sleep duration.');
  });
  it('all nominal / no data', () => {
    expect(
      summarize([mkAssessment('c1', 'mood', 'NOMINAL'), mkAssessment('c1', 'symptoms', 'NO_DATA')]),
    ).toBe('All signals within your usual range.');
    expect(summarize([mkAssessment('c1', 'mood', 'NO_DATA')])).toBe('No recent readings. Measure to update.');
    expect(summarize([])).toBe('No recent readings. Measure to update.');
  });
  it('plural verbs and "n more" past three names', () => {
    const many = (['heart_rate_rest', 'body_temp', 'spo2', 'mood'] as const).map((id) =>
      mkAssessment('c1', id, 'ACT'),
    );
    expect(summarize(many)).toBe(
      'Resting heart rate, body temperature, oxygen saturation and 1 more need action now.',
    );
  });
  it('ignores cabin assessments', () => {
    expect(summarize([...c4, ...cabin])).toBe('Nothing on Watch or Act. Expected in space: sleep duration.');
  });
  it('topFlag: the ACT before any WATCH', () => {
    expect(topFlag(c3)?.signalId).toBe('heart_rate_rest');
    expect(topFlag(c4)).toBeUndefined();
  });
});

describe('startTarget (plan deep links)', () => {
  it('maps signals to Lab flows or the on-page check-in', () => {
    expect(startTarget('heart_rate_rest')).toEqual({ kind: 'route', to: '/lab/camera' });
    expect(startTarget('reaction_test')).toEqual({ kind: 'route', to: '/lab/pvt' });
    expect(startTarget('amsler')).toEqual({ kind: 'route', to: '/lab/vision' });
    expect(startTarget('near_acuity')).toEqual({ kind: 'route', to: '/lab/vision' });
    for (const id of ['mood', 'sleep_duration', 'symptoms'] as const)
      expect(startTarget(id)).toEqual({ kind: 'checkin' });
    for (const id of ['blood_pressure', 'hydration', 'exercise_minutes', 'body_temp'] as const)
      expect(startTarget(id)).toEqual({ kind: 'route', to: '/lab/manual' });
    expect(startTarget(undefined)).toEqual({ kind: 'route', to: '/lab/manual' });
  });
});

describe('sortCrewRows', () => {
  const member = (id: string, name: string): CrewMember => ({
    id,
    displayName: name,
    role: 'Pilot',
    isCMO: false,
    sex: 'female',
    ageYears: 40,
    careerDoseMsvPreMission: 0,
    simulatedBaseline: {},
  });
  it('ACT first, then WATCH, then by flag count and name', () => {
    const rows = sortCrewRows([
      { member: member('c1', 'R. Vance'), assessments: [], verdict: 'EXPECTED' },
      { member: member('c4', 'L. Duarte'), assessments: [], verdict: 'EXPECTED' },
      { member: member('c2', 'M. Ito'), assessments: c2, verdict: 'WATCH' },
      { member: member('c3', 'K. Osei'), assessments: c3, verdict: 'ACT' },
    ]);
    expect(rows.map((r) => r.member.id)).toEqual(['c3', 'c2', 'c4', 'c1']);
  });
});
