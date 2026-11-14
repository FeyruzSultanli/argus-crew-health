import { describe, expect, it } from 'vitest';

import { usualBand } from './usual';

describe('usualBand', () => {
  const series = [
    { missionDay: 140, lo: 58, hi: 66 },
    { missionDay: 142, lo: 59, hi: 67 },
    { missionDay: 143, lo: 60, hi: 68 },
  ];
  it("takes today's band, else the latest one before today", () => {
    expect(usualBand(series, 143)).toEqual({ lo: 60, hi: 68 });
    expect(usualBand(series, 141)).toEqual({ lo: 58, hi: 66 });
    expect(usualBand(series, 139)).toBeUndefined();
    expect(usualBand(undefined, 143)).toBeUndefined();
    expect(usualBand([{ missionDay: 143, lo: Number.NaN, hi: 1 }], 143)).toBeUndefined();
  });
});
