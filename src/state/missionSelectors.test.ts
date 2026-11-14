import { describe, expect, it } from 'vitest';

import {
  MIN_MISSION_DAY,
  clampMissionDay,
  commsDelaySec,
  dayToIndex,
  delayDisplay,
  getProfile,
  indexToDay,
  isModeledDelay,
  missionDayLabel,
  missionDayRange,
  missionProfiles,
  stepMissionDay,
} from './missionSelectors';

const mars = getProfile('mars-transit');

describe('commsDelaySec', () => {
  it('Mars transit day 143 → 660 s (11 min)', () => {
    expect(commsDelaySec(mars, 143)).toBe(660);
    expect(delayDisplay(commsDelaySec(mars, 143))).toEqual({ value: 11, unit: 'min', precision: 0 });
  });
  it('interpolates linearly between table rows', () => {
    expect(commsDelaySec(mars, 90)).toBe(270); // halfway between [60,120] and [120,420]
    expect(commsDelaySec(mars, 131.5)).toBe(540);
  });
  it('clamps to the first/last table entry (pre-flight uses the first)', () => {
    expect(commsDelaySec(mars, -30)).toBe(1);
    expect(commsDelaySec(mars, 500)).toBe(1000);
  });
  it('returns fixed delays as is', () => {
    expect(commsDelaySec(getProfile('mars-surface'), 143)).toBe(720);
    expect(commsDelaySec(getProfile('lunar-transit'), 3)).toBe(1.3);
  });
});

describe('isModeledDelay', () => {
  it.each([
    ['mars-transit', true],
    ['mars-surface', true], // fixed 12 min is a demo value, not computed light-time
    ['iss', false],
    ['lunar-transit', false],
    ['lunar-surface', false],
    ['lunar-rover', false],
  ] as const)('%s → %s', (id, modeled) => {
    expect(isModeledDelay(getProfile(id))).toBe(modeled);
  });
});

describe('mission day arithmetic', () => {
  it('has six profiles and defaults unknown ids to Mars transit', () => {
    expect(missionProfiles).toHaveLength(6);
    expect(getProfile('nope' as never).id).toBe('mars-transit');
  });
  it('index mapping skips day 0', () => {
    expect(dayToIndex(-180)).toBe(0);
    expect(dayToIndex(-1)).toBe(179);
    expect(dayToIndex(1)).toBe(180);
    expect(indexToDay(179)).toBe(-1);
    expect(indexToDay(180)).toBe(1);
    for (const d of [-180, -5, -1, 1, 2, 143]) expect(indexToDay(dayToIndex(d))).toBe(d);
  });
  it('clamps to [−180 … demoMissionDay] and maps 0 to 1', () => {
    expect(clampMissionDay(0, mars)).toBe(1);
    expect(clampMissionDay(500, mars)).toBe(143);
    expect(clampMissionDay(-999, mars)).toBe(MIN_MISSION_DAY);
    expect(clampMissionDay(150, getProfile('mars-surface'))).toBe(150);
    expect(clampMissionDay(150, getProfile('iss'))).toBe(90);
  });
  it('steps across launch without visiting day 0', () => {
    expect(stepMissionDay(-1, 1, mars)).toBe(1);
    expect(stepMissionDay(1, -1, mars)).toBe(-1);
    expect(stepMissionDay(-3, 7, mars)).toBe(5);
    expect(stepMissionDay(140, 7, mars)).toBe(143);
    expect(stepMissionDay(-178, -7, mars)).toBe(-180);
  });
  it('range has no day 0 and ends at the demo day', () => {
    const r = missionDayRange(mars);
    expect(r).not.toContain(0);
    expect(r[0]).toBe(-180);
    expect(r[r.length - 1]).toBe(143);
    expect(r).toHaveLength(180 + 143);
  });
  it('labels pre-flight and in-flight days', () => {
    expect(missionDayLabel(-30)).toBe('L-30');
    expect(missionDayLabel(143)).toBe('MD 143');
  });
});
