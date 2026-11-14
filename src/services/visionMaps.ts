// Amsler maps in Dexie (`visionMaps`, doc 05 §6 / doc 09 §3.2): one row per eye and test, a 400-cell bitmask per
// brush kind. The observation (`amsler`, value = count) points to its map via attachments[{kind:'amsler-map'}].
// Cleared by resetDemo (services/demo.ts). The previous test of an eye is the latest amsler observation of an
// EARLIER mission day (same rule as the domain's diff, src/domain/signals/amsler.ts); its map is loaded through the
// attachment; without a map a count of 0 is an empty map and a count > 0 is "positions unknown".
import type { Observation } from '../domain/types';
import { decodeMask, type AmslerMasks, type PreviousMap } from '../measurement/vision';
import { db as defaultDb, type ArgusDB, type VisionMapRow } from './db';
import { queryObservations } from './healthService';

export type Eye = 'left' | 'right';

export interface NewVisionMap {
  crewId: string;
  eye: Eye;
  missionDay: number;
  effectiveAt?: string;
  masks: AmslerMasks;
  /** Number of distinct marked cells. */
  count: number;
  label: 'MEASURED' | 'SIMULATED';
}

export interface VisionMapRecord extends VisionMapRow, NewVisionMap {
  effectiveAt: string;
}

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `vm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveVisionMap(m: NewVisionMap, database: ArgusDB = defaultDb): Promise<VisionMapRecord> {
  const row: VisionMapRecord = { ...m, id: newId(), effectiveAt: m.effectiveAt ?? new Date().toISOString() };
  await database.visionMaps.add(row);
  return row;
}

export async function deleteVisionMap(id: string, database: ArgusDB = defaultDb): Promise<void> {
  await database.visionMaps.delete(id);
}

export async function getVisionMap(id: string, database: ArgusDB = defaultDb): Promise<VisionMapRecord | undefined> {
  return (await database.visionMaps.get(id)) as VisionMapRecord | undefined;
}

/** Latest stored map of a crew member's eye from a mission day before `beforeDay`. */
export async function latestVisionMapBefore(
  crewId: string,
  eye: Eye,
  beforeDay: number,
  database: ArgusDB = defaultDb,
): Promise<VisionMapRecord | undefined> {
  const rows = (await database.visionMaps
    .where('[crewId+eye+missionDay]')
    .between([crewId, eye, -Infinity], [crewId, eye, beforeDay], true, false)
    .toArray()) as VisionMapRecord[];
  return rows.sort((a, b) => a.missionDay - b.missionDay || a.effectiveAt.localeCompare(b.effectiveAt)).at(-1);
}

const mapRef = (o: Observation): string | undefined => o.attachments?.find((a) => a.kind === 'amsler-map')?.ref;

/** Marked cells of a stored map (all kinds), ascending. */
export function markedCellsOf(m: Pick<VisionMapRecord, 'masks'>): number[] {
  return [...new Set([...decodeMask(m.masks.wavy), ...decodeMask(m.masks.blurred), ...decodeMask(m.masks.missing)])].sort((a, b) => a - b);
}

/** What is known about the previous Amsler test of this eye before `missionDay` (see header). */
export async function previousAmslerMap(
  crewId: string,
  eye: Eye,
  missionDay: number,
  database: ArgusDB = defaultDb,
): Promise<PreviousMap> {
  const obs = await queryObservations(database, { crewId, signalId: 'amsler', toDay: missionDay - 1 });
  const prev = obs.filter((o) => o.context?.eye === eye && o.missionDay < missionDay && typeof o.value === 'number').at(-1);
  if (!prev) return { kind: 'none' };
  const ref = mapRef(prev);
  const map = ref ? await getVisionMap(ref, database) : undefined;
  if (map) return { kind: 'map', missionDay: prev.missionDay, marked: markedCellsOf(map) };
  const count = prev.value as number;
  if (count === 0) return { kind: 'empty', missionDay: prev.missionDay };
  const central = prev.components?.centralCells;
  return { kind: 'count-only', missionDay: prev.missionDay, count, centralCount: typeof central === 'number' ? central : null };
}
