// Freshness label for a stored reading (doc 06 §1 note): "today"-style hours/minutes when it is from the current
// mission day, otherwise whole days ("1 d", "9 d").
import type { Observation } from '../../domain/types';
import { formatAge } from '../../ui/units';

export function freshnessOf(o: Pick<Observation, 'missionDay' | 'effectiveAt'>, missionDay: number, nowMs = Date.now()): string {
  // No mission day 0: day −1 → day 1 is one day.
  const days = o.missionDay < 0 && missionDay > 0 ? missionDay - o.missionDay - 1 : missionDay - o.missionDay;
  if (days > 0) return `${days} d`;
  const t = Date.parse(o.effectiveAt);
  return Number.isNaN(t) ? 'now' : formatAge(Math.max(0, (nowMs - t) / 60000));
}
