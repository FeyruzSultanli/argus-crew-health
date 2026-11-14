import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import type { NewObservation } from '../domain/types';
import { cellIndex, cellsToMasks, emptyCells, paintCell } from '../measurement/vision';
import { ArgusDB } from './db';
import { resetDemo } from './demo';
import { createHealthService } from './healthService';
import { latestVisionMapBefore, markedCellsOf, previousAmslerMap, saveVisionMap } from './visionMaps';

let n = 0;
const open: ArgusDB[] = [];
const freshDb = (): ArgusDB => {
  const d = new ArgusDB(`argus-vision-test-${++n}`);
  open.push(d);
  return d;
};
afterEach(async () => {
  for (const d of open.splice(0)) {
    d.close();
    await d.delete();
  }
});

const twoCells = cellsToMasks(paintCell(paintCell(emptyCells(), cellIndex(0, 0), 'wavy'), cellIndex(10, 10), 'missing'));

const amslerObs = (eye: 'left' | 'right', day: number, value: number, extra: Partial<NewObservation> = {}): NewObservation => ({
  crewId: 'c1',
  signalId: 'amsler',
  value,
  unit: '{areas}',
  missionDay: day,
  context: { eye },
  source: { kind: 'manual', method: 'Amsler grid (on-screen)', label: 'MEASURED' },
  quality: { score: 1, label: 'good', reasons: [] },
  ...extra,
});

describe('visionMaps service', () => {
  it('saves a map and reads it back as the latest before a day', async () => {
    const db = freshDb();
    const saved = await saveVisionMap({ crewId: 'c1', eye: 'right', missionDay: 30, masks: twoCells, count: 2, label: 'MEASURED' }, db);
    expect(saved.id).toBeTruthy();
    expect(await latestVisionMapBefore('c1', 'right', 31, db)).toEqual(saved);
    expect(await latestVisionMapBefore('c1', 'right', 30, db)).toBeUndefined();
    expect(await latestVisionMapBefore('c1', 'left', 31, db)).toBeUndefined();
    expect(markedCellsOf(saved)).toEqual([cellIndex(0, 0), cellIndex(10, 10)]);
  });

  it('previous map: none → stored map via the attachment → count-only without a map', async () => {
    const db = freshDb();
    const svc = createHealthService(db);
    expect(await previousAmslerMap('c1', 'right', 60, db)).toEqual({ kind: 'none' });
    const map = await saveVisionMap({ crewId: 'c1', eye: 'right', missionDay: 30, masks: twoCells, count: 2, label: 'MEASURED' }, db);
    await svc.addObservation(amslerObs('right', 30, 2, { attachments: [{ kind: 'amsler-map', ref: map.id }], components: { newCells: 2, newCentralCells: 1 } }));
    expect(await previousAmslerMap('c1', 'right', 60, db)).toEqual({ kind: 'map', missionDay: 30, marked: [0, cellIndex(10, 10)] });
    // a same-day test is not "previous" (the domain diffs against earlier days)
    expect(await previousAmslerMap('c1', 'right', 30, db)).toEqual({ kind: 'none' });
    await svc.addObservation(amslerObs('right', 40, 3, { components: { centralCells: 0, peripheralCells: 3 } }));
    expect(await previousAmslerMap('c1', 'right', 60, db)).toEqual({ kind: 'count-only', missionDay: 40, count: 3, centralCount: 0 });
    await svc.addObservation(amslerObs('left', 40, 0));
    expect(await previousAmslerMap('c1', 'left', 60, db)).toEqual({ kind: 'empty', missionDay: 40 });
  });

  it('on the seeded demo record: c1 right eye has 2 cells at day 90 (count only), other eyes start empty', async () => {
    const db = freshDb();
    await resetDemo(undefined, { database: db, now: new Date('2026-11-14T12:00:00Z') });
    const right = await previousAmslerMap('c1', 'right', 100, db);
    expect(right).toEqual({ kind: 'count-only', missionDay: 90, count: 2, centralCount: 0 });
    const c3 = await previousAmslerMap('c3', 'left', 143, db);
    expect(c3.kind).toBe('empty');
  });

  it('resetDemo clears the table', async () => {
    const db = freshDb();
    await saveVisionMap({ crewId: 'c1', eye: 'left', missionDay: 5, masks: twoCells, count: 2, label: 'MEASURED' }, db);
    await resetDemo(undefined, { database: db, now: new Date('2026-11-14T12:00:00Z') });
    expect(await db.visionMaps.count()).toBe(0);
  });
});
