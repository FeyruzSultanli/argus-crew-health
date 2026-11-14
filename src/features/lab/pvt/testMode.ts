// ?pvtTest=1 — scripted Reaction Self-Test for the demo-critical e2e (doc 14 §3 item 6).
// `&pvtProfile=slow|normal` (default normal), `&pvtSeed=<uint32>` (default 2026). Scripted runs are badged
// "TEST MODE — scripted responses" and saved labeled SIMULATED, never MEASURED.
import type { PvtScriptProfile } from '../../../measurement/pvt';

export interface PvtTestMode {
  profile: PvtScriptProfile;
  seed: number;
}

export const DEFAULT_TEST_SEED = 2026;

export function testModeFromSearch(search: string): PvtTestMode | null {
  const q = new URLSearchParams(search);
  if (q.get('pvtTest') !== '1') return null;
  const profile: PvtScriptProfile = q.get('pvtProfile') === 'slow' ? 'slow' : 'normal';
  const raw = Number(q.get('pvtSeed'));
  const seed = Number.isInteger(raw) && raw > 0 ? raw >>> 0 : DEFAULT_TEST_SEED;
  return { profile, seed };
}

/** A fresh per-session seed for real runs (stored with the observation, doc 09 §4). */
export function newSessionSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0] as number;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
