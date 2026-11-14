// The quality thresholds of doc 09 §1.3 as structured cells, so every number renders through <Value>
// (all demo parameters, SRC_DEMO_QUALITY_SCORES). Built from QUALITY_THRESHOLDS — no second copy of the numbers.
import { QUALITY_THRESHOLDS as T } from '../../../measurement/rppg/quality';
import type { CheckId } from '../../../measurement/rppg/types';

export interface Bound {
  prefix?: string;
  value: number;
  unit?: string;
}
export type Cell = Array<Bound | string>;

const { good: lg, fair: lf } = T.lighting;

export const THRESHOLD_ROWS: Record<CheckId, { good: Cell; fair: Cell; poor: Cell }> = {
  snr: {
    good: [{ prefix: '≥', value: T.snrDb.good, unit: 'dB' }],
    fair: [{ value: T.snrDb.fair, unit: 'dB' }, 'to', { prefix: '<', value: T.snrDb.good, unit: 'dB' }],
    poor: [{ prefix: '<', value: T.snrDb.fair, unit: 'dB' }],
  },
  consistency: {
    good: [{ prefix: '≤', value: T.consistencyBpm.good, unit: '/min' }],
    fair: [{ prefix: '≤', value: T.consistencyBpm.fair, unit: '/min' }],
    poor: [{ prefix: '>', value: T.consistencyBpm.fair, unit: '/min' }],
  },
  motion: {
    good: [{ prefix: '≤', value: T.motionPx.good, unit: 'px' }],
    fair: [{ prefix: '≤', value: T.motionPx.fair, unit: 'px' }],
    poor: [{ prefix: '>', value: T.motionPx.fair, unit: 'px' }],
  },
  lighting: {
    good: [{ value: lg.lo }, 'to', { value: lg.hi }, 'and', { prefix: '<', value: lg.clipBelow, unit: '%' }, 'clipped'],
    fair: [{ value: lf.lo }, 'to', { value: lf.hi }, 'and', { prefix: '<', value: lf.clipBelow, unit: '%' }, 'clipped'],
    poor: ['otherwise'],
  },
  face: {
    good: [{ prefix: '≥', value: T.facePct.good, unit: '%' }],
    fair: [{ prefix: '≥', value: T.facePct.fair, unit: '%' }],
    poor: [{ prefix: '<', value: T.facePct.fair, unit: '%' }],
  },
};
