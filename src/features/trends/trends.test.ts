import { describe, expect, it } from 'vitest';

import { getSignal } from '../../domain/signals';
import type { LayerResult, Observation, PersonalResult } from '../../domain/types';
import { axisTicks, clampRange, dayToIndex, indexToDay, presetRange, rangeLength, tickLabel } from './axis';
import { buildRows, niceStep, yScale } from './chartRows';
import { CO2_PRIMARY_LINES, co2Tracks } from './co2';
import { CSV_COLUMNS, buildCsv, csvField, parseCsv } from './csv';
import { eventsFor } from './events';
import { DEFAULT_SIGNALS, normaliseSelection, toggleSignal, trendsAccess } from './selection';
import { buildTrendModel, preflightBandFromNumbers, spaceBandFromNumbers } from './trendData';
import type { TrendTrack } from './trendData';

const CREW = ['c1', 'c2', 'c3', 'c4'];

function obs(day: number, value: number, extra: Partial<Observation> = {}): Observation {
  return {
    id: `o${day}`,
    crewId: 'c3',
    signalId: 'heart_rate_rest',
    value,
    unit: '/min',
    effectiveAt: '2026-11-14T06:00:00Z',
    missionDay: day,
    source: { kind: 'simulated', label: 'SIMULATED' },
    quality: { score: 1, label: 'good', reasons: [] },
    ...extra,
  };
}

describe('mission-day x-axis without day 0', () => {
  it('maps L-1 and MD 1 to neighbouring positions', () => {
    expect(dayToIndex(-1) + 1).toBe(dayToIndex(1));
    expect(indexToDay(dayToIndex(-1) + 1)).toBe(1);
    expect(tickLabel(dayToIndex(-1))).toBe('L-1');
    expect(tickLabel(dayToIndex(1))).toBe('MD 1');
  });

  it('presets count real days across launch (no day 0)', () => {
    expect(presetRange('30', 143)).toEqual({ fromDay: 114, toDay: 143 });
    expect(presetRange('14', 5)).toEqual({ fromDay: -9, toDay: 5 });
    expect(rangeLength(presetRange('14', 5))).toBe(14);
    expect(presetRange('all', 143)).toEqual({ fromDay: -180, toDay: 143 });
  });

  it('ticks never label day 0 and include both ends', () => {
    const r = { fromDay: -10, toDay: 10 };
    const labels = axisTicks(r).map(tickLabel);
    expect(labels[0]).toBe('L-10');
    expect(labels[labels.length - 1]).toBe('MD 10');
    expect(labels.some((l) => l === 'MD 0' || l === 'L0')).toBe(false);
  });

  it('clamps a brushed range to the selected day, ordered, at least 2 days', () => {
    expect(clampRange({ fromDay: 150, toDay: 120 }, 143)).toEqual({ fromDay: 120, toDay: 143 });
    expect(clampRange({ fromDay: 143, toDay: 143 }, 143)).toEqual({ fromDay: 142, toDay: 143 });
    expect(clampRange({ fromDay: -1, toDay: 1 }, 143)).toEqual({ fromDay: -1, toDay: 1 });
  });
});

