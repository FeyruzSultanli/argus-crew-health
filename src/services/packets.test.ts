import 'fake-indexeddb/auto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BUNDLE_SCHEMA, CSV_COLUMNS, LOINC_SYSTEM, observationsToCsv, parseCsv, validateShape } from '../domain/fhir';
import type { FhirObservation } from '../domain/fhir';
import { ArgusDB } from './db';
import { resetDemo } from './demo';
import { createHealthService } from './healthService';
import {
  advanceEarthLink,
  arrivalText,
  composePacket,
  demoWaitMs,
  listDeliveredPackets,
  listPackets,
  listReplies,
  sendPacket,
  sendReply,
  statusAt,
} from './packets';

const NAME = 'argus-packets-test';
const NOW = Date.parse('2026-11-14T16:00:00Z');
let database = new ArgusDB(NAME);

beforeAll(async () => {
  await resetDemo('mars-transit', { database, now: new Date(NOW) });
}, 30_000);
afterAll(async () => {
  database.close();
  await database.delete();
});

const obsOf = (b: { entry: Array<{ resource: { resourceType: string } }> }) =>
  b.entry.map((e) => e.resource).filter((r): r is FhirObservation => r.resourceType === 'Observation');

describe('compression maths and copy', () => {
  it('660 s at 60× → 11 s; acceptance wording for Mars transit day 143', () => {
    expect(demoWaitMs(660, 60)).toBe(11_000);
    expect(arrivalText(660, 60)).toBe('arrives in 11 min (demo: 11 s)');
    expect(arrivalText(660, 1)).toBe('arrives in 11 min (real time)');
    expect(arrivalText(1.3, 60)).toBe('arrives in 1.3 s (demo: 0 s)');
  });

  it('state machine: queued (first second) → in transit → delivered at deliverAt', () => {
    const p = { createdAt: new Date(NOW).toISOString(), deliverAt: new Date(NOW + 11_000).toISOString() };
    expect(statusAt(p, NOW)).toBe('queued');
    expect(statusAt(p, NOW + 999)).toBe('queued');
    expect(statusAt(p, NOW + 1000)).toBe('in-transit');
    expect(statusAt(p, NOW + 10_999)).toBe('in-transit');
    expect(statusAt(p, NOW + 11_000)).toBe('delivered');
  });
});

describe('composePacket on the generated mission (K. Osei, MD 137–143)', () => {
  it('flags only: heart-rate flag caught only by personal baseline in summary and bundle', async () => {
    const c = await composePacket(
      { crewIds: ['c3'], fromDay: 137, toDay: 143, flagsOnly: true },
      { database, now: () => NOW },
    );
    expect(c.summary.text).toContain('K. Osei — 2 flagged (1 Act, 1 Watch)');
    expect(c.summary.text).toContain(
      '• Resting heart rate: Act — driven by personal baseline — caught only by personal baseline.',
    );
    expect(c.summary.text).toContain('Against personal baseline: usual 58 bpm');
    expect(validateShape(JSON.parse(JSON.stringify(c.bundle)), BUNDLE_SCHEMA)).toEqual([]);
    const signals = new Set(obsOf(c.bundle).map((o) => o.code.text));
    expect(signals).toEqual(new Set(['Resting heart rate', 'Body temperature']));
    expect(c.sizeBytes).toBe(new TextEncoder().encode(JSON.stringify(c.bundle)).length);
  });

  it('all readings: round-trip of a generated crew-day (shape, codes, labels, BP components, CSV)', async () => {
    const svc = createHealthService(database);
    const c = await composePacket(
      { crewIds: ['c1', 'c2', 'c3', 'c4'], fromDay: 141, toDay: 141, flagsOnly: false },
      { database, now: () => NOW },
    );
    const source = (await Promise.all(['c1', 'c2', 'c3', 'c4'].map((id) => svc.observations({ crewId: id, fromDay: 141, toDay: 141 })))).flat();
    const parsed = JSON.parse(JSON.stringify(c.bundle)) as typeof c.bundle;
    expect(validateShape(parsed, BUNDLE_SCHEMA)).toEqual([]);
    const list = obsOf(parsed);
    expect(list).toHaveLength(source.length);
    expect(parsed.entry.filter((e) => e.resource.resourceType === 'Patient')).toHaveLength(4);
    for (const o of list) {
      expect(o.code.coding?.[0]?.code).toBeTruthy();
      expect(o.effectiveDateTime).toBeTruthy();
      expect(o.valueQuantity !== undefined || (o.component?.length ?? 0) > 0).toBe(true);
      expect(o.meta.tag?.[0]?.code).toBe('SIMULATED');
    }
    const bp = list.filter((o) => o.code.coding?.[0]?.code === '85354-9');
    expect(bp.length).toBeGreaterThan(0);
    for (const b of bp) {
      expect(b.code.coding?.[0]?.system).toBe(LOINC_SYSTEM);
      expect(b.component?.map((x) => x.code.coding?.[0]?.code)).toEqual(['8480-6', '8462-4']);
    }
    const rows = parseCsv(observationsToCsv(source));
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows.slice(1).map((r) => r[0])).toEqual(source.map((o) => o.id));
  });
});

