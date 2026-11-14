// Plane-Orthogonal-to-Skin (POS) rPPG — Wang, den Brinker, Stuijk, de Haan 2017 [SRC_POS_WANG2017].
// Exactly the formulas of docs/09_MEASUREMENT_LAB.md §1.2 step 2:
//   Cn = C_window / mean(C_window)       (per channel temporal normalisation)
//   S1 = Gn − Bn ;  S2 = Gn + Bn − 2·Rn
//   h  = S1 + (std(S1)/std(S2)) · S2
//   h  = h − mean(h)  → overlap-add into the output pulse signal P
// Window l = 1.6 s = 48 samples at 30 Hz, step 1 sample.

export const POS_SOURCE_ID = 'SRC_POS_WANG2017';
/** Window length in samples (1.6 s at 30 Hz). */
export const POS_WINDOW = 48;

function mean(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] as number;
  return x.length > 0 ? s / x.length : 0;
}

function std(x: Float64Array, m: number): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const d = (x[i] as number) - m;
    s += d * d;
  }
  return x.length > 0 ? Math.sqrt(s / x.length) : 0;
}

/** POS pulse signal from uniformly sampled mean-RGB traces (same length). Returns P (length N). */
export function pos(r: ArrayLike<number>, g: ArrayLike<number>, b: ArrayLike<number>, l: number = POS_WINDOW): Float64Array {
  const n = Math.min(r.length, g.length, b.length);
  const p = new Float64Array(n);
  if (n < l || l < 2) return p;
  const s1 = new Float64Array(l);
  const s2 = new Float64Array(l);
  const h = new Float64Array(l);
  for (let start = 0; start + l <= n; start++) {
    let mr = 0;
    let mg = 0;
    let mb = 0;
    for (let i = 0; i < l; i++) {
      mr += r[start + i] as number;
      mg += g[start + i] as number;
      mb += b[start + i] as number;
    }
    mr /= l;
    mg /= l;
    mb /= l;
    if (mr <= 0 || mg <= 0 || mb <= 0) continue; // black window: no skin signal
    for (let i = 0; i < l; i++) {
      const rn = (r[start + i] as number) / mr;
      const gn = (g[start + i] as number) / mg;
      const bn = (b[start + i] as number) / mb;
      s1[i] = gn - bn;
      s2[i] = gn + bn - 2 * rn;
    }
    const sd1 = std(s1, mean(s1));
    const sd2 = std(s2, mean(s2));
    const alpha = sd2 > 1e-12 ? sd1 / sd2 : 0;
    for (let i = 0; i < l; i++) h[i] = (s1[i] as number) + alpha * (s2[i] as number);
    const mh = mean(h);
    for (let i = 0; i < l; i++) p[start + i] = (p[start + i] as number) + (h[i] as number) - mh;
  }
  return p;
}
