import { describe, expect, it } from 'vitest';

import crewJson from '../../seed/crew.json';
import missionsJson from '../../seed/missions.json';
import scenariosJson from '../../seed/scenarios.json';
import sourcesJson from '../../seed/sources.json';
import type { MissionProfileId, SourceStatus } from './types';

// Compile-time + run-time check that the seed files import statically from src/ (resolveJsonModule)
// and that their enumerations stay inside the contract unions of types.ts.
const PROFILE_IDS: readonly MissionProfileId[] = [
  'iss',
  'lunar-transit',
  'lunar-surface',
  'lunar-rover',
  'mars-transit',
  'mars-surface',
];
const SOURCE_STATUSES: readonly SourceStatus[] = ['verified', 'partial', 'demo'];

describe('seed files vs contract types', () => {
  it('imports all four seed files', () => {
    expect(sourcesJson.sources.length).toBeGreaterThan(0);
    expect(crewJson.crew).toHaveLength(4);
    expect(missionsJson.profiles.length).toBeGreaterThan(0);
    expect(Array.isArray(scenariosJson.scenarios)).toBe(true);
  });

  it('mission profile ids are MissionProfileId values', () => {
    for (const p of missionsJson.profiles) expect(PROFILE_IDS).toContain(p.id);
  });

  it('source statuses are SourceStatus values', () => {
    for (const s of sourcesJson.sources) expect(SOURCE_STATUSES).toContain(s.status);
  });
});
