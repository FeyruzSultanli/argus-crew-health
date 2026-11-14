// Signal selection (persisted per browser) and role access for the Trends page (doc 05 §7). Pure + localStorage.
import { CABIN_SIGNAL_IDS, signalList } from '../../domain/signals';
import type { SignalDef, SignalId } from '../../domain/types';
import type { Role } from '../../state/session';

export const DEFAULT_SIGNALS: readonly SignalId[] = [
  'heart_rate_rest',
  'body_temp',
  'sleep_duration',
  'reaction_test',
  'blood_pressure',
  'spo2',
];

const STORAGE_KEY = 'argus.trends.signals';

/** Crew signals the picker offers (symptoms has no numeric trend; cabin signals are the cabin chart). */
export const PICKABLE: readonly SignalDef[] = signalList.filter(
  (s) => s.id !== 'symptoms' && !CABIN_SIGNAL_IDS.includes(s.id),
);

export const SYSTEM_LABEL: Record<SignalDef['system'], string> = {
  cardio: 'Heart and circulation',
  'neuro-eye': 'Brain and eyes',
  musculoskeletal: 'Muscle and bone',
  metabolic: 'Metabolism and blood',
  behavioral: 'Sleep, mood and performance',
  environment: 'Environment and radiation',
};

/** Picker groups in catalog order. */
export function pickerGroups(): Array<{ system: SignalDef['system']; label: string; signals: SignalDef[] }> {
  const out: Array<{ system: SignalDef['system']; label: string; signals: SignalDef[] }> = [];
  for (const s of PICKABLE) {
    let g = out.find((x) => x.system === s.system);
    if (!g) {
      g = { system: s.system, label: SYSTEM_LABEL[s.system], signals: [] };
      out.push(g);
    }
    g.signals.push(s);
  }
  return out;
}

const pickable = new Set<string>(PICKABLE.map((s) => s.id));

/** Keep known ids in catalog order, drop duplicates. */
export function normaliseSelection(ids: readonly string[]): SignalId[] {
  const set = new Set(ids.filter((id) => pickable.has(id)));
  return PICKABLE.filter((s) => set.has(s.id)).map((s) => s.id);
}

export function loadSelection(): SignalId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [...DEFAULT_SIGNALS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SIGNALS];
    return normaliseSelection(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return [...DEFAULT_SIGNALS];
  }
}

export function saveSelection(ids: readonly SignalId[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable (private mode): selection lasts for this visit only
  }
}

/** Add or remove one signal. */
export function toggleSignal(ids: readonly SignalId[], id: SignalId): SignalId[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : normaliseSelection([...ids, id]);
}

export type TrendsAccess =
  | { kind: 'signed-out' }
  | { kind: 'surgeon' }
  | { kind: 'view'; crewId: string; canPickCrew: boolean; redirectedFrom?: string };

/**
 * Who sees whose trends: crew → own only (another id in the URL falls back to self), CMO → any crew member,
 * flight surgeon → no on-board data (trends come from received packets on the Earth link).
 */
export function trendsAccess(
  role: Role | null,
  ownId: string | null,
  paramId: string | undefined,
  crewIds: readonly string[],
): TrendsAccess {
  if (role === 'surgeon') return { kind: 'surgeon' };
  if (role === null || ownId === null) return { kind: 'signed-out' };
  if (role === 'crew') {
    return paramId && paramId !== ownId
      ? { kind: 'view', crewId: ownId, canPickCrew: false, redirectedFrom: paramId }
      : { kind: 'view', crewId: ownId, canPickCrew: false };
  }
  const id = paramId && crewIds.includes(paramId) ? paramId : ownId;
  return { kind: 'view', crewId: id, canPickCrew: true };
}
