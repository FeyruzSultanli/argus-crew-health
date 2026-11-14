import { describe, expect, it } from 'vitest';

import crewJson from '../../seed/crew.json';
import scenariosJson from '../../seed/scenarios.json';
import { loadSeed, profileById, validateCrew, validateProfiles } from './seed';
import { indexScenarios, validateScenarios } from './sim/scenarios';

describe('seed files validate against the contract types', () => {
  it('loads crew, profiles, scenarios and OSDR anchors', () => {
    const s = loadSeed();
    expect(s.crew.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(s.profiles.map((p) => p.id)).toContain('mars-transit');
    expect(profileById('mars-transit').demoMissionDay).toBe(143);
    expect(s.scenarios.map((x) => x.id)).toEqual([
      'silent-infection',
      'co2-spike',
      'sleep-debt',
      'sans-drift',
      'spe-event',
      'normal-adaptation',
    ]);
    expect(s.anchors.anchors).toHaveLength(12);
    expect(s.anchors.glucosePresent).toBe(true);
  });

  it('OSDR subjects are mapped to crew of the same sex (doc 06 §6)', () => {
    const s = loadSeed();
    expect(s.crew.map((c) => [c.id, c.sex, c.osdrSubject])).toEqual([
      ['c1', 'male', 'C001'],
      ['c2', 'male', 'C004'],
      ['c3', 'female', 'C003'],
      ['c4', 'female', 'C002'],
    ]);
    expect(s.anchors.crewMapping.map((m) => [m.crewId, m.subject])).toEqual([
      ['c1', 'C001'],
      ['c2', 'C004'],
      ['c3', 'C003'],
      ['c4', 'C002'],
    ]);
  });

  it('rejects drifted files', () => {
    const bad = structuredClone(crewJson) as { crew: Array<Record<string, unknown>> };
    bad.crew[0]!.role = 'Captain';
    expect(() => validateCrew(bad)).toThrow(/role/);
    expect(() => validateProfiles({ profiles: [{ id: 'venus' }] })).toThrow(/id/);
    const sc = structuredClone(scenariosJson) as { scenarios: Array<Record<string, unknown>> };
    sc.scenarios[0]!.days = [141, 142];
    expect(() => validateScenarios(sc, ['c1', 'c2', 'c3', 'c4'])).toThrow(/length/);
    const sc2 = structuredClone(scenariosJson) as { scenarios: Array<Record<string, unknown>> };
    sc2.scenarios[0]!.crewIds = ['c9'];
    expect(() => validateScenarios(sc2, ['c1', 'c2', 'c3', 'c4'])).toThrow(/unknown crew/);
  });

  it('scenario index resolves per-day effects', () => {
    const idx = indexScenarios(loadSeed().scenarios);
    expect(idx.get('c3', 'heart_rate_rest', 142)?.absolute).toBe(68);
    expect(idx.get('c3', 'body_temp', 143)?.delta).toBe(0.6);
    expect(idx.get('cabin', 'cabin_co2', 120)?.absolute).toBe(4.2);
    expect(idx.get('c2', 'symptoms', 118)?.symptoms).toEqual(['headache']);
    expect(idx.get('c1', 'symptoms', 118)).toBeUndefined();
    expect(idx.get('c1', 'amsler', 90, 'right')?.delta).toBe(2);
    expect(idx.get('c1', 'amsler', 90, 'left')).toBeUndefined();
    expect(idx.extraReactionDays('c2')).toEqual([133, 136]);
    expect(idx.inflightSleep).toEqual({ offsetHours: -0.9, sdHours: 0.35 });
  });
});
