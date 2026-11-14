// Protocol run records (FR-HELP-3). The Dexie schema has no table for them and src/services exposes no generic
// settings get/set, so they live in localStorage under `argus.protocolRuns` (newest last, capped). Per device only.
import type { ProtocolId } from '../../domain/types';

export const PROTOCOL_RUNS_KEY = 'argus.protocolRuns';
export const MAX_RUNS = 50;

export interface ProtocolRunRecord {
  protocolId: ProtocolId;
  crewId: string | null;
  missionDay: number;
  /** ISO UTC. */
  startedAt: string;
  finishedAt: string;
  /** When each step was reached, in order (a step visited twice after "Back" appears twice). */
  steps: Array<{ stepId: string; at: string }>;
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadProtocolRuns(
  store: Pick<Storage, 'getItem'> | undefined = storage(),
): ProtocolRunRecord[] {
  try {
    const raw: unknown = JSON.parse(store?.getItem(PROTOCOL_RUNS_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as ProtocolRunRecord[]) : [];
  } catch {
    return [];
  }
}

/** Appends a run; returns false when storage is unavailable (private mode). */
export function saveProtocolRun(run: ProtocolRunRecord, store: Storage | undefined = storage()): boolean {
  if (!store) return false;
  try {
    const runs = [...loadProtocolRuns(store), run].slice(-MAX_RUNS);
    store.setItem(PROTOCOL_RUNS_KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}
