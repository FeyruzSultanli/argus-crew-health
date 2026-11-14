// Unit tests: resampling, POS, band-pass, Welch spectrum, HR and SNR on synthetic signals (doc 09 §1.2).
import { describe, expect, it } from 'vitest';

import { analyzeTrace } from './analyze';
import { bandpass } from './filters';
import { pos } from './pos';
import { RPPG_FS, resampleUniform } from './resample';
import { fft, peakFrequency, snrDb, welchPsd } from './spectrum';
import { gauss, rng, synthFrames } from './testSignals';

const fs = RPPG_FS;
const sine = (hz: number, sec: number, amp = 1) =>
  Float64Array.from({ length: Math.round(sec * fs) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / fs));
const rms = (x: Float64Array, from = 0, to = x.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] as number) ** 2;
  return Math.sqrt(s / (to - from));
};

function hrFromFrames(frames: ReturnType<typeof synthFrames>) {
  return analyzeTrace({ samples: frames, missed: 0, elapsedSec: 30, final: true });
}

describe('resampleUniform', () => {
  it('maps jittered timestamps onto a uniform 30 Hz grid by linear interpolation', () => {
    const rand = rng(7);
    const t: number[] = [];
    const y: number[] = [];
    let tt = 0;
    for (let i = 0; i < 300; i++) {
      t.push(tt);
      y.push(2 * tt + 5); // a line is reproduced exactly by linear interpolation
      tt += 33.3 + (rand() - 0.5) * 20; // 23..43 ms frame gaps
    }
    const r = resampleUniform(t, [y], 30);
    const out = r.channels[0] as Float64Array;
    expect(r.t0).toBe(0);
    expect(out.length).toBe(Math.floor((t[t.length - 1] as number) / (1000 / 30)) + 1);
    for (let k = 0; k < out.length; k++) expect(out[k]).toBeCloseTo(2 * ((k * 1000) / 30) + 5, 6);
  });

  it('handles empty and single-sample input', () => {
    expect(resampleUniform([], [[]]).channels[0]?.length).toBe(0);
    const one = resampleUniform([10], [[3]]);
    expect(Array.from(one.channels[0] as Float64Array)).toEqual([3]);
  });
});

describe('fft', () => {
  it('matches a naive DFT', () => {
    const n = 16;
    const rand = rng(3);
    const x = Array.from({ length: n }, () => rand() - 0.5);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      let sr = 0;
      let si = 0;
      for (let j = 0; j < n; j++) {
        sr += (x[j] as number) * Math.cos((-2 * Math.PI * k * j) / n);
        si += (x[j] as number) * Math.sin((-2 * Math.PI * k * j) / n);
      }
      expect(re[k]).toBeCloseTo(sr, 9);
      expect(im[k]).toBeCloseTo(si, 9);
    }
  });
});

describe('welchPsd', () => {
  it('has ≤ 0.1 bpm bin spacing and finds a 1.2 Hz tone', () => {
    const spec = welchPsd(sine(1.2, 30), fs);
    expect(((spec.freqs[1] as number) - (spec.freqs[0] as number)) * 60).toBeLessThanOrEqual(0.1);
    expect(spec.segments).toBe(5); // 10-s segments, 50 % overlap over 30 s
    expect((peakFrequency(spec, 0.7, 3.0) as number) * 60).toBeCloseTo(72, 0);
  });
});

describe('bandpass 0.7–3.0 Hz', () => {
  const ratio = (hz: number) => {
    const x = sine(hz, 30);
    const y = bandpass(x, fs);
    const a = Math.round(5 * fs);
    const b = x.length - a; // ignore edges
    return rms(y, a, b) / rms(x, a, b);
  };
  it('passes the heart-rate band', () => {
    expect(ratio(1.2)).toBeGreaterThan(0.9);
    expect(ratio(1.2)).toBeLessThan(1.1);
    expect(ratio(2.0)).toBeGreaterThan(0.85);
  });
  it('rejects respiration-band drift and high-frequency noise', () => {
    expect(ratio(0.2)).toBeLessThan(0.05);
    expect(ratio(6)).toBeLessThan(0.05);
  });
  it('keeps the input length', () => {
    expect(bandpass(sine(1, 12), fs).length).toBe(360);
  });
});

