// Saves validated observations one by one (onSave is called once per entered signal) and reports honestly
// which ones were saved and which were not.
import type { NewObservation, SignalId } from '../../../domain/types';

export const SIGNAL_NAMES: Partial<Record<SignalId, string>> = {
  blood_pressure: 'blood pressure',
  heart_rate_rest: 'heart rate',
  spo2: 'SpO₂',
  body_temp: 'temperature',
  glucose: 'glucose',
  body_mass: 'body mass',
  sleep_duration: 'sleep',
  mood: 'mood',
  symptoms: 'symptoms',
};

export interface SaveOutcome {
  saved: SignalId[];
  failed: Array<{ signalId: SignalId; message: string }>;
}

export async function saveAll(observations: readonly NewObservation[], onSave: (o: NewObservation) => Promise<unknown>): Promise<SaveOutcome> {
  const out: SaveOutcome = { saved: [], failed: [] };
  for (const o of observations) {
    try {
      await onSave(o);
      out.saved.push(o.signalId);
    } catch (e) {
      out.failed.push({ signalId: o.signalId, message: e instanceof Error ? e.message : 'The record could not be saved.' });
    }
  }
  return out;
}

export function describeOutcome(o: SaveOutcome): { savedText: string | null; failedText: string | null } {
  const names = (ids: SignalId[]) => ids.map((id) => SIGNAL_NAMES[id] ?? id).join(', ');
  const messages = [...new Set(o.failed.map((f) => f.message))].join(' ');
  return {
    savedText: o.saved.length ? `Saved: ${names(o.saved)}.` : null,
    failedText: o.failed.length ? `Not saved: ${names(o.failed.map((f) => f.signalId))}. ${messages}` : null,
  };
}
