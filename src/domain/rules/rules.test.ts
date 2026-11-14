import { describe, expect, it } from 'vitest';

import { FAIR, GOOD, POOR, obs, series } from '../__tests__/fixtures';
import type { BandRule } from './bands';
import { evaluateBands, inBand, matchBand } from './bands';
import { chronological, dailyValue, mean, median, preflightOf, readingsOfDay, windowMean } from './history';
import { asLayer, layerResult, notApplicable, sev, uniqueIds, worstOf } from './layer';
import {
  QUALITY_SOURCE_IDS,
  STALE_NO_DATA_FACTOR,
  STALE_REMEASURE_FACTOR,
  bestReading,
  evaluateQuality,
  staleness,
} from './quality';

describe('band rule (doc 07 §4)', () => {
  it('inBand honours inclusive and exclusive edges', () => {
    expect(inBand(5, { verdict: 'WATCH', min: 5, max: 7, reason: '' })).toBe(true);
    expect(inBand(7, { verdict: 'WATCH', min: 5, max: 7, reason: '' })).toBe(true);
    expect(inBand(5, { verdict: 'WATCH', min: 5, minExclusive: true, reason: '' })).toBe(false);
    expect(inBand(7, { verdict: 'WATCH', max: 7, maxExclusive: true, reason: '' })).toBe(false);
    expect(inBand(4.99, { verdict: 'WATCH', min: 5, reason: '' })).toBe(false);
    expect(inBand(123, { verdict: 'WATCH', reason: '' })).toBe(true);
  });
  it('tests ACT → WATCH → EXPECTED → NOMINAL whatever the listing order', () => {
    const bands = [
      { verdict: 'NOMINAL' as const, reason: 'n' },
      { verdict: 'EXPECTED' as const, min: 1, reason: 'e' },
      { verdict: 'WATCH' as const, min: 2, reason: 'w' },
      { verdict: 'ACT' as const, min: 3, reason: 'a' },
    ];
    expect(matchBand(3, 0, bands).verdict).toBe('ACT');
    expect(matchBand(2, 0, bands).verdict).toBe('WATCH');
    expect(matchBand(1, 0, bands).verdict).toBe('EXPECTED');
    expect(matchBand(0, 0, bands).verdict).toBe('NOMINAL');
  });
  it('rounds to display precision first; unmatched → NOMINAL', () => {
    const bands = [{ verdict: 'WATCH' as const, min: 5, reason: '' }];
    expect(matchBand(4.5, 0, bands)).toMatchObject({ verdict: 'WATCH', rounded: 5 });
    expect(matchBand(4.49, 0, bands)).toEqual({ verdict: 'NOMINAL', rounded: 4 });
    expect(
      matchBand(6.949999999999999, 1, [{ verdict: 'WATCH', max: 7, maxExclusive: true, reason: '' }]).verdict,
    ).toBe('NOMINAL');
  });
  it('evaluateBands: reason, sources, demo citation and numbers', () => {
    const rule: BandRule = {
      id: 'x.space',
      layer: 'space',
      precision: 1,
      unit: 'h',
      bands: [
        {
          verdict: 'WATCH',
          max: 5,
          maxExclusive: true,
          demo: true,
          reason: '{v} low',
          sourceIds: ['SRC_EARTH_SLEEP_7H'],
        },
        { verdict: 'NOMINAL', min: 7, reason: '{v} fine' },
      ],
      sourceIds: ['SRC_SLEEP_BARGER'],
      nominalReason: '{v} between',
    };
    expect(evaluateBands(rule, 4.44, { n: 3 })).toEqual({
      layer: 'space',
      verdict: 'WATCH',
      reason: '4.4 h low',
      sourceIds: ['SRC_SLEEP_BARGER', 'SRC_EARTH_SLEEP_7H', 'SRC_DEMO_RULE_BANDS'],
      ruleId: 'x.space',
      numbers: { value: 4.4, n: 3 },
    });
    expect(evaluateBands(rule, 7.2).sourceIds).toEqual(['SRC_SLEEP_BARGER']);
    // fallback NOMINAL cites demo because the rule has a demo edge
    expect(evaluateBands(rule, 6)).toMatchObject({
      verdict: 'NOMINAL',
      reason: '6.0 h between',
      sourceIds: ['SRC_SLEEP_BARGER', 'SRC_DEMO_RULE_BANDS'],
    });
    expect(evaluateBands({ ...rule, unit: '%' }, 6).reason).toBe('6.0% between');
    expect(evaluateBands({ ...rule, unit: '' }, 6).reason).toBe('6.0 between');
  });
});

