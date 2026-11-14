// PVT engine under a fake clock (doc 09 §4): full 180-s session, ISI bounds and reproducibility, false starts,
// lapse threshold edge, 30-s timeout, tab-hidden pause, abort after > 2 s focus loss.
import { describe, expect, it } from 'vitest';

import { PVT_PARAMS, PvtEngine, createRng, drawIsi } from './pvtEngine';
import { scorePvt } from './pvtScoring';
import { createManualClock, createScriptedDriver } from './scripted';

function setup(seed = 42) {
  const clock = createManualClock(1_000);
  const engine = new PvtEngine({ clock, seed });
  return { clock, engine };
}

/** Start, wait for the first stimulus, paint it. Returns the onset time. */
function toFirstStimulus(clock: ReturnType<typeof createManualClock>, engine: PvtEngine): number {
  if (engine.snapshot().phase === 'idle') engine.start();
  const due = engine.nextDueAt() as number;
  clock.set(due);
  engine.update();
  expect(engine.snapshot().phase).toBe('stimulus');
  engine.markPainted(clock.now());
  return clock.now();
}

describe('createRng / drawIsi', () => {
  it('is deterministic per seed and ISIs stay within 1.0–4.0 s', () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const sa = Array.from({ length: 5000 }, () => drawIsi(a));
    const sb = Array.from({ length: 5000 }, () => drawIsi(b));
    const sc = Array.from({ length: 5 }, () => drawIsi(c));
    expect(sa).toEqual(sb);
    expect(sc).not.toEqual(sa.slice(0, 5));
    for (const isi of sa) {
      expect(isi).toBeGreaterThanOrEqual(1000);
      expect(isi).toBeLessThan(4000);
    }
    // spread over the whole interval, not stuck in one corner
    expect(Math.min(...sa)).toBeLessThan(1100);
    expect(Math.max(...sa)).toBeGreaterThan(3900);
  });
});

