// Reaction Self-Test (PVT-B style) engine — FR-LAB-3, docs/09_MEASUREMENT_LAB.md §4.
//
// A pure state machine: no DOM, no timers, no React. Time comes from an injected clock and the inter-stimulus
// intervals from a seeded RNG, so a whole 180-s session runs instantly under a fake clock and is reproducible from
// its seed. The UI drives it: `update()` every animation frame, `markPainted(rafTimestamp)` once the stimulus is on
// screen, `respond()` on a key press or tap, `focusLost()` / `focusRegained()` on tab visibility and window focus.
//
// Sources: modeled on NASA's 3-minute PVT-B / ISS "Reaction Self-Test" [SRC_COGNITION, SRC_PVT_SPINOFF];
// duration 3 min, ISI 1–4 s and lapse ≥ 355 ms follow the published PVT-B design [SRC_PVT_B_BASNER2011].
// The 30-s timeout and the 2-s focus-loss abort are doc 09 §4 design choices. The false-start threshold
// (RT < 100 ms) is the usual PVT convention, NOT re-checked at source — treated as a demo parameter
// [SRC_DEMO_QUALITY_SCORES].

export interface PvtClock {
  /** Milliseconds on a monotonic time base (performance.now() in the browser). */
  now(): number;
}

/** Uniform random number in [0, 1). */
export type PvtRng = () => number;

export interface PvtParams {
  durationMs: number;
  isiMinMs: number;
  isiMaxMs: number;
  /** RT strictly below this is a false start. */
  falseStartMs: number;
  /** RT at or above this is a lapse. */
  lapseMs: number;
  /** No response this long after onset → lapse with RT = timeoutMs. */
  timeoutMs: number;
  /** Focus lost for longer than this → session aborted. */
  focusLossAbortMs: number;
}

export const PVT_PARAMS: Readonly<PvtParams> = Object.freeze({
  durationMs: 180_000, // SRC_PVT_B_BASNER2011 (3-min PVT-B)
  isiMinMs: 1_000, // SRC_PVT_B_BASNER2011
  isiMaxMs: 4_000, // SRC_PVT_B_BASNER2011
  falseStartMs: 100, // usual PVT convention, not re-checked at source → SRC_DEMO_QUALITY_SCORES
  lapseMs: 355, // SRC_PVT_B_BASNER2011
  timeoutMs: 30_000, // doc 09 §4 design choice → SRC_DEMO_QUALITY_SCORES
  focusLossAbortMs: 2_000, // doc 09 §4 design choice → SRC_DEMO_QUALITY_SCORES
});

export const PVT_SOURCE_IDS = ['SRC_COGNITION', 'SRC_PVT_SPINOFF', 'SRC_PVT_B_BASNER2011'] as const;
/** Registry entry for the parameters that are conventions/design choices, not re-checked at source. */
export const PVT_DEMO_SOURCE_ID = 'SRC_DEMO_QUALITY_SCORES';

/** mulberry32 — small, fast, deterministic 32-bit PRNG. Same seed → same sequence. */
export function createRng(seed: number): PvtRng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawIsi(rng: PvtRng, p: Pick<PvtParams, 'isiMinMs' | 'isiMaxMs'> = PVT_PARAMS): number {
  return p.isiMinMs + rng() * (p.isiMaxMs - p.isiMinMs);
}

export type PvtResponseKind = 'valid' | 'lapse' | 'false-start';

export interface PvtResponse {
  kind: PvtResponseKind;
  /** Reaction time from the painted onset; null for a press with no stimulus on screen. */
  rtMs: number | null;
  /** false = pressed while no stimulus was visible (counts as a false start, not as a stimulus). */
  stimulus: boolean;
  /** true = no response within timeoutMs (a lapse with rtMs = timeoutMs). */
  timedOut: boolean;
  /** Clock time of the press (or of the timeout). */
  at: number;
}

export type PvtPhase = 'idle' | 'isi' | 'stimulus' | 'paused' | 'done' | 'aborted';
export type PvtAbortReason = 'focus-lost' | 'stopped';

export interface PvtSnapshot {
  phase: PvtPhase;
  seed: number;
  /** Active test time (pauses excluded). */
  elapsedMs: number;
  remainingMs: number;
  /** Clock time the current stimulus was painted (null until markPainted). */
  stimulusOnsetAt: number | null;
  responses: readonly PvtResponse[];
  /** Every ISI drawn from the RNG, in order. */
  isis: readonly number[];
  lastResponse: PvtResponse | null;
  abortReason: PvtAbortReason | null;
  /** When paused: clock time focus was lost. */
  pausedSince: number | null;
}

export interface PvtEngineOptions {
  clock: PvtClock;
  seed: number;
  /** Defaults to createRng(seed). */
  rng?: PvtRng;
  params?: Partial<PvtParams>;
}

export class PvtEngine {
  readonly params: Readonly<PvtParams>;
  readonly seed: number;
  private readonly clock: PvtClock;
  private readonly rng: PvtRng;
  private phase: PvtPhase = 'idle';
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedSince: number | null = null;
  private endedAt: number | null = null;
  private nextStimulusAt: number | null = null;
  private onsetAt: number | null = null;
  private abortReason: PvtAbortReason | null = null;
  private readonly responses: PvtResponse[] = [];
  private readonly isis: number[] = [];

  constructor(opts: PvtEngineOptions) {
    this.clock = opts.clock;
    this.seed = opts.seed >>> 0;
    this.rng = opts.rng ?? createRng(this.seed);
    this.params = Object.freeze({ ...PVT_PARAMS, ...opts.params });
  }

  start(): void {
    if (this.phase !== 'idle') throw new Error('PvtEngine.start: session already started');
    const now = this.clock.now();
    this.startedAt = now;
    this.scheduleIsi(now);
  }