describe('layer helpers', () => {
  it('sev order', () => {
    expect(['NO_DATA', 'NOMINAL', 'EXPECTED', 'WATCH', 'ACT'].map((v) => sev(v as never))).toEqual([
      -1, 0, 1, 2, 3,
    ]);
  });
  it('layerResult dedupes sources and omits empty optionals', () => {
    expect(layerResult('earth', 'NOMINAL', 'r', ['A', 'A', 'B'])).toEqual({
      layer: 'earth',
      verdict: 'NOMINAL',
      reason: 'r',
      sourceIds: ['A', 'B'],
    });
    expect(uniqueIds(['x', 'y', 'x'])).toEqual(['x', 'y']);
    expect(notApplicable('space', 'n/a')).toEqual({
      layer: 'space',
      verdict: 'NO_DATA',
      reason: 'n/a',
      sourceIds: [],
    });
  });
  it('worstOf keeps the first worst, merges tied sources and numbers', () => {
    const a = layerResult('space', 'WATCH', 'a', ['A'], 'ra', { x: 1 });
    const b = layerResult('space', 'WATCH', 'b', ['B'], 'rb', { y: 2 });
    const c = layerResult('space', 'NOMINAL', 'c', ['C'], 'rc');
    expect(worstOf([c, a, b])).toEqual({
      layer: 'space',
      verdict: 'WATCH',
      reason: 'a',
      sourceIds: ['A', 'B'],
      ruleId: 'ra',
      numbers: { x: 1, y: 2 },
    });
    expect(worstOf([c]).numbers).toBeUndefined();
    expect(() => worstOf([])).toThrow();
  });
  it('asLayer drops series and relabels', () => {
    const p = { ...layerResult('earth', 'WATCH', 'p', ['A'], 'r', { z: 2 }), series: [] };
    expect(asLayer(p, 'personal')).toEqual({
      layer: 'personal',
      verdict: 'WATCH',
      reason: 'p',
      sourceIds: ['A'],
      ruleId: 'r',
      numbers: { z: 2 },
    });
  });
});

describe('history aggregates', () => {
  it('median and mean', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([])).toBeNull();
    expect(mean([1, 2, 6])).toBe(3);
  });
  it('chronological sorts by day then time; readingsOfDay filters', () => {
    const late = obs('heart_rate_rest', 2, 5, {}, 10);
    const early = obs('heart_rate_rest', 1, 5, {}, 1);
    const prev = obs('heart_rate_rest', 0, 4);
    expect(chronological([late, prev, early]).map((o) => o.value)).toEqual([0, 1, 2]);
    expect(readingsOfDay([late, prev, early], 5)).toHaveLength(2);
  });
  it('dailyValue picks last/mean/median/max and components', () => {
    const h = [
      obs('blood_pressure', 1, 5, { components: { systolic: 120 } }, 0),
      obs('blood_pressure', 5, 5, { components: { systolic: 130 } }, 1),
      obs('blood_pressure', 3, 5, {}, 2),
    ];
    expect(dailyValue(h, 5, 'last')).toBe(3);
    expect(dailyValue(h, 5, 'mean')).toBe(3);
    expect(dailyValue(h, 5, 'median')).toBe(3);
    expect(dailyValue(h, 5, 'max')).toBe(5);
    expect(dailyValue(h, 5, 'max', 'systolic')).toBe(130);
    expect(dailyValue(h, 6, 'last')).toBeNull();
  });
  it('windowMean skips days without a value', () => {
    const h = series('hydration', [
      [1, 2],
      [3, 3],
    ]);
    expect(windowMean(h, 3, 3, 'last')).toEqual({ mean: 2.5, n: 2, days: [3, 1] });
    expect(windowMean(h, 10, 2, 'last')).toEqual({ mean: null, n: 0, days: [] });
  });
  it('preflightOf takes medians of value and components over days −180…−1', () => {
    const h = [
      obs('reaction_test', 3.4, -181, { components: { lapses: 9 } }),
      obs('reaction_test', 3.6, -20, { components: { lapses: 2 } }),
      obs('reaction_test', 3.8, -10, { components: { lapses: 3 } }),
      obs('reaction_test', 3.7, -5, { components: { lapses: 1 } }),
      obs('reaction_test', 2.0, 5, { components: { lapses: 9 } }),
    ];
    expect(preflightOf(h)).toEqual({ median: 3.7, n: 3, components: { lapses: 2 } });
    expect(preflightOf([obs('spo2', 97, -3)])).toEqual({ median: 97, n: 1 });
    expect(preflightOf([])).toEqual({ median: null, n: 0 });
  });
});

