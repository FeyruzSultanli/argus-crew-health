// Band-pass for the POS pulse signal — doc 09 §1.2 step 3: 0.7–3.0 Hz (42–180 bpm).
// 4th-order Butterworth high-pass at 0.7 Hz + 4th-order Butterworth low-pass at 3.0 Hz, each as a cascade of two
// biquads (bilinear transform, RBJ cookbook coefficients), applied forward and backward (zero phase) with odd
// reflection padding at both ends to tame start-up transients.

export const BAND_LO_HZ = 0.7;
export const BAND_HI_HZ = 3.0;

/** Pole-pair Q factors of a 4th-order Butterworth filter. */
const BUTTER4_Q = [0.5411961001461969, 1.3065629648763766] as const;

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function biquad(kind: 'lowpass' | 'highpass', f0: number, fs: number, q: number): Biquad {
  const w0 = (2 * Math.PI * f0) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const k = kind === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2;
  const b1 = kind === 'lowpass' ? 1 - cos : -(1 + cos);
  return { b0: k / a0, b1: b1 / a0, b2: k / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function runBiquad(x: Float64Array, c: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[i] = yi;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
  }
  return y;
}

function reverse(x: Float64Array): Float64Array {
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[x.length - 1 - i] as number;
  return y;
}

function cascade(x: Float64Array, stages: Biquad[]): Float64Array {
  let y = x;
  for (const s of stages) y = runBiquad(y, s);
  return y;
}

/** Zero-phase band-pass of `x` sampled at `fs` Hz. Output has the same length as the input. */
export function bandpass(x: ArrayLike<number>, fs: number, lo: number = BAND_LO_HZ, hi: number = BAND_HI_HZ): Float64Array {
  const n = x.length;
  if (n < 4) return new Float64Array(n);
  const stages: Biquad[] = [
    ...BUTTER4_Q.map((q) => biquad('highpass', lo, fs, q)),
    ...BUTTER4_Q.map((q) => biquad('lowpass', hi, fs, q)),
  ];
  // Odd reflection padding (like scipy filtfilt), up to 3 s each side.
  const pad = Math.min(n - 1, Math.round(3 * fs));
  const ext = new Float64Array(n + 2 * pad);
  const first = x[0] as number;
  const last = x[n - 1] as number;
  for (let i = 0; i < pad; i++) ext[i] = 2 * first - (x[pad - i] as number);
  for (let i = 0; i < n; i++) ext[pad + i] = x[i] as number;
  for (let i = 0; i < pad; i++) ext[pad + n + i] = 2 * last - (x[n - 2 - i] as number);
  const fwd = cascade(ext, stages);
  const back = reverse(cascade(reverse(fwd), stages));
  return back.slice(pad, pad + n);
}
