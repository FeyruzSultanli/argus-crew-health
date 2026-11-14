// Non-component helpers for the Body signal cards (kept out of .tsx files for fast refresh). Pure functions.
import { BookOpen, Crosshair, Send } from 'lucide-react';

import { getSignal } from '../../domain/signals';
import type { Assessment, Hazard, Observation, PersonalResult, SignalDef } from '../../domain/types';
import type { ActionCardPrimary } from '../../ui/ActionCard';
import type { ChartBand } from '../../ui/BandChart';
import { formatAge } from '../../ui/units';

/** Primary button by action kind (dispatch rule): remeasure → Lab, protocol → handbook entry, notify → Earth link. */
export function actionPrimary(action: Assessment['action']): ActionCardPrimary | undefined {
  switch (action.kind) {
    case 'remeasure':
      return { label: 'Measure in the Lab', icon: Crosshair, to: '/lab' };
    case 'protocol':
      return action.protocolId
        ? { label: 'Open protocol', icon: BookOpen, to: `/handbook/${action.protocolId}` }
        : { label: 'Open handbook', icon: BookOpen, to: '/handbook' };
    case 'notify-surgeon':
    case 'tell-cmo':
      return { label: 'Send to Earth', icon: Send, to: '/earth' };
    case 'none':
      return undefined;
  }
}

/** NASA's five hazards, worded as in SRC_NASA_HAZARDS. */
export const HAZARD_LABEL: Record<Hazard, string> = {
  radiation: 'Space radiation',
  isolation: 'Isolation and confinement',
  distance: 'Distance from Earth',
  gravity: 'Gravity fields',
  environment: 'Hostile and closed environments',
};

/** Sources behind an observation's own number: simulated data cites the simulation entry, others the signal. */
export function observationSourceIds(o: Observation): string[] {
  if (o.source.label === 'SIMULATED') return ['SRC_DEMO_SIMULATION'];
  return getSignal(o.signalId).sourceIds;
}

/** Age of a reading relative to the selected mission day ("3 h" the same day, "4 d" for older days). */
export function readingAge(o: Observation, missionDay: number, now: number = Date.now()): string {
  const days = missionDay - o.missionDay;
  if (days > 0) return `${days} d`;
  const minutes = (now - Date.parse(o.effectiveAt)) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 && minutes < 48 * 60 ? formatAge(minutes) : 'today';
}

/** Every source id behind a card: signal catalog, the three layers, and the observation. */
export function cardSourceIds(a: Assessment, def: SignalDef): string[] {
  const ids = [
    ...def.sourceIds,
    ...a.layers.personal.sourceIds,
    ...a.layers.space.sourceIds,
    ...a.layers.earth.sourceIds,
    ...(a.latest ? observationSourceIds(a.latest) : []),
  ];
  return Array.from(new Set(ids));
}

/** FR-SIG-4 step 4 window: the last 30 mission days up to the selected day. */
export const TREND_WINDOW_DAYS = 30;

export function trendWindow(series: PersonalResult['series'], upToDay: number): PersonalResult['series'] {
  const from = upToDay - (TREND_WINDOW_DAYS - 1);
  return series.filter((p) => p.missionDay >= from && p.missionDay <= upToDay);
}

/**
 * Space-expected band for signals that define an expected in-flight shift (SignalDef.personal.expectedShift):
 * the last pre-flight band moved by the shift, drawn over the in-flight part of the window.
 */
export function spaceExpectedBand(
  def: SignalDef,
  series: PersonalResult['series'],
  shift: number,
  window: PersonalResult['series'],
): ChartBand | undefined {
  if (!def.personal.expectedShift || shift === 0) return undefined;
  const pre = [...series].reverse().find((p) => p.missionDay < 1);
  const inFlight = window.filter((p) => p.missionDay >= 1);
  const first = inFlight[0];
  const last = inFlight[inFlight.length - 1];
  if (!pre || !first || !last) return undefined;
  return {
    lo: pre.lo + shift,
    hi: pre.hi + shift,
    fromDay: first.missionDay,
    toDay: last.missionDay,
    sourceIds: [
      'SRC_DEMO_BASELINE_ENGINE',
      ...def.sourceIds.filter((id) => id !== 'SRC_DEMO_BASELINE_ENGINE'),
    ],
  };
}
