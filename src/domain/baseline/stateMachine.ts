// Per-direction state machine (doc 08 §4). The index t counts readings, not calendar days.
import { BASELINE_PARAMS as P } from './constants';
import { cusumStep } from './cusum';

export type EngineState = 'NOMINAL' | 'WATCH' | 'ACT';
/** What made the state: z ≥ 2 / 3 (z), CuSum (cusum), drift, hysteresis (flagged yesterday, z ≥ 1.5), none. */
export type Driver = 'z' | 'cusum' | 'drift' | 'hysteresis' | 'none';

export interface StateInput {
  z: number;
  /** z of the previous reading; null for the first reading. */
  prevZ: number | null;
  S: number;
  /** null when no adaptive baseline exists. */
  drift: number | null;
  prevState: EngineState;
}

export interface Classified {
  state: EngineState;
  driver: Driver;
}

/**
 * ACT   if (z_t ≥ 3 AND z_{t−1} ≥ 3) OR (S_t ≥ 8 AND z_t ≥ 1.5 AND z_{t−1} ≥ 1.5)
 * WATCH if z_t ≥ 2 OR S_t ≥ 4 OR drift ≥ 2.5 OR (state_{t−1} ∈ {WATCH, ACT} AND z_t ≥ 1.5)
 * NOMINAL otherwise. Both ACT branches need z_{t−1}, so a single reading can never give ACT.
 */
export function classify({ z, prevZ, S, drift, prevState }: StateInput): Classified {
  if (prevZ !== null) {
    if (z >= P.zAct && prevZ >= P.zAct) return { state: 'ACT', driver: 'z' };
    if (S >= P.cusumAct && z >= P.zSustain && prevZ >= P.zSustain) return { state: 'ACT', driver: 'cusum' };
  }
  if (z >= P.zWatch) return { state: 'WATCH', driver: 'z' };
  if (S >= P.cusumWatch) return { state: 'WATCH', driver: 'cusum' };
  if (drift !== null && drift >= P.driftWatch) return { state: 'WATCH', driver: 'drift' };
  if (prevState !== 'NOMINAL' && z >= P.zSustain) return { state: 'WATCH', driver: 'hysteresis' };
  return { state: 'NOMINAL', driver: 'none' };
}

/** Carried state of one direction between readings. */
export interface DirectionMemory {
  S: number;
  prevZ: number | null;
  prevState: EngineState;
  /** Readings in the current CuSum excursion (S > 0) whose z exceeded k — the "{n} days in a row" of §5. */
  run: number;
}

export const freshMemory = (): DirectionMemory => ({ S: 0, prevZ: null, prevState: 'NOMINAL', run: 0 });

export interface DirectionStep extends Classified {
  z: number;
  S: number;
  reset: boolean;
  run: number;
  drift: number | null;
}

/** One reading for one direction: CuSum update, then the state machine. Returns the step and the new memory. */
export function directionStep(
  mem: DirectionMemory,
  z: number,
  drift: number | null,
): { step: DirectionStep; memory: DirectionMemory } {
  const c = cusumStep(mem.S, z, mem.prevZ);
  const run = c.S === 0 ? 0 : mem.run + (z > P.k ? 1 : 0);
  const cls = classify({ z, prevZ: mem.prevZ, S: c.S, drift, prevState: mem.prevState });
  return {
    step: { ...cls, z, S: c.S, reset: c.reset, run, drift },
    memory: { S: c.S, prevZ: z, prevState: cls.state, run },
  };
}

export const ENGINE_SEVERITY: Record<EngineState, number> = { NOMINAL: 0, WATCH: 2, ACT: 3 };
