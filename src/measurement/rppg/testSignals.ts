// Synthetic test signals for the rPPG unit tests (seeded, deterministic). Test helper only.
import type { FrameSample } from './types';

/** Mulberry32 PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
export function gauss(rand: () => number): () => number {
  return () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export interface SynthOptions {
  seconds?: number;
  fps?: number;
  /** Pulse frequency in Hz; 0 → no pulse (pure noise). */
  pulseHz?: number;
  /** Pulse amplitude in G (grey levels). */
  pulseAmp?: number;
  /** Per-channel white noise SD (grey levels). */
  noiseSd?: number;
  /** Timestamp jitter SD, ms. */
  jitterMs?: number;
  /** Common multiplicative illumination flicker (fraction) at `flickerHz`. */
  flicker?: number;
  flickerHz?: number;
  /** Centroid wobble SD, px. */
  motionPx?: number;
  lum?: number;
  clip?: number;
  seed?: number;
  t0?: number;
}

/** Mean-RGB frame trace: a sinusoidal pulse in G on top of skin-like levels plus noise. */
export function synthFrames(o: SynthOptions = {}): FrameSample[] {
  const {
    seconds = 30,
    fps = 30,
    pulseHz = 1.2,
    pulseAmp = 0.6,
    noiseSd = 0.3,
    jitterMs = 4,
    flicker = 0,
    flickerHz = 0.3,
    motionPx = 0.5,
    lum = 120,
    clip = 0,
    seed = 1,
    t0 = 1000,
  } = o;
  const rand = rng(seed);
  const n = gauss(rand);
  const out: FrameSample[] = [];
  const count = Math.round(seconds * fps) + 1;
  for (let i = 0; i < count; i++) {
    const tIdeal = (i * 1000) / fps;
    const t = t0 + tIdeal + (i === 0 ? 0 : n() * jitterMs);
    const ts = tIdeal / 1000;
    const light = 1 + flicker * Math.sin(2 * Math.PI * flickerHz * ts);
    const pulse = pulseHz > 0 ? pulseAmp * Math.sin(2 * Math.PI * pulseHz * ts) : 0;
    out.push({
      t,
      r: (150 + n() * noiseSd) * light,
      g: (110 + pulse + n() * noiseSd) * light,
      b: (90 + n() * noiseSd) * light,
      lum,
      clip,
      cx: 320 + n() * motionPx,
      cy: 240 + n() * motionPx,
    });
  }
  // Jitter must not reorder frames.
  out.sort((a, b) => a.t - b.t);
  return out;
}
