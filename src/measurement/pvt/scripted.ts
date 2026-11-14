// Scripted responses for the Reaction Self-Test test mode (?pvtTest=1) and for unit tests: a manual (virtual)
// clock plus a responder that answers every stimulus after a scripted RT, driven through the SAME engine.
// Scripted results are never a measurement: the UI badges them "TEST MODE — scripted responses" and saves them
// labeled SIMULATED. The RT ranges below are test fixtures, not physiological claims [SRC_DEMO_SIMULATION].
import { type PvtClock, type PvtEngine, type PvtRng, createRng } from './pvtEngine';

export interface ManualClock extends PvtClock {
  advance(ms: number): void;
  set(t: number): void;
}

export function createManualClock(start = 0): ManualClock {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (v) => {
      t = v;
    },
  };
}

export type PvtScriptProfile = 'slow' | 'normal';

/** Scripted RT generator: 'slow' answers mostly at or above the lapse threshold, 'normal' mostly below. */
export function scriptedRt(profile: PvtScriptProfile, rng: PvtRng): number {
  const u = rng();
  if (profile === 'slow') return u < 0.15 ? 250 + rng() * 90 : 380 + rng() * 270;
  return u < 0.05 ? 360 + rng() * 90 : 230 + rng() * 100;
}

export interface ScriptedDriver {
  /** Run up to `budgetMs` of virtual time. Returns true while the session is still running. */
  step(budgetMs: number): boolean;
}

/** Drives `engine` (started or not) on `clock` with scripted RTs; seed makes the RT sequence reproducible. */
export function createScriptedDriver(
  engine: PvtEngine,
  clock: ManualClock,
  profile: PvtScriptProfile,
  seed: number,
): ScriptedDriver {
  const rng = createRng(seed ^ 0x9e3779b9);
  let pendingRt: number | null = null;
  return {
    step(budgetMs) {
      let budget = budgetMs;
      if (engine.snapshot().phase === 'idle') engine.start();
      for (let guard = 0; guard < 100_000; guard++) {
        engine.update();
        const s = engine.snapshot();
        if (s.phase === 'done' || s.phase === 'aborted') return false;
        if (budget <= 0) return true;
        if (s.phase === 'stimulus') {
          if (s.stimulusOnsetAt === null) engine.markPainted(clock.now());
          pendingRt ??= scriptedRt(profile, rng);
          const onset = engine.snapshot().stimulusOnsetAt as number;
          const dt = Math.max(0, onset + pendingRt - clock.now());
          if (dt > budget) {
            clock.advance(budget);
            return true;
          }
          clock.advance(dt);
          budget -= dt;
          engine.respond();
          pendingRt = null;
          continue;
        }
        const due = engine.nextDueAt();
        if (due === null) return true;
        const dt = Math.max(0, due - clock.now());
        if (dt > budget) {
          clock.advance(budget);
          return true;
        }
        clock.advance(dt);
        budget -= dt;
      }
      return true;
    },
  };
}