  /** Advance time-driven transitions: stimulus due, 30-s timeout, end of session, focus-loss abort. */
  update(): void {
    const now = this.clock.now();
    // Loop so a large clock jump processes every transition in order (bounded for safety).
    for (let guard = 0; guard < 10_000; guard++) {
      if (this.phase === 'paused') {
        if (this.pausedSince !== null && now - this.pausedSince > this.params.focusLossAbortMs) this.abort('focus-lost', now);
        return;
      }
      if (this.phase === 'isi') {
        const endAt = this.endAt();
        const due = this.nextStimulusAt as number;
        if (due < endAt && now >= due) {
          this.phase = 'stimulus';
          this.onsetAt = null;
          return; // the UI paints it, then calls markPainted()
        }
        if (now >= endAt) this.finish(endAt);
        return;
      }
      if (this.phase === 'stimulus' && this.onsetAt !== null && now - this.onsetAt >= this.params.timeoutMs) {
        const at = this.onsetAt + this.params.timeoutMs;
        this.record({ kind: 'lapse', rtMs: this.params.timeoutMs, stimulus: true, timedOut: true, at });
        this.scheduleIsi(at);
        continue;
      }
      return;
    }
  }

  /** The stimulus is on screen: `ts` is the rAF timestamp of the frame after the DOM update (doc 09 §4). */
  markPainted(ts: number = this.clock.now()): void {
    if (this.phase === 'stimulus' && this.onsetAt === null) this.onsetAt = ts;
  }

  /** A key press or tap. Returns the classified response, or null if the session is not running. */
  respond(): PvtResponse | null {
    this.update();
    const now = this.clock.now();
    if (this.phase === 'isi' || (this.phase === 'stimulus' && this.onsetAt === null)) {
      // Pressed with no stimulus visible → false start; the interval restarts (a pending stimulus is withdrawn).
      const r = this.record({ kind: 'false-start', rtMs: null, stimulus: false, timedOut: false, at: now });
      this.scheduleIsi(now);
      return r;
    }
    if (this.phase === 'stimulus' && this.onsetAt !== null) {
      const rt = now - this.onsetAt;
      const kind: PvtResponseKind = rt < this.params.falseStartMs ? 'false-start' : rt >= this.params.lapseMs ? 'lapse' : 'valid';
      const r = this.record({ kind, rtMs: rt, stimulus: true, timedOut: false, at: now });
      this.scheduleIsi(now);
      return r;
    }
    return null;
  }

  /** Tab hidden or window blurred: the test is disabled; a stimulus on screen is withdrawn and not counted. */
  focusLost(): void {
    if (this.phase !== 'isi' && this.phase !== 'stimulus') return;
    this.pausedSince = this.clock.now();
    this.phase = 'paused';
    this.onsetAt = null;
    this.nextStimulusAt = null;
  }

  /** Back in focus: resume with a fresh interval, or abort if focus was lost for more than 2 s. */
  focusRegained(): void {
    if (this.phase !== 'paused' || this.pausedSince === null) return;
    const now = this.clock.now();
    if (now - this.pausedSince > this.params.focusLossAbortMs) {
      this.abort('focus-lost', now);
      return;
    }
    this.pausedTotal += now - this.pausedSince;
    this.pausedSince = null;
    this.scheduleIsi(now);
  }

  /** The user stopped the test. */
  stop(): void {
    if (this.phase === 'done' || this.phase === 'aborted') return;
    this.abort('stopped', this.clock.now());
  }

  /** Clock time of the next time-driven transition (for scripted drivers); null when nothing is pending. */
  nextDueAt(): number | null {
    switch (this.phase) {
      case 'isi':
        return Math.min(this.nextStimulusAt as number, this.endAt());
      case 'stimulus':
        return this.onsetAt === null ? null : this.onsetAt + this.params.timeoutMs;
      default: // paused: driven by focus events, not by time alone
        return null;
    }
  }

  snapshot(): PvtSnapshot {
    const now = this.clock.now();
    const elapsed = this.elapsedAt(now);
    return {
      phase: this.phase,
      seed: this.seed,
      elapsedMs: elapsed,
      remainingMs: Math.max(0, this.params.durationMs - elapsed),
      stimulusOnsetAt: this.phase === 'stimulus' ? this.onsetAt : null,
      responses: [...this.responses],
      isis: [...this.isis],
      lastResponse: this.responses.length ? (this.responses[this.responses.length - 1] as PvtResponse) : null,
      abortReason: this.abortReason,
      pausedSince: this.pausedSince,
    };
  }

  private elapsedAt(now: number): number {
    if (this.phase === 'idle') return 0;
    const t = this.endedAt ?? this.pausedSince ?? now;
    return Math.max(0, Math.min(this.params.durationMs, t - this.startedAt - this.pausedTotal));
  }

  private endAt(): number {
    return this.startedAt + this.pausedTotal + this.params.durationMs;
  }

  private scheduleIsi(from: number): void {
    const isi = drawIsi(this.rng, this.params);
    this.isis.push(isi);
    this.nextStimulusAt = from + isi;
    this.onsetAt = null;
    this.phase = 'isi';
  }

  private record(r: PvtResponse): PvtResponse {
    this.responses.push(r);
    return r;
  }

  private finish(at: number): void {
    this.phase = 'done';
    this.endedAt = at;
    this.nextStimulusAt = null;
  }

  private abort(reason: PvtAbortReason, at: number): void {
    this.phase = 'aborted';
    this.abortReason = reason;
    this.endedAt = this.pausedSince ?? at;
    this.pausedSince = null;
    this.nextStimulusAt = null;
    this.onsetAt = null;
  }
}