describe('PvtEngine', () => {
  it('uses the doc 09 §4 parameters', () => {
    expect(PVT_PARAMS).toMatchObject({
      durationMs: 180_000,
      isiMinMs: 1000,
      isiMaxMs: 4000,
      falseStartMs: 100,
      lapseMs: 355,
      timeoutMs: 30_000,
      focusLossAbortMs: 2000,
    });
  });

  it('runs a full 180-s session instantly under a fake clock, reproducible from the seed', () => {
    const run = (seed: number) => {
      const clock = createManualClock(0);
      const engine = new PvtEngine({ clock, seed });
      const driver = createScriptedDriver(engine, clock, 'normal', seed);
      while (driver.step(10_000));
      return { s: engine.snapshot(), end: clock.now() };
    };
    const { s, end } = run(123);
    expect(s.phase).toBe('done');
    expect(s.elapsedMs).toBe(180_000);
    expect(s.remainingMs).toBe(0);
    expect(end).toBeGreaterThanOrEqual(180_000);
    expect(end).toBeLessThan(180_000 + 4000 + 30_000);
    // ~ 180 s / (ISI 2.5 s + RT 0.3 s) ≈ 64 stimuli
    const score = scorePvt(s.responses);
    expect(score.nStimuli).toBeGreaterThan(45);
    expect(score.nStimuli).toBeLessThan(90);
    for (const isi of s.isis) {
      expect(isi).toBeGreaterThanOrEqual(1000);
      expect(isi).toBeLessThan(4000);
    }
    // same seed → identical ISIs and responses; different seed → different
    const again = run(123).s;
    expect(again.isis).toEqual(s.isis);
    expect(again.responses).toEqual(s.responses);
    expect(run(124).s.isis).not.toEqual(s.isis);
    expect(s.seed).toBe(123);
  });

  it('the first stimulus appears exactly after the first ISI, not before', () => {
    const { clock, engine } = setup();
    engine.start();
    const isi = engine.snapshot().isis[0] as number;
    clock.advance(isi - 1);
    engine.update();
    expect(engine.snapshot().phase).toBe('isi');
    clock.advance(1);
    engine.update();
    expect(engine.snapshot().phase).toBe('stimulus');
    expect(engine.snapshot().stimulusOnsetAt).toBeNull(); // not painted yet
  });

  it('measures RT from the painted frame (markPainted timestamp), not from when the stimulus became due', () => {
    const { clock, engine } = setup();
    engine.start();
    clock.set(engine.nextDueAt() as number);
    engine.update();
    clock.advance(16);
    engine.markPainted(clock.now()); // rAF timestamp one frame later
    engine.markPainted(clock.now() + 50); // second call ignored
    clock.advance(250);
    expect(engine.respond()).toMatchObject({ kind: 'valid', rtMs: 250, stimulus: true });
  });

  it('a press with no stimulus is a false start and restarts the interval', () => {
    const { clock, engine } = setup();
    engine.start();
    clock.advance(500);
    const r = engine.respond();
    expect(r).toMatchObject({ kind: 'false-start', rtMs: null, stimulus: false });
    const s = engine.snapshot();
    expect(s.phase).toBe('isi');
    expect(s.isis).toHaveLength(2);
    expect(engine.nextDueAt()).toBe(clock.now() + (s.isis[1] as number));
  });

  it('a press while the stimulus is due but not yet painted is a false start (nothing visible)', () => {
    const { clock, engine } = setup();
    engine.start();
    clock.set(engine.nextDueAt() as number);
    engine.update();
    expect(engine.respond()).toMatchObject({ kind: 'false-start', stimulus: false });
  });

  it('RT < 100 ms is a false start; 100 ms is valid', () => {
    const { clock, engine } = setup();
    toFirstStimulus(clock, engine);
    clock.advance(99.9);
    expect(engine.respond()).toMatchObject({ kind: 'false-start', stimulus: true });
    toFirstStimulus(clock, engine);
    clock.advance(100);
    expect(engine.respond()).toMatchObject({ kind: 'valid', rtMs: 100 });
  });

  it('lapse at exactly 355 ms, valid at 354 ms', () => {
    const { clock, engine } = setup();
    toFirstStimulus(clock, engine);
    clock.advance(354);
    expect(engine.respond()).toMatchObject({ kind: 'valid', rtMs: 354 });
    toFirstStimulus(clock, engine);
    clock.advance(355);
    expect(engine.respond()).toMatchObject({ kind: 'lapse', rtMs: 355 });
  });

  it('30-s timeout → lapse with RT 30 000 ms, then the next interval starts', () => {
    const { clock, engine } = setup();
    const onset = toFirstStimulus(clock, engine);
    clock.advance(29_999);
    engine.update();
    expect(engine.snapshot().phase).toBe('stimulus');
    clock.advance(1);
    engine.update();
    const s = engine.snapshot();
    expect(s.lastResponse).toEqual({ kind: 'lapse', rtMs: 30_000, stimulus: true, timedOut: true, at: onset + 30_000 });
    expect(s.phase).toBe('isi');
    const score = scorePvt(s.responses);
    expect(score).toMatchObject({ lapses: 1, timeouts: 1, medianRtMs: 30_000, nStimuli: 1 });
  });

  it('tab hidden pauses: the stimulus is withdrawn, time stops, the test resumes with a new interval', () => {
    const { clock, engine } = setup();
    toFirstStimulus(clock, engine);
    const elapsedBefore = engine.snapshot().elapsedMs;
    engine.focusLost();
    let s = engine.snapshot();
    expect(s.phase).toBe('paused');
    expect(s.stimulusOnsetAt).toBeNull();
    expect(engine.respond()).toBeNull(); // presses ignored while paused
    clock.advance(1500);
    engine.update();
    expect(engine.snapshot().elapsedMs).toBe(elapsedBefore); // paused time does not count
    engine.focusRegained();
    s = engine.snapshot();
    expect(s.phase).toBe('isi');
    expect(s.responses).toHaveLength(0); // the withdrawn stimulus is not counted
    clock.advance(1000);
    expect(engine.snapshot().elapsedMs).toBe(elapsedBefore + 1000);
  });

  it('focus lost for exactly 2 s resumes; for more than 2 s aborts (on return and while blurred)', () => {
    const a = setup();
    a.engine.start();
    a.engine.focusLost();
    a.clock.advance(2000);
    a.engine.focusRegained();
    expect(a.engine.snapshot().phase).toBe('isi');

    const b = setup();
    b.engine.start();
    b.engine.focusLost();
    b.clock.advance(2001);
    b.engine.focusRegained();
    expect(b.engine.snapshot()).toMatchObject({ phase: 'aborted', abortReason: 'focus-lost' });

    // blurred window keeps animating: update() aborts on its own
    const c = setup();
    c.engine.start();
    c.engine.focusLost();
    c.clock.advance(2000);
    c.engine.update();
    expect(c.engine.snapshot().phase).toBe('paused');
    c.clock.advance(1);
    c.engine.update();
    expect(c.engine.snapshot().phase).toBe('aborted');
  });

  it('full session with pauses still lasts 180 s of active time', () => {
    const clock = createManualClock(0);
    const engine = new PvtEngine({ clock, seed: 9 });
    const driver = createScriptedDriver(engine, clock, 'normal', 9);
    driver.step(60_000);
    engine.focusLost();
    clock.advance(1500);
    engine.focusRegained();
    while (driver.step(10_000));
    expect(engine.snapshot()).toMatchObject({ phase: 'done', elapsedMs: 180_000 });
    expect(clock.now()).toBeGreaterThanOrEqual(181_500);
  });

  it('stop() aborts with reason stopped; start() twice throws', () => {
    const { engine } = setup();
    engine.start();
    expect(() => engine.start()).toThrow();
    engine.stop();
    expect(engine.snapshot()).toMatchObject({ phase: 'aborted', abortReason: 'stopped' });
    expect(engine.respond()).toBeNull();
  });

  it('no new stimulus starts after 180 s; a stimulus already on screen is still answered', () => {
    const clock = createManualClock(0);
    // injected RNG: every ISI = 1000 + 0.999 × 3000 = 3997 ms
    const engine = new PvtEngine({ clock, seed: 5, rng: () => 0.999, params: { durationMs: 5000 } });
    engine.start();
    clock.set(3997);
    engine.update();
    engine.markPainted(clock.now());
    clock.set(5300); // past the 5-s end while the stimulus is on screen
    engine.update();
    expect(engine.snapshot().phase).toBe('stimulus');
    expect(engine.respond()).toMatchObject({ kind: 'lapse', rtMs: 1303 });
    // next stimulus would be due at 9297 > 5000 → session ends, no new stimulus
    clock.set(9297);
    engine.update();
    const s = engine.snapshot();
    expect(s.phase).toBe('done');
    expect(s.elapsedMs).toBe(5000);
    expect(s.responses).toHaveLength(1);
  });
});
