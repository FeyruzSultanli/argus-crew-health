// Display helpers for the Environment screen (text only; numbers go through <Value>).
import type { SpaceWeatherState } from '../../domain/types';
import type { DataLabel } from '../../ui';

/** Data tag for space-weather numbers: LIVE / REPLAY; CACHED and SNAPSHOT carry no tag (the mode bar says so). */
export function dataLabelOf(mode: SpaceWeatherState['mode']): DataLabel | undefined {
  if (mode === 'REPLAY') return 'REPLAY';
  if (mode === 'LIVE') return 'LIVE';
  return undefined;
}

/** "2 h 10 min", "45 min", "3 d 4 h" from a duration in ms. */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

const UTC_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});
const UTC_SHORT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** "14 Nov 2026, 13:26 UTC". */
export function formatUtc(iso: string | number): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${UTC_FMT.format(d)} UTC` : '—';
}

/** "14 Nov, 13:26" (axis / table, UTC). */
export function formatUtcShort(ms: number): string {
  return UTC_SHORT.format(new Date(ms));
}
