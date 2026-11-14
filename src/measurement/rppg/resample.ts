// Uniform resampling of irregularly timed frame traces — doc 09 §1.2 worker step 1.
// Linear interpolation on timestamps; frames from the camera arrive with jitter and gaps.

/** Target analysis rate (Hz). */
export const RPPG_FS = 30;

export interface Resampled {
  /** Time of the first output sample, ms. */
  t0: number;
  fs: number;
  /** One output array per input channel. */
  channels: Float64Array[];
}

/**
 * Resample `channels` (each aligned with `t`, ms, non-decreasing) to a uniform grid of `fs` Hz from t[0] to t[last].
 * Duplicate timestamps are tolerated (the later sample wins).
 */
export function resampleUniform(t: ArrayLike<number>, channels: ArrayLike<number>[], fs: number = RPPG_FS): Resampled {
  const n = t.length;
  if (n === 0) return { t0: 0, fs, channels: channels.map(() => new Float64Array(0)) };
  const t0 = t[0] as number;
  const tEnd = t[n - 1] as number;
  const dt = 1000 / fs;
  const m = Math.floor((tEnd - t0) / dt + 1e-9) + 1;
  const out = channels.map(() => new Float64Array(m));
  let j = 0; // index of the left neighbour
  for (let k = 0; k < m; k++) {
    const tk = t0 + k * dt;
    while (j < n - 2 && (t[j + 1] as number) <= tk) j++;
    const ta = t[j] as number;
    const tb = t[Math.min(j + 1, n - 1)] as number;
    const span = tb - ta;
    const w = span > 0 ? Math.min(1, Math.max(0, (tk - ta) / span)) : 1;
    for (let c = 0; c < channels.length; c++) {
      const ch = channels[c] as ArrayLike<number>;
      const a = ch[j] as number;
      const b = ch[Math.min(j + 1, n - 1)] as number;
      (out[c] as Float64Array)[k] = a + w * (b - a);
    }
  }
  return { t0, fs, channels: out };
}