describe('band / series assembly', () => {
  const personal: LayerResult = {
    layer: 'personal',
    verdict: 'ACT',
    reason: 'r',
    sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
    numbers: { mPre: 58, sigmaPre: 2, shift: 0, ref: 58, sigma: 2 },
  };
  const series: PersonalResult['series'] = [
    { missionDay: 140, value: 58, lo: 54, hi: 62, state: 'NOMINAL' },
    { missionDay: 141, value: 63, lo: 54, hi: 62, state: 'WATCH' },
    { missionDay: 142, value: 68, lo: 54, hi: 62, state: 'WATCH' },
    { missionDay: 143, value: 69, lo: 54, hi: 62, state: 'ACT' },
  ];
  const observations = [
    obs(-3, 57),
    obs(-2, 58),
    obs(-1, 59),
    obs(140, 58),
    obs(141, 63),
    obs(142, 68),
    obs(143, 69, { source: { kind: 'camera', label: 'MEASURED' } }),
  ];

  it('builds points with band and state, pre-flight band from numbers, markers on WATCH/ACT days', () => {
    const m = buildTrendModel({
      def: getSignal('heart_rate_rest'),
      range: { fromDay: -3, toDay: 143 },
      series,
      tracks: [],
      observations,
      personal,
    });
    const pts = m.tracks[0]?.points ?? [];
    expect(pts.map((p) => p.missionDay)).toEqual([-3, -2, -1, 140, 141, 142, 143]);
    expect(pts[0]?.lo).toBeUndefined(); // pre-flight days: raw value, no personal band
    expect(pts.find((p) => p.missionDay === 143)).toMatchObject({
      value: 69,
      lo: 54,
      hi: 62,
      state: 'ACT',
      measured: true,
    });
    expect(m.preflightBand).toMatchObject({ lo: 54, hi: 62 });
    expect(m.spaceBand).toBeUndefined();
    expect(m.markers.map((x) => [x.missionDay, x.state])).toEqual([
      [141, 'WATCH'],
      [142, 'WATCH'],
      [143, 'ACT'],
    ]);
    expect(m.latest?.missionDay).toBe(143);
    expect(m.precision).toBe(0);
  });

  it('range filtering drops days after the right edge', () => {
    const m = buildTrendModel({
      def: getSignal('heart_rate_rest'),
      range: { fromDay: 111, toDay: 140 },
      series,
      observations,
      personal,
    });
    expect(m.tracks[0]?.points.map((p) => p.missionDay)).toEqual([140]);
    expect(m.markers).toEqual([]);
  });

  it('pre-flight band without numbers falls back to the robust baseline of pre-flight readings', () => {
    const m = buildTrendModel({
      def: getSignal('heart_rate_rest'),
      range: { fromDay: -3, toDay: 143 },
      series,
      observations,
    });
    // median 58, MAD 1 → 1.4826 < floor 2 → σ 2, thin (n = 3) → × 1.5 = 3
    expect(m.preflightBand?.lo).toBeCloseTo(52);
    expect(m.preflightBand?.hi).toBeCloseTo(64);
  });

  it('space-expected band = pre-flight band moved by the shift (sleep −0.9 h), in-flight only', () => {
    const p: LayerResult = { ...personal, numbers: { mPre: 7.5 - 0.9, sigmaPre: 0.3, shift: -0.9 } };
    expect(preflightBandFromNumbers(p)).toMatchObject({ lo: 6.9, hi: 8.1 });
    const s = spaceBandFromNumbers(p);
    expect(s?.lo).toBeCloseTo(6.0);
    expect(s?.hi).toBeCloseTo(7.2);
    expect(s?.fromDay).toBe(1);
    expect(spaceBandFromNumbers(personal)).toBeUndefined();
  });

  it('signals without a personal band get a plain value line', () => {
    const m = buildTrendModel({
      def: getSignal('hematocrit'),
      range: { fromDay: 1, toDay: 10 },
      series: [],
      observations: [obs(5, 44, { signalId: 'hematocrit', unit: '%' })],
    });
    expect(m.tracks[0]).toMatchObject({ band: false });
    expect(m.preflightBand).toBeUndefined();
    expect(m.markers).toEqual([]);
  });

  it('chart rows merge tracks on the x index; y-scale has nice ticks covering bands and lines', () => {
    const tracks: TrendTrack[] = [
      {
        key: 'a',
        label: 'A',
        band: true,
        points: [
          { missionDay: 1, x: dayToIndex(1), value: 60, lo: 54, hi: 62, state: 'NOMINAL', measured: false },
        ],
      },
    ];
    const rows = buildRows(tracks, [
      { key: 'c1', label: 'R. Vance', points: [{ x: dayToIndex(1), value: 55 }] },
    ]);
    expect(rows).toEqual([{ x: dayToIndex(1), v0: 60, m0: false, s0: 'NOMINAL', b0: [54, 62], o_c1: 55 }]);
    const y = yScale(tracks, { lines: [{ y: 70, label: 'l', sourceIds: [] }] });
    expect(y.domain[0]).toBeLessThanOrEqual(54);
    expect(y.domain[1]).toBeGreaterThanOrEqual(70);
    expect(niceStep(16)).toBe(5);
  });
});

describe('event markers per crew / signal', () => {
  const r = { fromDay: 114, toDay: 143 };
  it('silent infection on K. Osei heart rate and temperature only', () => {
    expect(eventsFor('c3', 'heart_rate_rest', r).map((e) => e.id)).toEqual(['silent-infection']);
    expect(eventsFor('c3', 'body_temp', r).map((e) => e.id)).toContain('silent-infection');
    expect(eventsFor('c1', 'heart_rate_rest', r)).toEqual([]);
    expect(eventsFor('c3', 'spo2', r)).toEqual([]);
  });
  it('CO₂ spike on the cabin chart, sleep debt on M. Ito sleep, SPE on dose, launch when in range', () => {
    expect(eventsFor('cabin', 'cabin_co2', r)[0]).toMatchObject({
      id: 'co2-spike',
      fromDay: 118,
      toDay: 122,
    });
    expect(eventsFor('c2', 'sleep_duration', r).map((e) => e.id)).toEqual(['sleep-debt']);
    expect(eventsFor('c4', 'radiation_dose', r).map((e) => e.id)).toEqual(['spe-event']);
    expect(eventsFor('c1', 'heart_rate_rest', { fromDay: -5, toDay: 5 }).map((e) => e.id)).toEqual([
      'launch',
    ]);
    expect(eventsFor('c3', 'heart_rate_rest', { fromDay: 100, toDay: 140 })).toEqual([]);
    expect(eventsFor('c3', 'heart_rate_rest', r)[0]?.sourceIds).toEqual(['SRC_DEMO_SIMULATION']);
  });
});

