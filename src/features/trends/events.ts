// Event markers for the Trends charts: SIMULATED demo scenarios (seed/scenarios.json) and the launch day. Pure.
import scenariosJson from '../../../seed/scenarios.json';
import type { SignalId } from '../../domain/types';
import type { DayRange } from './axis';

export interface TrendEvent {
  id: string;
  label: string;
  fromDay: number;
  toDay: number;
  kind: 'scenario' | 'launch';
  /** Sources behind the marker (simulated scenarios cite the simulation entry). */
  sourceIds: readonly string[];
}

interface RawScenario {
  id: string;
  label: string;
  crewIds: string[];
  days: number[] | string;
  effects: Record<string, unknown>;
}

/** Scenario effect keys that are not signal ids. */
const EFFECT_SIGNAL: Record<string, SignalId> = { radiation: 'radiation_dose' };

export const LAUNCH_EVENT: TrendEvent = {
  id: 'launch',
  label: 'Launch',
  fromDay: 1,
  toDay: 1,
  kind: 'launch',
  sourceIds: ['SRC_DEMO_SIMULATION'],
};

/** Scenario spans with explicit days (the all-in-flight "normal adaptation" baseline is not an event). */
export function scenarioEvents(scenarios: readonly RawScenario[] = scenariosJson.scenarios): Array<{
  event: TrendEvent;
  crewIds: readonly string[];
  signals: readonly SignalId[];
}> {
  const out: Array<{ event: TrendEvent; crewIds: readonly string[]; signals: readonly SignalId[] }> = [];
  for (const s of scenarios) {
    if (!Array.isArray(s.days) || s.days.length === 0) continue;
    const signals = Object.keys(s.effects).map((k) => EFFECT_SIGNAL[k] ?? (k as SignalId));
    out.push({
      event: {
        id: s.id,
        label: s.label,
        fromDay: Math.min(...s.days),
        toDay: Math.max(...s.days),
        kind: 'scenario',
        sourceIds: ['SRC_DEMO_SIMULATION'],
      },
      crewIds: s.crewIds,
      signals,
    });
  }
  return out;
}

/**
 * Markers for one chart: the scenarios that affect this subject AND this signal, plus Launch, overlapping the range.
 * A scenario that lists the subject but whose effects name other signals is not drawn (no unrelated markers).
 */
export function eventsFor(subjectId: string, signalId: SignalId, range: DayRange): TrendEvent[] {
  const list = scenarioEvents()
    .filter((s) => s.crewIds.includes(subjectId) && s.signals.includes(signalId))
    .map((s) => s.event);
  return [LAUNCH_EVENT, ...list].filter((e) => e.toDay >= range.fromDay && e.fromDay <= range.toDay);
}
