// Tuning constants of the personal baseline engine (doc 08 §1–§4). Every value here except the MAD→SD factor is a
// demo parameter [SRC_DEMO_BASELINE_ENGINE]; the UI shows them with the "Demo parameter" tag.
import type { SignalId } from '../types';

export const BASELINE_PARAMS = {
  /** MAD → SD consistency factor for normal data (statistics constant, not tuned). */
  madToSigma: 1.4826,
  /** Pre-flight window, mission days (inclusive). */
  preflightFromDay: -180,
  preflightToDay: -1,
  /** Fewer pre-flight daily values → personal layer NO_DATA. */
  minPreflight: 3,
  /** Fewer than this (but ≥ minPreflight) → thin baseline, σ × thinFactor (after the floor). */
  fullPreflight: 5,
  thinFactor: 1.5,
  /** Adaptive in-flight baseline: last N mission days before today, ≥ M of them NOMINAL/EXPECTED. */
  adaptiveWindowDays: 14,
  adaptiveMinDays: 7,
  /** One-sided CuSum allowance. */
  k: 0.5,
  zWatch: 2.0,
  zAct: 3.0,
  cusumWatch: 4.0,
  cusumAct: 8.0,
  /** z ≥ this keeps a flagged state (hysteresis) and is needed twice for the CuSum ACT branch. */
  zSustain: 1.5,
  driftWatch: 2.5,
  /** Recovery reset: z below this on two consecutive readings → S = 0. */
  resetZ: 1.0,
  /** z, S and drift are rounded to this many decimals before any threshold test. */
  decimals: 2,
  /** Chart band = ref.m ∓ bandSigmas · ref.σ (doc 08 §6). */
  bandSigmas: 2,
  /** Persistent-shift guard (doc 08 §4): WATCH for ≥ N consecutive days with no ACT. */
  persistentShiftDays: 14,
} as const;

export const BASELINE_DEMO_SOURCE = 'SRC_DEMO_BASELINE_ENGINE';
/** Published precedent for per-person baselines + CuSum/state-machine alerting (doc 08 intro). */
export const BASELINE_PRECEDENT_SOURCES: readonly string[] = ['SRC_ALAVI_2022', 'SRC_MISHRA_2020'];

/**
 * Sources of the non-zero expected spaceflight shifts (doc 08 §2.2: "any non-zero shift must cite a source").
 * SignalDef has no field for this, so it lives here.
 */
export const EXPECTED_SHIFT_SOURCES: Partial<Record<SignalId, readonly string[]>> = {
  sleep_duration: ['SRC_SLEEP_BARGER'],
};

/** Numeric encoding of `numbers.referenceKind` (LayerResult.numbers is Record<string, number>). */
export const REFERENCE_KIND = { none: -1, preflight: 0, adaptive: 1 } as const;
export type ReferenceKindCode = (typeof REFERENCE_KIND)[keyof typeof REFERENCE_KIND];

/** Numeric encoding of `numbers.direction`. */
export const DIRECTION_CODE = { up: 1, down: -1 } as const;
