// Modeled SPE dose — illustrative only (doc 10 §5). Every number here is a demo parameter
// [SRC_DEMO_RADIATION_MODEL · demo]; real crew dose comes from personal dosimeters.
//   doseRate_mSv_per_h = K × flux≥100MeV_pfu × shieldFactor,  K = 0.05, shieldFactor 1.0 (0.3 in storm shelter)
// Event gating: integrate only while an event is active — from the first sample at which the debounced S scale is
// ≥ S1 or the debounced ≥100 MeV alert holds, until the debounced S scale is back at S0 (and the alert is off).
// Outside an event the modeled dose rate is 0, so quiet-time background (~0.1–0.2 pfu) adds nothing.
import type { ProtonSample, SScale } from '../types';
import { debouncedS100Alert, debouncedSScale } from './sscale';

export const SPE_MODEL_SOURCE_IDS = ['SRC_DEMO_RADIATION_MODEL'] as const;
/** [demo] mSv per hour per pfu of ≥100 MeV flux. */
export const SPE_K_MSV_PER_H_PER_PFU = 0.05;
/** [demo] shield factors. */
export const SHIELD_FACTOR_NORMAL = 1.0;
export const SHIELD_FACTOR_SHELTER = 0.3;
/** A gap longer than this between samples is not integrated across (data outage, not dose). */
export const MAX_INTEGRATION_STEP_MIN = 15;
/** Exact UI label for every modeled number (doc 10 §5). */
export const MODELED_LABEL = 'Modeled — illustrative. Real crew dose comes from personal dosimeters.';

export function speDoseRateMsvPerH(flux100Pfu: number, shieldFactor = SHIELD_FACTOR_NORMAL): number {
  return SPE_K_MSV_PER_H_PER_PFU * Math.max(0, flux100Pfu) * shieldFactor;
}

/** One step of the ≥10 MeV timeline with everything derived up to and including that sample. */
export interface SpeStep {
  timeTag: string;
  flux10: number;
  /** ≥100 MeV flux at the same time tag (null when that channel has no sample). */
  flux100: number | null;
  sScale: SScale;
  s100Alert: boolean;
  /** An event is active at this sample (gating above). */
  active: boolean;
  /** Index into `events` of the current (active) or most recent event; -1 before the first event. */
  eventIndex: number;
  /** Modeled dose of the current or most recent event up to this sample (mSv). */
  eventMsv: number;
  /** Modeled dose summed over all events up to this sample (mSv). */
  totalMsv: number;
}

export interface SpeEvent {
  startTag: string;
  /** Time tag of the first sample back at S0; absent while the event is still active. */
  endTag?: string;
  peakSScale: SScale;
  doseMsv: number;
}

export interface SpeTimeline {
  steps: SpeStep[];
  events: SpeEvent[];
}

/**
 * Walks the ≥10 MeV samples (oldest first) and derives debounced S level, alert, event gating and the modeled dose.
 * The ≥100 MeV channel is matched by time tag. The dose of the interval (t[i-1], t[i]] is rate(flux100[i]) × Δt,
 * counted only when the event is active at sample i; Δt is capped at MAX_INTEGRATION_STEP_MIN.
 */
export function speTimeline(
  protons10: readonly ProtonSample[],
  protons100: readonly ProtonSample[],
  shieldFactor = SHIELD_FACTOR_NORMAL,
): SpeTimeline {
  const p100ByTime = new Map(protons100.map((s, i) => [s.timeTag, i]));
  const steps: SpeStep[] = [];
  const events: SpeEvent[] = [];
  let active = false;
  let total = 0;
  let prevMs: number | null = null;
  for (let i = 0; i < protons10.length; i++) {
    const s = protons10[i] as ProtonSample;
    const j = p100ByTime.get(s.timeTag);
    const flux100 = j === undefined ? null : (protons100[j] as ProtonSample).fluxPfu;
    const sScale = debouncedSScale(protons10, i);
    const s100Alert = j === undefined ? false : debouncedS100Alert(protons100, j);
    const ms = Date.parse(s.timeTag);
    if (!active && (sScale >= 1 || s100Alert)) {
      active = true;
      events.push({ startTag: s.timeTag, peakSScale: sScale, doseMsv: 0 });
    } else if (active && sScale === 0 && !s100Alert) {
      active = false;
      const ev = events[events.length - 1] as SpeEvent;
      ev.endTag = s.timeTag;
    }
    const ev = events[events.length - 1];
    if (active && ev) {
      ev.peakSScale = Math.max(ev.peakSScale, sScale) as SScale;
      if (prevMs !== null && flux100 !== null) {
        const dtH = Math.min(ms - prevMs, MAX_INTEGRATION_STEP_MIN * 60_000) / 3_600_000;
        const inc = speDoseRateMsvPerH(flux100, shieldFactor) * Math.max(0, dtH);
        ev.doseMsv += inc;
        total += inc;
      }
    }
    steps.push({
      timeTag: s.timeTag,
      flux10: s.fluxPfu,
      flux100,
      sScale,
      s100Alert,
      active,
      eventIndex: events.length - 1,
      eventMsv: ev ? ev.doseMsv : 0,
      totalMsv: total,
    });
    prevMs = ms;
  }
  return { steps, events };
}

/** Summary of a timeline at its end (or at step `end`). */
export interface SpeSummary {
  sScale: SScale;
  s100Alert: boolean;
  active: boolean;
  /** Time tag of the current event's start, when an event is active. */
  onsetTag?: string;
  currentEventMsv: number;
  totalMsv: number;
}

export function speSummaryAt(t: SpeTimeline, end = t.steps.length - 1): SpeSummary {
  const s = t.steps[end];
  if (!s) return { sScale: 0, s100Alert: false, active: false, currentEventMsv: 0, totalMsv: 0 };
  const out: SpeSummary = {
    sScale: s.sScale,
    s100Alert: s.s100Alert,
    active: s.active,
    currentEventMsv: s.eventMsv,
    totalMsv: s.totalMsv,
  };
  const ev = t.events[s.eventIndex];
  if (s.active && ev) out.onsetTag = ev.startTag;
  return out;
}
