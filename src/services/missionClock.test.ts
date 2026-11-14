import { describe, expect, it } from 'vitest';

import {
  addMissionDays,
  computeMissionEpoch,
  dateOf,
  missionDayOf,
  missionDayRange,
  missionDaysBetween,
  simulatedEffectiveAt,
} from './missionClock';

describe('mission clock (doc 06)', () => {
  const now = new Date('2026-11-14T15:52:00Z');
  const epoch = computeMissionEpoch(now, 143);

  it('puts the demo day on today (UTC date)', () => {
    expect(epoch).toBe('2026-06-25T00:00:00.000Z');
    expect(dateOf(143, epoch).toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(missionDayOf(now, epoch)).toBe(143);
  });

  it('has no day 0: −1 is the day before launch day 1', () => {
    expect(dateOf(1, epoch).toISOString()).toBe('2026-06-25T00:00:00.000Z');
    expect(dateOf(-1, epoch).toISOString()).toBe('2026-06-24T00:00:00.000Z');
    expect(missionDayOf(new Date('2026-06-24T23:59:59Z'), epoch)).toBe(-1);
    expect(missionDayOf(new Date('2026-06-25T00:00:00Z'), epoch)).toBe(1);
    expect(() => dateOf(0, epoch)).toThrow(RangeError);
    expect(missionDayRange(-2, 2)).toEqual([-2, -1, 1, 2]);
    expect(addMissionDays(-1, 1)).toBe(1);
    expect(addMissionDays(1, -1)).toBe(-1);
    expect(addMissionDays(136, 7)).toBe(143);
    expect(missionDaysBetween(-1, 1)).toBe(1);
    expect(missionDaysBetween(-7, 1)).toBe(7);
  });

  it('simulated readings are at 07:00 UTC', () => {
    expect(simulatedEffectiveAt(-30, epoch)).toBe('2026-05-26T07:00:00.000Z');
  });
});
