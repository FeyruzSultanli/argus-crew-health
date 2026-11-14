// Composer defaults and the /earth query string (pure). Other screens prefill the composer with
//   /earth?crew=c3&flags=1            (crew = comma-separated ids, flags = 1 flagged only / 0 all readings)
//   /earth?crew=c1,c3&flags=0&from=130&to=143   (optional mission-day period; default the last 7 days)
import type { PacketRequest } from '../../domain/types';
import type { Role } from '../../state/session';

export interface ComposerState {
  crewIds: string[];
  fromDay: number;
  toDay: number;
  flagsOnly: boolean;
  note: string;
}

export const MIN_DAY = -180;
/** Default period: the last 7 mission days up to the selected day. */
export const DEFAULT_PERIOD_DAYS = 7;

/** Mission day `n` days before `day`, skipping day 0. */
export function daysBefore(day: number, n: number): number {
  let d = day;
  for (let i = 0; i < n; i++) {
    d -= 1;
    if (d === 0) d = -1;
  }
  return Math.max(MIN_DAY, d);
}

function clampDay(raw: string | null, fallback: number, max: number): number {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isInteger(n)) return fallback;
  const c = Math.min(max, Math.max(MIN_DAY, n));
  return c === 0 ? 1 : c;
}

export interface DefaultsInput {
  role: Role | null;
  ownCrewId: string | null;
  missionDay: number;
  allCrewIds: readonly string[];
  search?: URLSearchParams;
}

/** Initial composer state: crew member = self only; CMO = query crew or everyone; period = last 7 days. */
export function defaultComposer({ role, ownCrewId, missionDay, allCrewIds, search }: DefaultsInput): ComposerState {
  const q = search ?? new URLSearchParams();
  const wanted = (q.get('crew') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => allCrewIds.includes(id));
  const crewIds =
    role === 'crew' ? (ownCrewId ? [ownCrewId] : []) : wanted.length ? [...new Set(wanted)] : [...allCrewIds];
  const toDay = clampDay(q.get('to'), missionDay, missionDay);
  const fromDay = Math.min(toDay, clampDay(q.get('from'), daysBefore(toDay, DEFAULT_PERIOD_DAYS - 1), toDay));
  const flags = q.get('flags');
  return { crewIds, fromDay, toDay, flagsOnly: flags === null ? true : flags !== '0', note: '' };
}

/** The request sent to HealthService.sendPacket (note kept as written; empty note omitted). */
export function toRequest(s: ComposerState): PacketRequest {
  const req: PacketRequest = { crewIds: [...s.crewIds], fromDay: s.fromDay, toDay: s.toDay, flagsOnly: s.flagsOnly };
  if (s.note.trim()) req.note = s.note;
  return req;
}

/** Problems that block sending (shown next to the Send button). */
export function composerProblems(s: ComposerState, missionDay: number): string[] {
  const out: string[] = [];
  if (s.crewIds.length === 0) out.push('Choose at least one crew member.');
  if (s.fromDay > s.toDay) out.push('The period starts after it ends.');
  if (s.toDay > missionDay) out.push('The period cannot end after the current mission day.');
  if (s.fromDay < MIN_DAY) out.push('The period cannot start before L-180.');
  return out;
}

/** Link that opens the composer prefilled (for ActionCards "Send to flight surgeon"). */
export function earthLinkHref(crewIds: readonly string[], flagsOnly = true): string {
  const q = new URLSearchParams();
  if (crewIds.length) q.set('crew', crewIds.join(','));
  q.set('flags', flagsOnly ? '1' : '0');
  return `/earth?${q.toString().replace(/%2C/g, ',')}`;
}
