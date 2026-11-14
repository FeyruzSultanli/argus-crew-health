// Seeded PRNG for the deterministic simulation (doc 05 §1.5, doc 12 §4): mulberry32 on a 32-bit hash of a string
// seed. Each simulated series gets its own stream (`seed|crewId|signalId`), so a scenario on one signal never shifts
// the random numbers of another.

/** Demo seed string (doc 12 §4) [SRC_DEMO_SIMULATION]. */
export const DEFAULT_SEED = 'argus-2026';

/** 32-bit FNV-1a hash of a string. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: returns uniform floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Normal(mean, sd) via Box–Muller; always consumes two uniforms. */
  normal(mean: number, sd: number): number;
  /** Uniform integer in [lo, hi] (inclusive). */
  int(lo: number, hi: number): number;
}

export function createRng(seed: string): Rng {
  const u = mulberry32(hashSeed(seed));
  return {
    next: u,
    normal(mean, sd) {
      const u1 = 1 - u(); // (0, 1]
      const u2 = u();
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    int(lo, hi) {
      return lo + Math.floor(u() * (hi - lo + 1));
    },
  };
}
