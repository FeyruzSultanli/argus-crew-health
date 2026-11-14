// One full analysis pass over the frame trace collected so far — doc 09 §1.2 worker steps 1–6.
// Pure: the worker (and the in-thread fallback engine) only orchestrate calls to this function.
import { BAND_HI_HZ, BAND_LO_HZ, bandpass } from './filters';
import { pos } from './pos';
import { assessQuality, checkFacePresence, checkLighting, checkMotion } from './quality';
import { RPPG_FS, resampleUniform } from './resample';
import { peakFrequency, snrDb, spectrumForDisplay, welchPsd } from './spectrum';
import type { FrameSample, RppgEstimate } from './types';

/** Minimum usable trace before any HR is attempted, s (one POS window plus margin). */
export const MIN_ANALYSIS_SEC = 4;
/** The live number is greyed ("stabilising") until this much data is in, s (doc 09 §1.4). */
export const STABLE_AFTER_SEC = 10;
/** Consistency check window: first vs last 15 s (doc 09 §1.3). */
export const CONSISTENCY_WINDOW_SEC = 15;

export interface AnalyzeInput {
  samples: FrameSample[];
  /** Frames without a usable face (no face, head roll > 15°, empty ROI). */
  missed: number;
  elapsedSec: number;
  final: boolean;
}

function sdRadial(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] as number;
    my += ys[i] as number;
  }
  mx /= n;
  my /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += ((xs[i] as number) - mx) ** 2 + ((ys[i] as number) - my) ** 2;
  return Math.sqrt(v / n);
}

function hrOf(x: Float64Array, fs: number): number | null {
  const f = peakFrequency(welchPsd(x, fs), BAND_LO_HZ, BAND_HI_HZ);
  return f === null ? null : f * 60;
}

export function analyzeTrace({ samples, missed, elapsedSec, final }: AnalyzeInput): RppgEstimate {
  const n = samples.length;
  const total = n + missed;
  const facePct = total > 0 ? (100 * n) / total : 0;
  let lum = 0;
  let clip = 0;
  for (const s of samples) {
    lum += s.lum;
    clip += s.clip;
  }
  const meanLum = n > 0 ? lum / n : 0;
  const clipPct = n > 0 ? clip / n : 0;
  const motionSdPx = sdRadial(
    samples.map((s) => s.cx),
    samples.map((s) => s.cy),
  );
  const base = {
    type: 'estimate' as const,
    final,
    stable: elapsedSec >= STABLE_AFTER_SEC,
    elapsedSec,
  };

  const spanSec = n > 1 ? ((samples[n - 1] as FrameSample).t - (samples[0] as FrameSample).t) / 1000 : 0;
  if (spanSec < MIN_ANALYSIS_SEC) {
    // Only the checks that can be computed without a usable trace.
    const checks = [checkFacePresence(facePct)];
    if (n > 0) checks.unshift(checkLighting(meanLum, clipPct));
    if (n > 1) checks.unshift(checkMotion(motionSdPx));
    return {
      ...base,
      bpm: null,
      snrDb: null,
      quality: { score: 0, label: 'poor', reasons: ['not enough face frames to find a pulse'] },
      checks,
      spectrum: { bpm: [], power: [] },
      waveform: [],
    };
  }

  const { channels, fs } = resampleUniform(
    samples.map((s) => s.t),
    [samples.map((s) => s.r), samples.map((s) => s.g), samples.map((s) => s.b)],
    RPPG_FS,
  );
  const [r, g, b] = channels as [Float64Array, Float64Array, Float64Array];
  const p = pos(r, g, b);
  const pb = bandpass(p, fs);
  const psdBand = welchPsd(pb, fs);
  const peak = peakFrequency(psdBand, BAND_LO_HZ, BAND_HI_HZ);
  const bpm = peak === null ? null : peak * 60;
  // SNR on the POS signal BEFORE the band-pass (doc 09 §1.3) so the 2nd harmonic is still there.
  const snr = peak === null ? -Infinity : snrDb(welchPsd(p, fs), peak);

  let hrFirst: number | undefined;
  let hrLast: number | undefined;
  const win = Math.round(CONSISTENCY_WINDOW_SEC * fs);
  if (final && pb.length >= Math.round(20 * fs)) {
    hrFirst = hrOf(pb.slice(0, Math.min(win, pb.length)), fs) ?? undefined;
    hrLast = hrOf(pb.slice(Math.max(0, pb.length - win)), fs) ?? undefined;
  }
  const consistencyBpm = hrFirst !== undefined && hrLast !== undefined ? Math.abs(hrFirst - hrLast) : undefined;
  const { quality, checks } = assessQuality({ snrDb: snr, consistencyBpm, motionSdPx, meanLum, clipPct, facePct });
  if (bpm === null) quality.reasons.unshift('no pulse peak found');

  const tail = pb.slice(Math.max(0, pb.length - Math.round(STABLE_AFTER_SEC * fs)));
  let amp = 0;
  for (let i = 0; i < tail.length; i++) amp = Math.max(amp, Math.abs(tail[i] as number));
  const waveform = Array.from(tail, (v) => (amp > 0 ? v / amp : 0));

  const est: RppgEstimate = {
    ...base,
    bpm,
    snrDb: Number.isFinite(snr) ? snr : null,
    quality,
    checks,
    spectrum: spectrumForDisplay(psdBand),
    waveform,
  };
  if (hrFirst !== undefined) est.hrFirst = hrFirst;
  if (hrLast !== undefined) est.hrLast = hrLast;
  return est;
}
