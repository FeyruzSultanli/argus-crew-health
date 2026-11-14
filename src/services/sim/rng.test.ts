import { describe, expect, it } from 'vitest';

import { createRng, hashSeed, mulberry32 } from './rng';

describe('rng', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(hashSeed('argus-2026'));
    const b = mulberry32(hashSeed('argus-2026'));
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('different seeds give different streams', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });

  it('normal() has roughly the requested mean and sd', () => {
    const r = createRng('normal-check');
    const xs = Array.from({ length: 20000 }, () => r.normal(10, 2));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    expect(mean).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it('int() stays inside the inclusive bounds and hits both ends', () => {
    const r = createRng('int-check');
    const xs = Array.from({ length: 2000 }, () => r.int(1, 3));
    expect(new Set(xs)).toEqual(new Set([1, 2, 3]));
  });
});
