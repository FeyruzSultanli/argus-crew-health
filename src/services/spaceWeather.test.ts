import 'fake-indexeddb/auto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Assessment, SignalId } from '../domain/types';
import { useMissionStore } from '../state/mission';
import {
  CACHE_ROW_ID,
  loadProtonFeed,
  noaaUrl,
  readCachedProtons,
  type FetchFn,
} from './adapters/noaaSource';
import { loadSepEvents } from './adapters/donkiSource';
import { setDoseProvider } from './assessments';
import { ArgusDB } from './db';
import { resetDemo } from './demo';
import { createHealthService } from './healthService';
import {
  getReplayState,
  loadReplayProfile,
  setReplaySpeed,
  startReplay,
  stopReplay,
  useReplayStore,
} from './replay';
import {
  advisoryFor,
  doseProvider,
  getSpaceWeatherView,
  ledgersFor,
  registerRadiation,
  resetSpaceWeatherForTests,
  spaceWeatherFor,
} from './spaceWeather';
import { profileById } from './seed';

const NOW = Date.parse('2026-11-14T15:00:00Z');

/** A NOAA-shaped 1-day file ending at `endMs`: 5-min rows, >=10 and >=100 MeV plus a >=1 MeV channel. */
function noaaRows(endMs: number, n = 12, f10 = 0.25, f100 = 0.18) {
  const rows: unknown[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(endMs - i * 300_000).toISOString().replace('.000Z', 'Z');
    rows.push({ time_tag: t, satellite: 18, flux: f10, energy: '>=10 MeV' });
    rows.push({ time_tag: t, satellite: 18, flux: f100, energy: '>=100 MeV' });
    rows.push({ time_tag: t, satellite: 18, flux: 0.5, energy: '>=1 MeV' });
  }
  return rows;
}
const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

describe('noaaSource: live → cached → snapshot (doc 10 §7)', () => {
  const database = new ArgusDB('argus-noaa-test');
  afterAll(async () => {
    database.close();
    await database.delete();
  });

  it('fresh browser, network down → SNAPSHOT with the bundled capture date', async () => {
    const fetchFn = vi.fn<FetchFn>(() => Promise.reject(new TypeError('Failed to fetch')));
    const f = await loadProtonFeed({ database, fetchFn, now: () => NOW });
    expect(fetchFn).toHaveBeenCalledWith(noaaUrl('7-day'), expect.anything());
    expect(f.mode).toBe('SNAPSHOT');
    expect(f.capturedAt).toBe('2026-11-14T13:26:02.142Z');
    expect(f.fetchedAt).toBe(f.capturedAt);
    expect(f.protons10.length).toBeGreaterThan(1900);
    expect(f.liveError).toMatch(/Failed to fetch/);
  });

  it('live answers → LIVE, cached in Dexie with fetchedAt; only the two channels kept', async () => {
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(ok(noaaRows(NOW - 600_000))));
    const f = await loadProtonFeed({ database, fetchFn, now: () => NOW });
    expect(f.mode).toBe('LIVE');
    expect(f.fetchedAt).toBe(new Date(NOW).toISOString());
    expect(f.protons10).toHaveLength(12);
    expect(f.protons100).toHaveLength(12);
    const row = await readCachedProtons(database);
    expect(row?.id).toBe(CACHE_ROW_ID);
    expect(row?.fetchedAt).toBe(new Date(NOW).toISOString());
  });

  it('next poll uses the light 1-day file and merges with the cache', async () => {
    const later = NOW + 5 * 60_000;
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(ok(noaaRows(NOW, 3))));
    const f = await loadProtonFeed({ database, fetchFn, now: () => later });
    expect(fetchFn).toHaveBeenCalledWith(noaaUrl('1-day'), expect.anything());
    expect(f.mode).toBe('LIVE');
    expect(f.protons10).toHaveLength(14); // 12 cached (to NOW−10 min) + 2 new time tags (NOW−5 min, NOW)
  });

  it('live fails (HTTP 503 / timeout / offline) → CACHED with the age of the cached copy', async () => {
    const t = NOW + 2 * 3_600_000;
    const http = await loadProtonFeed({
      database,
      fetchFn: () => Promise.resolve(new Response('', { status: 503 })),
      now: () => t,
    });
    expect(http.mode).toBe('CACHED');
    expect(http.liveError).toBe('HTTP 503');
    expect(Date.parse(http.fetchedAt)).toBe(NOW + 5 * 60_000);
    const hang: FetchFn = (_u, init) =>
      new Promise((_r, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    const timeout = await loadProtonFeed({ database, fetchFn: hang, now: () => t, timeoutMs: 30 });
    expect(timeout.mode).toBe('CACHED');
    expect(timeout.liveError).toBe('timeout after 0.03 s');
    const never = vi.fn<FetchFn>();
    const offline = await loadProtonFeed({ database, fetchFn: never, online: false, now: () => t });
    expect(never).not.toHaveBeenCalled();
    expect(offline.mode).toBe('CACHED');
    expect(offline.liveError).toBe('offline');
  });

  it('an empty or malformed NOAA answer counts as a failure', async () => {
    const f = await loadProtonFeed({
      database,
      fetchFn: () => Promise.resolve(ok({ message: 'oops' })),
      now: () => NOW,
    });
    expect(f.mode).toBe('CACHED');
  });

  it('DONKI: honest empty record, no events invented', async () => {
    const d = await loadSepEvents();
    expect(d.status).toBe('unavailable');
    expect(d.events).toEqual([]);
  });
});

