// Builds the health-record observation for a camera-pulse result. Only derived numbers — never frames.
import type { NewObservation } from '../../../domain/types';
import type { RppgEstimate } from '../../../measurement/rppg/types';

/** The observation saved for a camera-pulse result (shape per doc 06 §1). */
export function toObservation(r: RppgEstimate, crewId: string, missionDay: number): NewObservation {
  return {
    crewId,
    signalId: 'heart_rate_rest',
    value: Math.round(r.bpm as number),
    unit: '/min',
    missionDay,
    source: { kind: 'camera', method: 'rPPG-POS', label: 'MEASURED' },
    quality: { score: r.quality.score, label: r.quality.label, reasons: [...r.quality.reasons] },
  };
}
