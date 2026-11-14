// Builds the TriggerFacts for evaluateTrigger() from today's assessments (crew member + cabin). Pure.
// Space-weather facts are not passed in here: they stay missing, and a
// missing fact never satisfies a condition.
import { SYMPTOM_KEYS } from '../../domain/signals/symptoms';
import type { SymptomKey } from '../../domain/signals/symptoms';
import type { Assessment } from '../../domain/types';
import type { TriggerFacts } from './content';

export function buildTriggerFacts(
  crew: readonly Assessment[] | undefined,
  cabin: readonly Assessment[] | undefined,
  missionDay: number,
): TriggerFacts {
  const verdicts: NonNullable<TriggerFacts['verdicts']> = {};
  for (const a of crew ?? []) {
    verdicts[a.signalId] = {
      combined: a.verdict,
      personal: a.layers.personal.verdict,
      space: a.layers.space.verdict,
      earth: a.layers.earth.verdict,
    };
  }
  const symptomObs = crew?.find((a) => a.signalId === 'symptoms')?.latest;
  const symptoms: SymptomKey[] =
    symptomObs && symptomObs.missionDay === missionDay
      ? SYMPTOM_KEYS.filter((k) => (symptomObs.components?.[k] ?? 0) > 0)
      : [];
  const co2 = cabin?.find((a) => a.signalId === 'cabin_co2');
  const avg7d = co2?.layers.space.numbers?.avg7d ?? co2?.layers.earth.numbers?.avg7d;
  return {
    verdicts,
    symptoms,
    ...(avg7d !== undefined ? { cabin: { co2Avg7dMmHg: avg7d } } : {}),
  };
}

export type TriggerState = 'met' | 'not-met' | 'no-data';

/** 'no-data' when there is no assessment at all for the subject (nothing to judge). */
export function triggerState(met: boolean, crew: readonly Assessment[] | undefined): TriggerState {
  if (met) return 'met';
  return crew && crew.length > 0 ? 'not-met' : 'no-data';
}
