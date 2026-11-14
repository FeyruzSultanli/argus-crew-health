// Source ids for a stored reading shown through <Value>: simulated readings cite the simulation entry; a reading
// measured by the crew cites what the signal is based on (its non-demo catalog sources) — the demo rule-band ids
// describe thresholds, not the reading itself.
import { getSignal } from '../../domain/signals';
import type { Observation } from '../../domain/types';
import { getSources } from '../../ui/sources';

export function readingSourceIds(o: Pick<Observation, 'signalId' | 'source'>): readonly string[] {
  if (o.source.label === 'SIMULATED' || o.source.kind === 'simulated') return ['SRC_DEMO_SIMULATION'];
  if (o.signalId === 'reaction_test') return ['SRC_PVT_B_BASNER2011'];
  return getSources(getSignal(o.signalId).sourceIds)
    .filter((s) => s.status !== 'demo')
    .map((s) => s.id);
}
