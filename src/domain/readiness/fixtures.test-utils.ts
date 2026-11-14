// Test fixtures for readiness / bridge tests (not shipped: only imported by *.test.ts files).
import type { Assessment, LayerId, LayerResult, Observation, SignalId, Verdict } from '../types';

const layer = (l: LayerId, verdict: Verdict, numbers?: Record<string, number>): LayerResult => ({
  layer: l,
  verdict,
  reason: `${l} ${verdict}`,
  sourceIds: [],
  ...(numbers ? { numbers } : {}),
});

export interface AssessmentOpts {
  P?: Verdict;
  S?: Verdict;
  E?: Verdict;
  caught?: boolean;
  drivenBy?: LayerId[];
  numbers?: Record<string, number>;
  action?: string;
  explanation?: string;
  missionDay?: number;
}

export function mkAssessment(
  crewId: string,
  signalId: SignalId,
  verdict: Verdict,
  o: AssessmentOpts = {},
): Assessment {
  return {
    crewId,
    signalId,
    missionDay: o.missionDay ?? 143,
    layers: {
      personal: layer('personal', o.P ?? verdict),
      space: layer('space', o.S ?? verdict, o.numbers),
      earth: layer('earth', o.E ?? verdict, o.numbers),
    },
    quality: { score: 1, label: 'good', reasons: [] },
    verdict,
    drivenBy: o.drivenBy ?? ['personal'],
    caughtOnlyByPersonal: o.caught ?? false,
    action: { text: o.action ?? 'No action needed.', kind: verdict === 'ACT' ? 'protocol' : 'none' },
    explanation: o.explanation ?? `${signalId} ${verdict}`,
  };
}

export function mkObs(
  crewId: string,
  signalId: SignalId,
  missionDay: number,
  value: number | null,
): Observation {
  return {
    id: `${crewId}:${signalId}:${missionDay}`,
    crewId,
    signalId,
    value,
    unit: '1',
    effectiveAt: '2026-11-14T07:00:00Z',
    missionDay,
    source: { kind: 'simulated', label: 'SIMULATED' },
    quality: { score: 1, label: 'good', reasons: [] },
  };
}

/** Mission days from `from` to `to` inclusive, skipping day 0. */
export function dayRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let d = from; d <= to; d++) if (d !== 0) out.push(d);
  return out;
}
