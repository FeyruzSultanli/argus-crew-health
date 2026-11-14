import { describe, expect, it } from 'vitest';

import type { Assessment, LayerId, Verdict } from '../../domain/types';
import { mockOseiHeartRateAct, mockSleepExpected, mockSleepWatch } from '../../test/fixtures';
import { buildAssessments } from './bodyFixtures';
import { layerCounters, splitByAttention, subjectSummary } from './counters';
import {
  BODY_REGIONS,
  regionSignalIds,
  regionVerdicts,
  regionsInFilter,
  worstSignalInRegion,
} from './regions';

function withLayers(
  base: Assessment,
  layers: Partial<Record<LayerId, Verdict>>,
  verdict: Verdict,
): Assessment {
  const next = { ...base, verdict, layers: { ...base.layers } };
  for (const [k, v] of Object.entries(layers) as Array<[LayerId, Verdict]>)
    next.layers[k] = { ...next.layers[k], verdict: v };
  return next;
}

describe('regionVerdicts', () => {
  const osei = buildAssessments('c3', 143);

  it('K. Osei day 143: heart ACT under Combined and Personal, neutral under Earth and Space (doc 14 §3.4)', () => {
    expect(regionVerdicts(osei, 'combined').heart).toBe('ACT');
    expect(regionVerdicts(osei, 'personal').heart).toBe('ACT');
    expect(regionVerdicts(osei, 'earth').heart).toBe('NOMINAL');
    expect(regionVerdicts(osei, 'space').heart).toBe('NOMINAL');
  });

  it('works on the bare fixture too (exactly the TV-8 assessment)', () => {
    expect(regionVerdicts([mockOseiHeartRateAct], 'earth').heart).toBe('NOMINAL');
    expect(regionVerdicts([mockOseiHeartRateAct], 'personal').heart).toBe('ACT');
  });

  it('returns every region; regions without a reading are NO_DATA (neutral)', () => {
    const r = regionVerdicts(osei, 'combined');
    expect(Object.keys(r).sort()).toEqual(BODY_REGIONS.map((x) => x.id).sort());
    expect(r.lungs).toBe('NO_DATA');
  });

  it('takes the worst verdict among the region signals, using the lens layer', () => {
    const bp = withLayers(
      { ...mockOseiHeartRateAct, signalId: 'blood_pressure' },
      { earth: 'WATCH' },
      'WATCH',
    );
    const hr = withLayers(mockOseiHeartRateAct, { earth: 'NOMINAL' }, 'ACT');
    expect(regionVerdicts([hr, bp], 'earth').heart).toBe('WATCH');
    expect(regionVerdicts([hr, bp], 'earth').vessels).toBe('WATCH'); // blood_pressure maps to heart and vessels
    expect(regionVerdicts([hr, bp], 'combined').heart).toBe('ACT');
  });

  it('NO_DATA layers never raise a region', () => {
    const a = withLayers(mockOseiHeartRateAct, { space: 'NO_DATA' }, 'ACT');
    const b = withLayers(
      { ...mockOseiHeartRateAct, signalId: 'blood_pressure' },
      { space: 'NOMINAL' },
      'NOMINAL',
    );
    expect(regionVerdicts([a, b], 'space').heart).toBe('NOMINAL');
  });

  it('region ↔ signal mapping comes from SignalDef.bodyRegions (doc 07 §6)', () => {
    expect(regionSignalIds('heart')).toEqual(['heart_rate_rest', 'blood_pressure']);
    expect(regionSignalIds('brain').sort()).toEqual(['mood', 'reaction_test', 'sleep_duration']);
    expect(regionSignalIds('vessels').sort()).toEqual(['blood_pressure', 'hematocrit', 'wbc']);
    expect(regionSignalIds('whole_body')).toEqual(['radiation_dose']);
  });
});

describe('worstSignalInRegion', () => {
  it('opens the heart-rate card for K. Osei', () => {
    expect(worstSignalInRegion(buildAssessments('c3', 143), 'heart', 'combined')).toBe('heart_rate_rest');
  });
  it('breaks lens ties by the combined verdict', () => {
    const osei = buildAssessments('c3', 143);
    // Under Earth both heart signals are NOMINAL / NO_DATA; HR still wins on the combined ACT.
    expect(worstSignalInRegion(osei, 'heart', 'earth')).toBe('heart_rate_rest');
  });
});

describe('system filter', () => {
  it('Heart & blood keeps heart, lungs, vessels and face', () => {
    const r = regionsInFilter('cardio');
    expect(r.has('heart')).toBe(true);
    expect(r.has('vessels')).toBe(true);
    expect(r.has('brain')).toBe(false);
  });
  it('Brain, eyes & nerves covers the behavioural brain signals', () => {
    const r = regionsInFilter('neuro-eye');
    // symptoms is a behavioural signal mapped to the skin region (catalog), so skin is included too.
    expect([...r].sort()).toEqual(['brain', 'eyes', 'skin']);
  });
  it('All keeps every region', () => {
    expect(regionsInFilter('all').size).toBe(12);
  });
});

describe('counters', () => {
  it('counts layer flags, caught-only-by-personal and Earth false alarms', () => {
    const c = layerCounters([mockOseiHeartRateAct, mockSleepExpected, mockSleepWatch]);
    expect(c).toEqual({
      earthFlags: 2, // sleep EXPECTED (earth WATCH) + sleep WATCH
      spaceFlags: 1, // sleep WATCH
      personalFlags: 2, // Osei HR ACT + sleep WATCH
      caughtOnlyByPersonal: 1,
      earthFalseAlarms: 1, // Earth WATCH while combined EXPECTED
    });
  });
  it('summarises a subject', () => {
    const s = subjectSummary(buildAssessments('c3', 143));
    expect(s.worst).toBe('ACT');
    expect(s.flags).toEqual({ personal: 1, space: 0, earth: 0 });
    expect(s.attention).toBe(1);
  });
  it('splits attention (sorted by severity) from the rest', () => {
    const { attention, rest } = splitByAttention([mockSleepExpected, mockSleepWatch, mockOseiHeartRateAct]);
    expect(attention.map((a) => a.verdict)).toEqual(['ACT', 'WATCH']);
    expect(rest.map((a) => a.verdict)).toEqual(['EXPECTED']);
  });
});

describe('body fixtures', () => {
  it('returns one assessment per registered crew signal', () => {
    const list = buildAssessments('c3', 143);
    expect(list).toHaveLength(18);
    expect(new Set(list.map((a) => a.signalId)).size).toBe(18);
  });
  it('cabin gets the three cabin signals', () => {
    expect(buildAssessments('cabin', 143).map((a) => a.signalId)).toEqual([
      'cabin_co2',
      'cabin_temp',
      'cabin_humidity',
    ]);
  });
  it('K. Osei HR follows the mock series across days (scrubber)', () => {
    const v = (d: number) => buildAssessments('c3', d).find((a) => a.signalId === 'heart_rate_rest')?.verdict;
    expect(v(140)).toBe('NOMINAL');
    expect(v(141)).toBe('WATCH');
    expect(v(143)).toBe('ACT');
    expect(v(100)).toBe('NO_DATA');
  });
});
