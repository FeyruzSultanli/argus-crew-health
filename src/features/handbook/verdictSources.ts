import type { Assessment } from '../../domain/types';

/** Unique source ids of the three layers (personal, space, earth). */
export function assessmentSourceIds(a: Assessment): string[] {
  return [
    ...new Set([...a.layers.personal.sourceIds, ...a.layers.space.sourceIds, ...a.layers.earth.sourceIds]),
  ];
}