describe('quality and staleness (FR-SIG-5, doc 07 §3 step 9)', () => {
  it('multipliers are the demo parameters', () => {
    expect(STALE_REMEASURE_FACTOR).toBe(1.5);
    expect(STALE_NO_DATA_FACTOR).toBe(3);
    expect(QUALITY_SOURCE_IDS).toEqual(['SRC_DEMO_QUALITY_SCORES']);
  });
  it.each([
    [0, 1, 'fresh'],
    [1, 1, 'fresh'],
    [2, 1, 'remeasure'],
    [3, 1, 'remeasure'],
    [4, 1, 'no-data'],
    [10, 7, 'fresh'],
    [11, 7, 'remeasure'],
    [21, 7, 'remeasure'],
    [22, 7, 'no-data'],
    [45, 30, 'fresh'],
    [46, 30, 'remeasure'],
    [91, 30, 'no-data'],
  ] as const)('age %s d, cadence %s d → %s', (age, cadence, expected) => {
    expect(staleness(age, cadence)).toBe(expected);
  });
  it('bestReading: highest score, then label, then later reading', () => {
    const a = obs('heart_rate_rest', 1, 5, { quality: FAIR });
    const b = obs('heart_rate_rest', 2, 5, { quality: GOOD });
    const c = obs('heart_rate_rest', 3, 5, { quality: POOR });
    expect(bestReading([a, b, c])).toBe(b);
    const d = obs('heart_rate_rest', 4, 5, { quality: GOOD });
    expect(bestReading([b, d])).toBe(d);
    expect(bestReading([])).toBeUndefined();
  });
  it('evaluateQuality passes the best reading through and adds staleness', () => {
    const fair = obs('heart_rate_rest', 70, 140, { quality: FAIR });
    const good = obs('heart_rate_rest', 71, 140, { quality: GOOD });
    expect(evaluateQuality([fair, good], 140, 140, 1)).toEqual({ ...GOOD, stale: 'fresh' });
    expect(evaluateQuality([fair], 140, 142, 1)).toEqual({
      score: 0.6,
      label: 'fair',
      reasons: ['some motion', 'Last reading 2 d ago — re-measure due'],
      stale: 'remeasure',
    });
    expect(evaluateQuality([good], 140, 150, 1).stale).toBe('no-data');
    expect(evaluateQuality([good], 140, 150, 1).reasons).toEqual([
      'Last reading 10 d ago — too old to judge',
    ]);
    expect(evaluateQuality([], null, 150, 1)).toEqual({
      score: 0,
      label: 'poor',
      reasons: ['No reading yet'],
      stale: 'no-data',
    });
  });
  it('counts across launch without a day 0', () => {
    const pre = obs('spo2', 97, -5);
    expect(evaluateQuality([pre], -5, 6, 7).stale).toBe('fresh'); // 10 days
    expect(evaluateQuality([pre], -5, 7, 7).stale).toBe('remeasure'); // 11 days
  });
});
