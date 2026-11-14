// Generic action templates of doc 07 §3 — used for every verdict without a signal-specific template (doc 07 §4).
// No other clinical wording may be added here.
import type { ActionTemplate, Assessment, SignalDef, Verdict } from '../types';

export const GENERIC_ACTIONS: Record<Verdict, ActionTemplate> = {
  // doc 07 §3: "NOMINAL → no action".
  NOMINAL: { text: 'No action needed.', kind: 'none' },
  EXPECTED: { text: 'Known change in space. Keep doing your countermeasures.', kind: 'none' },
  WATCH: { text: 'Re-measure. If it is still outside your usual range, tell the CMO.', kind: 'remeasure' },
  ACT: { text: 'Tell the CMO now and send a report to the flight surgeon.', kind: 'tell-cmo' },
  NO_DATA: { text: 'Measure to update.', kind: 'remeasure' },
};

/** Quality gate template (doc 07 §3 step 6). */
export const QUALITY_GATE_ACTION: ActionTemplate = {
  text: 'Reading quality is poor. Re-measure.',
  kind: 'remeasure',
};

export function toAction(t: ActionTemplate): Assessment['action'] {
  const a: Assessment['action'] = { text: t.text, kind: t.kind };
  if (t.protocolId !== undefined) a.protocolId = t.protocolId;
  if (t.dueInHours !== undefined) a.dueInHours = t.dueInHours;
  return a;
}

/** doc 07 §3 step 8: signal.actions[final], falling back to the generic template. */
export function actionFor(def: Pick<SignalDef, 'actions'>, verdict: Verdict): Assessment['action'] {
  return toAction(def.actions[verdict] ?? GENERIC_ACTIONS[verdict]);
}
