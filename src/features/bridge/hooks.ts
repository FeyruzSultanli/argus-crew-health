// Bridge-only live queries (doc 05 §4.1: feature hooks wrap useLiveQuery over the health service).
import { useLiveQuery } from 'dexie-react-hooks';

import type { Observation } from '../../domain/types';
import { healthService } from '../../services/healthService';

/**
 * Full observation history of each crew member, oldest first (streaks, weekly points and badges are computed from
 * it). The query does not depend on the mission day, so scrubbing does not re-query; it re-runs after writes.
 */
export function useCrewHistories(crewIds: readonly string[]): Record<string, Observation[]> | undefined {
  const key = crewIds.join(',');
  return useLiveQuery(async () => {
    const ids = key ? key.split(',') : [];
    const lists = await Promise.all(ids.map((crewId) => healthService.observations({ crewId })));
    return Object.fromEntries(ids.map((id, i) => [id, lists[i] ?? []]));
  }, [key]);
}