describe('sendPacket / replies with a fake clock', () => {
  it('Mars transit day 143 at 60×: 660 s delay, delivered 11 s later, survives a reload', async () => {
    const svcPacket = await sendPacket(
      { crewIds: ['c3'], fromDay: 137, toDay: 143, flagsOnly: true, note: 'as written, "quoted"' },
      { database, now: () => NOW, compression: 60 },
    );
    expect(svcPacket.status).toBe('queued');
    expect(svcPacket.delaySec).toBe(660);
    expect(Date.parse(svcPacket.deliverAt) - Date.parse(svcPacket.createdAt)).toBe(11_000);
    expect(svcPacket.summary).toContain('Note from the crew (as written): as written, "quoted"');
    expect(svcPacket.modeledDelay).toBe(true);

    await advanceEarthLink(NOW + 2000, database);
    expect((await listPackets(database))[0]?.status).toBe('in-transit');
    expect(await listDeliveredPackets(database)).toEqual([]);

    // reload: a fresh connection to the same IndexedDB derives the state from the stored times
    database.close();
    database = new ArgusDB(NAME);
    const res = await advanceEarthLink(NOW + 11_000, database);
    expect(res.packetsDelivered).toEqual([svcPacket.id]);
    const delivered = await listDeliveredPackets(database);
    expect(delivered.map((p) => p.id)).toEqual([svcPacket.id]);
    expect(delivered[0]?.deliveredAt).toBe(svcPacket.deliverAt);
    expect((await advanceEarthLink(NOW + 20_000, database)).packetsDelivered).toEqual([]);
  });

  it('a reply travels back with the same compressed delay and is stored as written', async () => {
    const r = await sendReply(
      { body: 'Received. Please re-measure tomorrow morning.', missionDay: 143 },
      { database, now: () => NOW, compression: 60 },
    );
    expect(Date.parse(r.deliverAt) - NOW).toBe(11_000);
    expect(await listReplies(true, database)).toEqual([]);
    await advanceEarthLink(NOW + 10_000, database);
    expect(await listReplies(true, database)).toEqual([]);
    await advanceEarthLink(NOW + 11_000, database);
    const inbox = await listReplies(true, database);
    expect(inbox.map((m) => m.body)).toEqual(['Received. Please re-measure tomorrow morning.']);
  });
});

describe('exports', () => {
  it('exportFhir parses back and holds blood pressure as two components; exportCsv parses back', async () => {
    const { exportCsv, exportFhir } = await import('./packets');
    const f = await exportFhir({ crewIds: ['c3'], fromDay: 137, toDay: 143 }, { database, now: () => NOW });
    expect(f.fileName).toBe('argus-fhir-mars-transit-MD143.json');
    const parsed = JSON.parse(f.text) as { entry: Array<{ resource: FhirObservation | { resourceType: 'Patient' } }> };
    const bp = obsOf(parsed).find((o) => o.code.coding?.[0]?.code === '85354-9');
    expect(bp?.component).toHaveLength(2);
    const csv = await exportCsv({ crewIds: ['c3'], fromDay: 137, toDay: 143 }, { database });
    expect(csv.fileName).toBe('argus-observations-mars-transit-MD143.csv');
    expect(parseCsv(csv.text)).toHaveLength(csv.count + 1);
    expect(csv.count).toBe(f.count);
  });
});