describe('dose provider → radiation_dose; environment snapshot; spaceWeather() (generated mission)', () => {
  const database = new ArgusDB('argus-space-weather-service-test');
  const svc = createHealthService(database);
  const pick = (list: Assessment[], id: SignalId): Assessment =>
    list.find((a) => a.signalId === id) as Assessment;

  beforeAll(async () => {
    useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143 });
    await resetDemo('mars-transit', { database, now: new Date(NOW) });
    await registerRadiation(database, { poll: false });
  }, 30_000);
  afterAll(async () => {
    await setDoseProvider(null, database);
    resetSpaceWeatherForTests();
    database.close();
    await database.delete();
  });

  it('Mars transit day 143 ledger: c1 498.0 / c4 558.0 projected → radiation_dose WATCH; c2, c3 NOMINAL', async () => {
    const mt = profileById('mars-transit');
    const rows = ledgersFor(143, mt, { missionSpeMsvModeled: 0, speCurrentEventMsvModeled: 0 });
    expect(rows.map((r) => [r.crewId, r.projectedEndMsv.toFixed(1), Math.round(r.pctProjected)])).toEqual([
      ['c1', '498.0', 83],
      ['c2', '438.0', 73],
      ['c3', '413.0', 69],
      ['c4', '558.0', 93],
    ]);
    const verdicts = [];
    for (const id of ['c1', 'c2', 'c3', 'c4'])
      verdicts.push(pick(await svc.assess(id, 143), 'radiation_dose').verdict);
    expect(verdicts).toEqual(['WATCH', 'NOMINAL', 'NOMINAL', 'WATCH']);
    for (const day of [1, 60, 120])
      expect(pick(await svc.assess('c4', day), 'radiation_dose').verdict).toBe('WATCH');
    expect(doseProvider('cabin', 143)).toBeUndefined();
  });

  it('day 118 cabin: last-1h 3.4 mmHg → cabin_co2 space WATCH, Earth NOMINAL; series and means', async () => {
    const env = await svc.environment(118);
    expect(env.missionDay).toBe(118);
    expect(env.co2.last1hMmHg).toBe(3.4);
    const co2 = pick(env.assessments, 'cabin_co2');
    expect(co2.layers.space.verdict).toBe('WATCH');
    expect(co2.layers.earth.verdict).toBe('NOMINAL');
    expect(env.assessments.map((a) => a.signalId)).toEqual(['cabin_co2', 'cabin_temp', 'cabin_humidity']);
    expect(env.co2.series24h).toHaveLength(288);
    const last12 = env.co2.series24h.slice(-12).reduce((s, p) => s + p.mmHg, 0) / 12;
    expect(last12).toBeCloseTo(3.4, 1);
    expect(env.co2.dailyMeans.at(-1)).toEqual({ missionDay: 118, mmHg: 3.4 });
    expect(env.co2.dailyMeans.length).toBe(30);
    expect(env.co2.avg7dMmHg).toBeGreaterThan(2);
    expect(env.tempC).toBeGreaterThanOrEqual(21);
    expect(env.humidityPct).toBeGreaterThanOrEqual(40);
  });

  it('pre-flight day: no cabin data → NaN numbers, empty series', async () => {
    const env = await svc.environment(-10);
    expect(Number.isNaN(env.co2.last1hMmHg)).toBe(true);
    expect(env.co2.series24h).toEqual([]);
  });

  it('spaceWeather() without network: SNAPSHOT, S0, no alert, no DONKI events', async () => {
    const sw = await svc.spaceWeather();
    expect(sw.mode).toBe('SNAPSHOT');
    expect(sw.sScale).toBe(0);
    expect(sw.s100Alert).toBe(false);
    expect(sw.sepEvents).toEqual([]);
    expect(sw.ageMinutes).toBeGreaterThanOrEqual(0);
    expect((await spaceWeatherFor(new ArgusDB('argus-space-weather-other'))).mode).toBe('SNAPSHOT');
  });
});

