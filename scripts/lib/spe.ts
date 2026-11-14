// GOES proton snapshot helpers and the synthetic S2 replay profile (doc 10 §8, doc 12 §2 step 3).
// All numbers of the synthetic profile are demo parameters [SRC_DEMO_RADIATION_MODEL].

export interface GoesSample {
  time_tag: string;
  satellite: number | null;
  flux: number;
  energy: string;
}

export const KEEP_ENERGIES = ['>=10 MeV', '>=100 MeV'] as const;
const EVENT_PFU = 10; // S1 threshold at >=10 MeV [SRC_NOAA_SWPC_PROTONS]

export function isGoesSample(x: unknown): x is GoesSample {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return typeof r.time_tag === 'string' && typeof r.energy === 'string' && typeof r.flux === 'number';
}

export function keepChannels(data: GoesSample[]): GoesSample[] {
  return data.filter((d) => (KEEP_ENERGIES as readonly string[]).includes(d.energy));
}

/**
 * Finds the window around the first >=10 MeV >= 10 pfu exceedance: from 2 h before the first exceeding sample to
 * 12 h after the last one (clipped to the data). Returns null when no sample reaches 10 pfu.
 */
export function findEventWindow(data: GoesSample[]): { from: string; to: string; peakPfu: number } | null {
  const p10 = data.filter((d) => d.energy === '>=10 MeV' && d.flux > 0);
  const over = p10.filter((d) => d.flux >= EVENT_PFU);
  if (over.length === 0) return null;
  const first = Date.parse(over[0]!.time_tag);
  const last = Date.parse(over[over.length - 1]!.time_tag);
  const from = new Date(first - 2 * 3600_000).toISOString();
  const to = new Date(last + 12 * 3600_000).toISOString();
  return { from, to, peakPfu: Math.max(...over.map((d) => d.flux)) };
}

export function sliceWindow(data: GoesSample[], from: string, to: string): GoesSample[] {
  const a = Date.parse(from);
  const b = Date.parse(to);
  return data.filter((d) => {
    const t = Date.parse(d.time_tag);
    return t >= a && t <= b;
  });
}

/** Demo parameters of the synthetic S2-class profile (doc 10 §8) [SRC_DEMO_RADIATION_MODEL]. */
export const SYNTHETIC_S2 = {
  durationHours: 36,
  stepMinutes: 5,
  riseStartHours: 0.5,
  peakHours: 3,
  decayEfoldHours: 10,
  p10: { backgroundPfu: 0.2, peakPfu: 150 },
  p100: { backgroundPfu: 0.15, peakPfu: 0.8 },
} as const;

function profileFlux(tHours: number, bg: number, peak: number): number {
  const { riseStartHours, peakHours, decayEfoldHours } = SYNTHETIC_S2;
  if (tHours < riseStartHours) return bg;
  if (tHours <= peakHours) {
    // exponential rise from background at riseStart to the peak at peakHours
    const frac = (tHours - riseStartHours) / (peakHours - riseStartHours);
    return bg * Math.exp(Math.log(peak / bg) * frac);
  }
  return Math.max(bg, peak * Math.exp(-(tHours - peakHours) / decayEfoldHours));
}

/** 5-minute samples over 36 h, NOAA JSON shape, time tags starting at `start` (ISO). */
export function syntheticS2Profile(start: string): GoesSample[] {
  const t0 = Date.parse(start);
  const n = (SYNTHETIC_S2.durationHours * 60) / SYNTHETIC_S2.stepMinutes;
  const out: GoesSample[] = [];
  for (let i = 0; i < n; i++) {
    const tHours = (i * SYNTHETIC_S2.stepMinutes) / 60;
    const time_tag = new Date(t0 + i * SYNTHETIC_S2.stepMinutes * 60_000).toISOString().replace('.000Z', 'Z');
    const round = (x: number): number => Math.round(x * 1000) / 1000;
    out.push({
      time_tag,
      satellite: null,
      flux: round(profileFlux(tHours, SYNTHETIC_S2.p10.backgroundPfu, SYNTHETIC_S2.p10.peakPfu)),
      energy: '>=10 MeV',
    });
    out.push({
      time_tag,
      satellite: null,
      flux: round(profileFlux(tHours, SYNTHETIC_S2.p100.backgroundPfu, SYNTHETIC_S2.p100.peakPfu)),
      energy: '>=100 MeV',
    });
  }
  return out;
}
