// Unit tests: worker state machine — live estimates every second from 5 s (stable from 10 s), final at 30 s.
import { describe, expect, it } from 'vitest';

import { CAPTURE_SEC, RppgAccumulator } from './accumulator';
import { createInlineEngine } from './engine';
import { synthFrames } from './testSignals';
import type { RppgOut } from './types';

function feed(acc: RppgAccumulator, seconds = 31, missEvery = 0): RppgOut[] {
  const out: RppgOut[] = [];
  acc.handle({ type: 'reset' });
  synthFrames({ seconds, seed: 4 }).forEach((f, i) => {
    if (missEvery > 0 && i % missEvery === 0) out.push(...acc.handle({ type: 'miss', t: f.t, reason: 'noface' }));
    else out.push(...acc.handle({ type: 'frame', ...f }));
  });
  return out;
}

describe('RppgAccumulator', () => {
  it('emits one live estimate per second from 5 s, stable from 10 s, then exactly one final at 30 s', () => {
    const out = feed(new RppgAccumulator());
    const live = out.filter((e) => !e.final);
    const finals = out.filter((e) => e.final);
    expect(finals).toHaveLength(1);
    expect(live.length).toBeGreaterThanOrEqual(24);
    expect(live.length).toBeLessThanOrEqual(26);
    expect(live[0]?.elapsedSec).toBeGreaterThanOrEqual(5);
    expect(live.filter((e) => e.elapsedSec < 10).every((e) => !e.stable)).toBe(true);
    expect(live.filter((e) => e.elapsedSec >= 10).every((e) => e.stable)).toBe(true);
    const fin = finals[0] as RppgOut;
    expect(fin.elapsedSec).toBeGreaterThanOrEqual(CAPTURE_SEC - 0.1);
    expect(Math.abs((fin.bpm as number) - 72)).toBeLessThanOrEqual(1);
  });

  it('ignores frames after the final and supports reset', () => {
    const acc = new RppgAccumulator();
    feed(acc);
    expect(acc.handle({ type: 'frame', t: 99_999, r: 1, g: 1, b: 1, lum: 1, clip: 0, cx: 0, cy: 0 })).toEqual([]);
    expect(acc.handle({ type: 'finalize' })).toEqual([]);
    expect(feed(acc).filter((e) => e.final)).toHaveLength(1);
  });

  it('finalize before 30 s yields a final estimate', () => {
    const acc = new RppgAccumulator();
    feed(acc, 12);
    const [fin] = acc.handle({ type: 'finalize' });
    expect(fin?.final).toBe(true);
    expect(fin?.bpm).not.toBeNull();
  });

  it('counts missed frames into face presence', () => {
    const out = feed(new RppgAccumulator(), 31, 4); // 25 % of frames without a face
    const fin = out.find((e) => e.final) as RppgOut;
    const face = fin.checks.find((c) => c.id === 'face');
    expect(face?.value).toBeCloseTo(75, 0);
    expect(face?.label).toBe('poor');
  });
});

describe('inline engine', () => {
  it('delivers the same estimates through the engine interface', () => {
    const engine = createInlineEngine();
    const got: RppgOut[] = [];
    engine.onEstimate((e) => got.push(e));
    engine.post({ type: 'reset' });
    for (const f of synthFrames({ seconds: 31, seed: 5 })) engine.post({ type: 'frame', ...f });
    expect(got.some((e) => e.final)).toBe(true);
    engine.dispose();
    engine.post({ type: 'reset' });
  });
});