describe('replay engine (doc 10 §8)', () => {
  afterEach(() => {
    stopReplay();
    vi.useRealTimers();
  });

  it('600× default: S2 + "Shelter advised." ≈ 20 s after play; modeled dose > 0; stop restores and removes it', async () => {
    await loadReplayProfile();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    await startReplay();
    expect(getReplayState().status).toBe('playing');
    expect(getReplayState().speed).toBe(600);
    expect(useMissionStore.getState().replay).toEqual({ active: true, id: 'spe-synthetic-s2' });
    const mt = profileById('mars-transit');
    vi.advanceTimersByTime(10_000);
    expect(getSpaceWeatherView()?.state.sScale).toBe(0);
    vi.advanceTimersByTime(10_000); // t = 20 s
    const v = getSpaceWeatherView();
    expect(v?.state.mode).toBe('REPLAY');
    expect(v?.state.sScale).toBe(2);
    expect(v?.replay?.label).toBe('REPLAY — synthetic S2-class profile (demo), not a recorded event');
    expect(advisoryFor(v, mt.shelterPolicyClass)?.text).toBe('Shelter advised.');
    expect(v?.spe.currentEventMsv).toBeGreaterThan(0);
    const c4 = ledgersFor(143, mt).find((l) => l.crewId === 'c4');
    expect(c4?.missionSpeMsvModeled).toBeGreaterThan(0);
    expect(c4?.speCurrentEventMsvModeled).toBeLessThan(1);
    expect(ledgersFor(100, mt).every((l) => l.missionSpeMsvModeled === 0)).toBe(true); // past days: no replay dose
    setReplaySpeed(3600);
    vi.advanceTimersByTime(40_000); // 40 s × 3600 = 40 h > 36 h → ended
    expect(getReplayState().status).toBe('ended');
    expect(getSpaceWeatherView()?.state.mode).toBe('REPLAY');
    const peak = getSpaceWeatherView()?.spe.totalMsv ?? 0;
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThan(1);
    stopReplay();
    expect(useReplayStore.getState().status).toBe('idle');
    expect(useMissionStore.getState().replay.active).toBe(false);
    expect(ledgersFor(143, mt).every((l) => l.missionSpeMsvModeled === 0)).toBe(true);
  });
});
