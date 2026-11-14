import 'fake-indexeddb/auto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ArgusDB } from '../../services/db';
import { listCrew, resetDemo } from '../../services/demo';
import { assessAll } from '../../services/healthService';
import { sendPacket, advanceEarthLink, listDeliveredPackets } from '../../services/packets';
import { crewRow, lastMeasurement, receivedRows, sortCrewRows } from './crewOverview';

const NOW = Date.parse('2026-11-14T16:00:00Z');
const database = new ArgusDB('argus-crew-overview-test');

beforeAll(async () => {
  await resetDemo('mars-transit', { database, now: new Date(NOW) });
}, 30_000);
afterAll(async () => {
  database.close();
  await database.delete();
});

describe('crew overview rows on Mars transit day 143', () => {
  it('K. Osei first with Act; caught-only counted; last measurement is the newest reading', async () => {
    const crew = await listCrew(database);
    const all = await assessAll(143, database);
    const rows = sortCrewRows(crew.map((m) => crewRow(m, all[m.id] ?? [])));
    expect(rows[0]?.member.displayName).toBe('K. Osei');
    expect(rows[0]?.verdict).toBe('ACT');
    expect(rows[0]?.flags.caughtOnlyByPersonal).toBe(2);
    expect(rows[0]?.flags.personal).toBe(2);
    const last = lastMeasurement(all.c3 ?? []);
    expect(last?.missionDay).toBe(143);
    expect(last?.value).not.toBeNull();
  });

  it('surgeon rows come only from delivered packets', async () => {
    await sendPacket({ crewIds: ['c3', 'c2'], fromDay: 137, toDay: 143, flagsOnly: true }, { database, now: () => NOW, compression: 60 });
    expect(receivedRows(await listDeliveredPackets(database))).toEqual([]);
    await advanceEarthLink(NOW + 11_000, database);
    const rows = receivedRows(await listDeliveredPackets(database));
    expect(rows.map((r) => [r.name, r.verdict])).toEqual([
      ['K. Osei', 'ACT'],
      ['M. Ito', 'WATCH'],
    ]);
    expect(rows[0]?.byLayer.personal).toBe(2);
  });
});
