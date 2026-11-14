// Near acuity with a tumbling E (doc 09 §3.3). Pure TypeScript: optotype sizing, the seeded orientation sequence,
// the line-by-line state machine, ETDRS-style letter scoring and the screen-resolution-limit stop.
// - Target distance 60 cm (an intermediate-distance screen test, not a 40-cm near card).
// - Optotype height h_mm = d_mm · tan((5 · 10^logMAR) / 60 · π/180); lines logMAR 1.0 → 0.0 in 0.1 steps, 5 per line.
// - A line is passed with ≥ 3/5 correct; the test stops at the first failed line.
//   score = last passed line − 0.02 × correct letters on the next (failed) line.
// - Stop if the next line's optotype would be under 5 DEVICE pixels: "screen resolution limit reached at logMAR X",
//   where X is the smallest line this screen can still draw.
import { createRng } from '../pvt';

export const ACUITY_DISTANCE_MM = 600;
export const ACUITY_LINES: readonly number[] = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
export const OPTOTYPES_PER_LINE = 5;
export const LINE_PASS_MIN = 3;
/** logMAR credit per letter (0.1 logMAR line / 5 letters). */
export const LETTER_LOGMAR = 0.02;
/** Smallest optotype height the screen can draw, device pixels. */
export const MIN_OPTOTYPE_DEVICE_PX = 5;

export const E_DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type EDirection = (typeof E_DIRECTIONS)[number];

export interface ScreenGeometry {
  /** Viewing distance, mm. */
  distanceMm: number;
  /** CSS px per mm (screen calibration). */
  pxPerMm: number;
  /** window.devicePixelRatio. */
  dpr: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Optotype (E) height in mm for a logMAR line at a viewing distance. */
export function optotypeHeightMm(logMAR: number, distanceMm: number = ACUITY_DISTANCE_MM): number {
  const arcmin = 5 * 10 ** logMAR;
  return distanceMm * Math.tan(((arcmin / 60) * Math.PI) / 180);
}

/** Optotype height in device pixels on this screen. */
export function optotypeHeightDevicePx(logMAR: number, g: ScreenGeometry): number {
  return optotypeHeightMm(logMAR, g.distanceMm) * g.pxPerMm * g.dpr;
}

/** Number of lines (from logMAR 1.0 down) whose optotype is at least MIN_OPTOTYPE_DEVICE_PX tall. */
export function drawableLineCount(g: ScreenGeometry): number {
  let n = 0;
  for (const line of ACUITY_LINES) {
    if (optotypeHeightDevicePx(line, g) < MIN_OPTOTYPE_DEVICE_PX) break;
    n += 1;
  }
  return n;
}

/** Seeded orientations, OPTOTYPES_PER_LINE per line for every line (same seed → same sequence). */
export function orientationSequence(seed: number): EDirection[] {
  const rng = createRng(seed);
  return Array.from({ length: ACUITY_LINES.length * OPTOTYPES_PER_LINE }, () => E_DIRECTIONS[Math.floor(rng() * 4) % 4] as EDirection);
}

/** Approximate Snellen denominator for 20-ft notation: 20 · 10^logMAR (standard conversion). */
export function snellenDenominator(logMAR: number): number {
  return Math.round(20 * 10 ** logMAR);
}

export type AcuityStop = 'failed-line' | 'all-lines' | 'resolution-limit';

export interface AcuityState {
  seed: number;
  orientations: readonly EDirection[];
  /** Lines this screen can draw (from drawableLineCount). */
  drawableLines: number;
  /** Correct/incorrect per answered optotype, per line (index into ACUITY_LINES). */
  answers: readonly (readonly boolean[])[];
  done: boolean;
  stop: AcuityStop | null;
}

export function createAcuityTest(seed: number, drawableLines: number): AcuityState {
  const n = Math.max(0, Math.min(ACUITY_LINES.length, Math.floor(drawableLines)));
  return {
    seed,
    orientations: orientationSequence(seed),
    drawableLines: n,
    answers: [],
    done: n === 0,
    stop: n === 0 ? 'resolution-limit' : null,
  };
}

/** Current line index and optotype position within it (meaningful while !done). */
export function acuityPosition(s: AcuityState): { line: number; item: number } {
  const line = Math.max(0, s.answers.length - 1);
  const current = s.answers[line];
  if (current === undefined || current.length === OPTOTYPES_PER_LINE) return { line: s.answers.length, item: 0 };
  return { line, item: current.length };
}

/** Orientation of the optotype on screen now (null when done). */
export function currentOrientation(s: AcuityState): EDirection | null {
  if (s.done) return null;
  const { line, item } = acuityPosition(s);
  return s.orientations[line * OPTOTYPES_PER_LINE + item] ?? null;
}

const correctOn = (line: readonly boolean[] | undefined): number => (line ?? []).filter(Boolean).length;

export function answerAcuity(s: AcuityState, dir: EDirection): AcuityState {
  if (s.done) return s;
  const { line, item } = acuityPosition(s);
  const ok = s.orientations[line * OPTOTYPES_PER_LINE + item] === dir;
  const answers = s.answers.slice();
  answers[line] = [...(answers[line] ?? []), ok];
  const lineAnswers = answers[line] as boolean[];
  if (lineAnswers.length < OPTOTYPES_PER_LINE) return { ...s, answers };
  if (correctOn(lineAnswers) < LINE_PASS_MIN) return { ...s, answers, done: true, stop: 'failed-line' };
  if (line + 1 >= ACUITY_LINES.length) return { ...s, answers, done: true, stop: 'all-lines' };
  if (line + 1 >= s.drawableLines) return { ...s, answers, done: true, stop: 'resolution-limit' };
  return { ...s, answers };
}

export interface AcuityScore {
  /** logMAR score (two decimals); null when no line was passed. */
  logMAR: number | null;
  /** logMAR of the last passed line, or null. */
  lastPassed: number | null;
  /** Correct letters on the line after the last passed one. */
  extraCorrect: number;
  /** The test stopped because the screen cannot draw the next line. */
  resolutionLimited: boolean;
  /** Smallest line this screen can draw (reported when resolutionLimited). */
  limitLogMAR: number | null;
  correctTotal: number;
  answeredTotal: number;
}

export function scoreAcuity(s: AcuityState): AcuityScore {
  let lastPassedIdx = -1;
  s.answers.forEach((line, i) => {
    if (line.length === OPTOTYPES_PER_LINE && correctOn(line) >= LINE_PASS_MIN && i === lastPassedIdx + 1) lastPassedIdx = i;
  });
  const extraCorrect = correctOn(s.answers[lastPassedIdx + 1]);
  const lastPassed = lastPassedIdx >= 0 ? (ACUITY_LINES[lastPassedIdx] as number) : null;
  const resolutionLimited = s.stop === 'resolution-limit';
  const limitLogMAR = s.drawableLines > 0 ? (ACUITY_LINES[s.drawableLines - 1] as number) : null;
  return {
    logMAR: lastPassed === null ? null : round2(lastPassed - LETTER_LOGMAR * extraCorrect),
    lastPassed,
    extraCorrect,
    resolutionLimited,
    limitLogMAR,
    correctTotal: s.answers.reduce((n, l) => n + correctOn(l), 0),
    answeredTotal: s.answers.reduce((n, l) => n + l.length, 0),
  };
}