describe('POS', () => {
  it('recovers a pulse that is only in G and removes common-mode illumination change', () => {
    const n = 600;
    const r = new Float64Array(n);
    const g = new Float64Array(n);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const light = 1 + 0.05 * Math.sin((2 * Math.PI * 0.25 * i) / fs); // strong slow flicker in all channels
      r[i] = 150 * light;
      g[i] = (110 + 0.5 * Math.sin((2 * Math.PI * 1.2 * i) / fs)) * light;
      b[i] = 90 * light;
    }
    const p = pos(r, g, b);
    expect(p.length).toBe(n);
    const spec = welchPsd(p, fs);
    expect((peakFrequency(spec, 0.1, 4) as number) * 60).toBeCloseTo(72, 0);
  });
  it('returns zeros when the input is shorter than the window', () => {
    expect(Array.from(pos([1, 2], [1, 2], [1, 2]))).toEqual([0, 0]);
  });
});

describe('HR pipeline on synthetic frame traces', () => {
  it('1.2 Hz sinusoid in G with noise and jitter → 72 ± 1 bpm, good quality', () => {
    const est = hrFromFrames(synthFrames({ pulseHz: 1.2, seed: 11 }));
    expect(est.bpm).not.toBeNull();
    expect(Math.abs((est.bpm as number) - 72)).toBeLessThanOrEqual(1);
    expect(est.snrDb as number).toBeGreaterThan(3);
    expect(est.quality.label).toBe('good');
    expect(est.final).toBe(true);
  });
  it('1.6 Hz → 96 ± 1 bpm', () => {
    const est = hrFromFrames(synthFrames({ pulseHz: 1.6, seed: 12 }));
    expect(Math.abs((est.bpm as number) - 96)).toBeLessThanOrEqual(1);
  });
  it('survives a common illumination flicker (POS projection)', () => {
    const est = hrFromFrames(synthFrames({ pulseHz: 1.2, flicker: 0.02, flickerHz: 0.9, seed: 13 }));
    expect(Math.abs((est.bpm as number) - 72)).toBeLessThanOrEqual(1);
  });
  it('pure noise → quality poor (SNR < 0 dB)', () => {
    const est = hrFromFrames(synthFrames({ pulseHz: 0, noiseSd: 0.5, seed: 14 }));
    expect(est.snrDb as number).toBeLessThan(0);
    expect(est.quality.label).toBe('poor');
    expect(est.quality.reasons.join(' ')).toMatch(/weak pulse signal/);
  });
  it('too little data → no bpm, poor', () => {
    const est = analyzeTrace({ samples: synthFrames({ seconds: 2 }), missed: 0, elapsedSec: 2, final: false });
    expect(est.bpm).toBeNull();
    expect(est.quality.label).toBe('poor');
  });
  it('emits a normalised waveform of the last 10 s and a display spectrum', () => {
    const est = hrFromFrames(synthFrames({ seed: 15 }));
    expect(est.waveform.length).toBe(300);
    expect(Math.max(...est.waveform.map(Math.abs))).toBeCloseTo(1, 6);
    expect(est.spectrum.bpm[0]).toBe(42);
    expect(est.spectrum.bpm[est.spectrum.bpm.length - 1]).toBe(180);
    expect(est.hrFirst).toBeDefined();
    expect(est.hrLast).toBeDefined();
  });
});

describe('snrDb sign', () => {
  it('is positive for a clean tone and negative for white noise', () => {
    const tone = welchPsd(sine(1.2, 30), fs);
    expect(snrDb(tone, 1.2)).toBeGreaterThan(3);
    const g = gauss(rng(21));
    const noise = Float64Array.from({ length: 900 }, () => g());
    const ns = welchPsd(noise, fs);
    const f = peakFrequency(ns, 0.7, 3.0) as number;
    expect(snrDb(ns, f)).toBeLessThan(0);
  });
});