describe('cabin CO₂ model', () => {
  it('1-h line from value, 7-day line from components.avg7d; latest reading per day; limits sourced', () => {
    const co2 = (day: number, v: number, t: string, avg?: number): Observation =>
      obs(day, v, {
        crewId: 'cabin',
        signalId: 'cabin_co2',
        unit: 'mm[Hg]',
        effectiveAt: t,
        ...(avg ? { components: { avg7d: avg } } : {}),
      });
    const tracks = co2Tracks(
      [
        co2(120, 3.0, '2026-11-14T01:00:00Z'),
        co2(120, 4.2, '2026-11-14T05:00:00Z', 3.1),
        co2(121, 3.9, '2026-11-15T05:00:00Z', 3.3),
      ],
      { fromDay: 114, toDay: 143 },
    );
    expect(tracks[0]?.points.map((p) => p.value)).toEqual([4.2, 3.9]);
    expect(tracks[1]?.points.map((p) => p.value)).toEqual([3.1, 3.3]);
    expect(CO2_PRIMARY_LINES.map((l) => [l.y, l.sourceIds[0]])).toEqual([
      [3, 'SRC_STD3001_CO2'],
      [2.5, 'SRC_NASA_CO2_PAGE'],
    ]);
  });
});

describe('CSV of the current view', () => {
  it('quotes commas, quotes and newlines, and parses back to the same cells', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField(1.23456789)).toBe('1.2346');
    expect(csvField(undefined)).toBe('');
    const tracks: TrendTrack[] = [
      {
        key: 'value',
        label: 'Resting heart rate, "rest"',
        band: true,
        points: [
          { missionDay: -1, x: 179, value: 58, measured: false },
          { missionDay: 143, x: 322, value: 69.00000000001, lo: 54, hi: 62, state: 'ACT', measured: true },
        ],
      },
    ];
    const text = buildCsv([{ signal: 'heart_rate_rest', crew: 'K. Osei', unit: '/min', tracks }]);
    const rows = parseCsv(text);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows[1]).toEqual([
      'heart_rate_rest',
      'Resting heart rate, "rest"',
      'K. Osei',
      '-1',
      '58',
      'bpm',
      '',
      '',
      '',
      'SIMULATED',
    ]);
    expect(rows[2]).toEqual([
      'heart_rate_rest',
      'Resting heart rate, "rest"',
      'K. Osei',
      '143',
      '69',
      'bpm',
      '54',
      '62',
      'ACT',
      'MEASURED',
    ]);
    expect(rows).toHaveLength(3);
    expect(parseCsv('a,"b\r\nc"\r\n')).toEqual([['a', 'b\r\nc']]);
  });
});

describe('role views and selection', () => {
  it('crew sees only self, CMO any crew member, the surgeon gets the Earth-link notice', () => {
    expect(trendsAccess('crew', 'c2', 'c3', CREW)).toEqual({
      kind: 'view',
      crewId: 'c2',
      canPickCrew: false,
      redirectedFrom: 'c3',
    });
    expect(trendsAccess('crew', 'c2', undefined, CREW)).toEqual({
      kind: 'view',
      crewId: 'c2',
      canPickCrew: false,
    });
    expect(trendsAccess('cmo', 'c4', 'c3', CREW)).toEqual({ kind: 'view', crewId: 'c3', canPickCrew: true });
    expect(trendsAccess('cmo', 'c4', 'nobody', CREW)).toEqual({
      kind: 'view',
      crewId: 'c4',
      canPickCrew: true,
    });
    expect(trendsAccess('surgeon', null, 'c3', CREW)).toEqual({ kind: 'surgeon' });
    expect(trendsAccess(null, null, 'c3', CREW)).toEqual({ kind: 'signed-out' });
  });
  it('selection keeps catalog order, drops unknown ids, toggles', () => {
    expect(normaliseSelection(['spo2', 'nope', 'heart_rate_rest', 'cabin_co2'])).toEqual([
      'heart_rate_rest',
      'spo2',
    ]);
    expect(toggleSignal(DEFAULT_SIGNALS, 'spo2')).not.toContain('spo2');
    expect(toggleSignal(['heart_rate_rest'], 'glucose')).toEqual(['heart_rate_rest', 'glucose']);
  });
});
