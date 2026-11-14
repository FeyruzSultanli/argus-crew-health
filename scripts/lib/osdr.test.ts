import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv';
import { buildAnchors, detectSexRanges, mapSubjectsToCrew, parseLabCsv, preflightDay } from './osdr';
import { findEventWindow, syntheticS2Profile } from './spe';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const cbc = readFileSync(join(root, 'seed', 'osdr', 'OSD-569_CBC.csv'), 'utf8');
const cmp = readFileSync(join(root, 'seed', 'osdr', 'OSD-575_CMP.csv'), 'utf8');

describe('csv', () => {
  it('handles quotes, escaped quotes, CRLF and a BOM', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(parseCsv(`${bom}a,b\r\n"x,1","say ""hi"""\r\n`)).toEqual([{ a: 'x,1', b: 'say "hi"' }]);
  });
});

describe('OSDR anchors from the committed files', () => {
  const parsed = buildAnchors(cbc, cmp);

  it('maps time points to mission days', () => {
    expect(preflightDay('L-92')).toBe(-92);
    expect(preflightDay('R+1')).toBeNull();
  });

  it('keeps only the three pre-flight time points per subject', () => {
    expect(parsed.anchors).toHaveLength(12);
    expect(new Set(parsed.anchors.map((a) => a.timepoint))).toEqual(new Set(['L-92', 'L-44', 'L-3']));
    const c001 = parsed.anchors.filter((a) => a.subject === 'C001').map((a) => [a.missionDay, a.hematocrit, a.wbc, a.glucose]);
    expect(c001).toEqual([
      [-92, 42.5, 5.4, 83],
      [-44, 45.1, 5.5, 80],
      [-3, 44.5, 7, 69],
    ]);
    expect(parsed.glucosePresent).toBe(true);
  });

  it('detects the sex-specific hematocrit ranges and each subject’s sex', () => {
    expect(detectSexRanges(parseLabCsv(cbc), 'HEMATOCRIT')).toEqual({ male: [38.5, 50], female: [35, 45] });
    expect(parsed.subjects.map((s) => [s.subject, s.sex, s.preflightHematocritRangeSex, s.rangeConsistent])).toEqual([
      ['C001', 'male', 'male', true],
      ['C002', 'female', 'female', true],
      ['C003', 'female', 'male', false], // lab printed the male range pre-flight; post-flight rows are "(FEMALE)"
      ['C004', 'male', 'male', true],
    ]);
  });

  it('maps subjects to crew by sex with the fewest changes', () => {
    const crew = [
      { id: 'c1', sex: 'male' as const, osdrSubject: 'C001' },
      { id: 'c2', sex: 'male' as const, osdrSubject: 'C002' },
      { id: 'c3', sex: 'female' as const, osdrSubject: 'C003' },
      { id: 'c4', sex: 'female' as const, osdrSubject: 'C004' },
    ];
    expect(mapSubjectsToCrew(crew, parsed.subjects).map((m) => [m.crewId, m.subject, m.changed])).toEqual([
      ['c1', 'C001', false],
      ['c2', 'C004', true],
      ['c3', 'C003', false],
      ['c4', 'C002', true],
    ]);
  });
});

describe('SPE replay', () => {
  it('synthetic S2 profile: 36 h at 5 min, peak 150 / 0.8 pfu at t = 3 h, no event detected below 10 pfu', () => {
    const p = syntheticS2Profile('2026-11-14T00:00:00Z');
    const p10 = p.filter((x) => x.energy === '>=10 MeV');
    const p100 = p.filter((x) => x.energy === '>=100 MeV');
    expect(p10).toHaveLength(432);
    expect(p10[0]).toMatchObject({ time_tag: '2026-11-14T00:00:00Z', flux: 0.2 });
    expect(Math.max(...p10.map((x) => x.flux))).toBe(150);
    expect(p10[36]).toMatchObject({ time_tag: '2026-11-14T03:00:00Z', flux: 150 });
    expect(Math.max(...p100.map((x) => x.flux))).toBe(0.8);
    expect(p10.findIndex((x) => x.flux >= 100)).toBeGreaterThan(6); // S2 reached after the 0.5-h onset
    expect(findEventWindow(p)?.peakPfu).toBe(150);
    expect(findEventWindow(p.map((x) => ({ ...x, flux: Math.min(x.flux, 9) })))).toBeNull();
  });
});
