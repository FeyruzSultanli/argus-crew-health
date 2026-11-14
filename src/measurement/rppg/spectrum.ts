// Spectrum, heart rate and spectral SNR — doc 09 §1.2 steps 4–5 and §1.3 (SNR row).
// Welch PSD: 10-s segments, 50 % overlap, Hann window, zero-padded so the bin spacing is ≤ 0.1 bpm.

export interface Psd {
  /** Bin frequencies, Hz (one-sided, 0..fs/2). */
  freqs: Float64Array;
  /** Power spectral density per bin (arbitrary but consistent units). */
  psd: Float64Array;
  /** Number of averaged segments. */
  segments: number;
}

export interface WelchOptions {
  segmentSec?: number;
  overlap?: number;
  /** Target bin spacing, bpm. */
  resolutionBpm?: number;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place iterative radix-2 complex FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] as number;
      re[i] = re[j] as number;
      re[j] = tr;
      const ti = im[i] as number;
      im[i] = im[j] as number;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = (re[b] as number) * cr - (im[b] as number) * ci;
        const xi = (re[b] as number) * ci + (im[b] as number) * cr;
        re[b] = (re[a] as number) - xr;
        im[b] = (im[a] as number) - xi;
        re[a] = (re[a] as number) + xr;
        im[a] = (im[a] as number) + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Welch power spectral density of `x` sampled at `fs` Hz. Shorter-than-segment inputs use one segment. */
export function welchPsd(x: ArrayLike<number>, fs: number, opts: WelchOptions = {}): Psd {
  const { segmentSec = 10, overlap = 0.5, resolutionBpm = 0.1 } = opts;
  const n = x.length;
  const seg = Math.max(2, Math.min(n, Math.round(segmentSec * fs)));
  const step = Math.max(1, Math.round(seg * (1 - overlap)));
  const nfft = nextPow2(Math.max(seg, Math.ceil((fs * 60) / resolutionBpm)));
  const nBins = nfft / 2 + 1;
  const acc = new Float64Array(nBins);
  const win = new Float64Array(seg);
  let u = 0;
  for (let i = 0; i < seg; i++) {
    const w = seg > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (seg - 1)) : 1;
    win[i] = w;
    u += w * w;
  }
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  let segments = 0;
  for (let start = 0; start + seg <= n; start += step) {
    let m = 0;
    for (let i = 0; i < seg; i++) m += x[start + i] as number;
    m /= seg;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < seg; i++) re[i] = ((x[start + i] as number) - m) * (win[i] as number);
    fft(re, im);
    for (let k = 0; k < nBins; k++) {
      const p = (re[k] as number) ** 2 + (im[k] as number) ** 2;
      acc[k] = (acc[k] as number) + (k === 0 || k === nfft / 2 ? p : 2 * p);
    }
    segments++;
  }
  const freqs = new Float64Array(nBins);
  const scale = segments > 0 && u > 0 ? 1 / (segments * fs * u) : 0;
  for (let k = 0; k < nBins; k++) {
    freqs[k] = (k * fs) / nfft;
    acc[k] = (acc[k] as number) * scale;
  }
  return { freqs, psd: acc, segments };
}

/** Frequency (Hz) of the PSD maximum within [loHz, hiHz]; null if the band holds no power. */
export function peakFrequency(spec: Psd, loHz: number, hiHz: number): number | null {
  let best = -1;
  let bestP = 0;
  for (let k = 0; k < spec.freqs.length; k++) {
    const f = spec.freqs[k] as number;
    if (f < loHz || f > hiHz) continue;
    const p = spec.psd[k] as number;
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return best >= 0 ? (spec.freqs[best] as number) : null;
}

export interface SnrOptions {
  bandLoHz?: number;
  bandHiHz?: number;
  /** Half-width of the signal windows around the peak and its 2nd harmonic, bpm. */
  halfWidthBpm?: number;
}

/**
 * Spectral SNR in dB (doc 09 §1.3): power within ±6 bpm of the HR peak and of its 2nd harmonic versus the rest
 * of the 0.7–4 Hz band. Compute it on the POS signal BEFORE the band-pass.
 */
export function snrDb(spec: Psd, hrHz: number, opts: SnrOptions = {}): number {
  const { bandLoHz = 0.7, bandHiHz = 4.0, halfWidthBpm = 6 } = opts;
  const hw = halfWidthBpm / 60;
  let sig = 0;
  let noise = 0;
  for (let k = 0; k < spec.freqs.length; k++) {
    const f = spec.freqs[k] as number;
    if (f < bandLoHz || f > bandHiHz) continue;
    const p = spec.psd[k] as number;
    if (Math.abs(f - hrHz) <= hw || Math.abs(f - 2 * hrHz) <= hw) sig += p;
    else noise += p;
  }
  if (sig <= 0) return -Infinity;
  if (noise <= 0) return Infinity;
  return 10 * Math.log10(sig / noise);
}

/** Resample a PSD to integer-bpm points in [loBpm, hiBpm] (nearest bin), normalised to max 1 — for display. */
export function spectrumForDisplay(spec: Psd, loBpm = 42, hiBpm = 180): { bpm: number[]; power: number[] } {
  const bpm: number[] = [];
  const power: number[] = [];
  const df = spec.freqs.length > 1 ? (spec.freqs[1] as number) : 1;
  let max = 0;
  for (let b = loBpm; b <= hiBpm; b++) {
    const k = Math.round(b / 60 / df);
    const p = k < spec.psd.length ? (spec.psd[k] as number) : 0;
    bpm.push(b);
    power.push(p);
    if (p > max) max = p;
  }
  return { bpm, power: max > 0 ? power.map((p) => p / max) : power };
}
