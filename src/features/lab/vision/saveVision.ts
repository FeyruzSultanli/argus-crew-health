// Save the vision readings: per eye a visionMaps row (Amsler) and one observation through the health service.
import type { NewObservation } from '../../../domain/types';
import { cellsToMasks } from '../../../measurement/vision';
import { deleteVisionMap, saveVisionMap } from '../../../services/visionMaps';
import { saveObservation } from '../saveWithToast';
import type { AmslerEyeResult } from './AmslerResult';
import { buildAmslerObservation, type DistanceMethod } from './observations';

export interface SaveCtx {
  crewId: string;
  missionDay: number;
  distance: DistanceMethod;
  testMode: boolean;
}

/** Saves map + observation per eye; returns the observation ids. A failed observation removes its map again. */
export async function saveAmslerResults(results: readonly AmslerEyeResult[], ctx: SaveCtx): Promise<string[]> {
  const ids: string[] = [];
  for (const r of results) {
    const map = await saveVisionMap({
      crewId: ctx.crewId,
      eye: r.eye,
      missionDay: ctx.missionDay,
      masks: cellsToMasks(r.cells),
      count: r.diff.count,
      label: ctx.testMode ? 'SIMULATED' : 'MEASURED',
    });
    try {
      const obs = await saveObservation(buildAmslerObservation({ ...ctx, eye: r.eye, diff: r.diff, mapId: map.id }));
      ids.push(obs.id);
    } catch (e) {
      await deleteVisionMap(map.id);
      throw e;
    }
  }
  return ids;
}

export async function saveObservations(list: readonly NewObservation[]): Promise<string[]> {
  const ids: string[] = [];
  for (const o of list) ids.push((await saveObservation(o)).id);
  return ids;
}
