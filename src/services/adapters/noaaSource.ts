// NOAA SWPC GOES integral protons adapter (doc 10 §1, §7; doc 05 §4.4) [SRC_NOAA_SWPC_PROTONS · verified].
// live (3-s timeout) → Dexie `spaceWeather` cache with fetchedAt → CACHED with age → bundled snapshot → SNAPSHOT.
// CORS: services.swpc.noaa.gov answers `access-control-allow-origin: *` (checked 2026-11-14), so the browser fetches
// it directly; no proxy (the app is static on GitHub Pages).
//
// Range strategy: one cache row holds the merged ≥10 / ≥100 MeV samples of the last 7 days. The first fetch (or a
// cache older than 20 h) downloads the 7-day file (~1.7 MB); later polls download the 1-day file (~0.24 MB) and merge.
// The 6 h / 1 d / 3 d / 7 d chart tabs are windows on that merged series.
//
// The bundled snapshot is loaded with a dynamic import (a JS chunk the service worker precaches), so SNAPSHOT works
// on a cold offline start; a fetch of public/seed/… would need the JSON in the precache list (see vite.config.ts).
import type { ProtonSample } from '../../domain/types';
import { mergeSamples, parseGoesProtons, type ProtonChannels } from '../../domain/radiation/protons';
import type { ArgusDB, SpaceWeatherRow } from '../db';

export const NOAA_BASE = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-';
export type NoaaRange = '6-hour' | '1-day' | '3-day' | '7-day';
export const noaaUrl = (range: NoaaRange): string => `${NOAA_BASE}${range}.json`;
export const NOAA_PRODUCT_PAGE = 'https://www.swpc.noaa.gov/products/goes-proton-flux';
export const LIVE_TIMEOUT_MS = 3000;
export const CACHE_ROW_ID = 'goes-protons';
const KEEP_MS = 7 * 24 * 3_600_000;
const FULL_REFRESH_AFTER_MS = 20 * 3_600_000;

export type FeedMode = 'LIVE' | 'CACHED' | 'SNAPSHOT';

export interface ProtonFeed extends ProtonChannels {
  mode: FeedMode;
  /** When these samples were fetched (LIVE/CACHED) or captured (SNAPSHOT), ISO UTC. */
  fetchedAt: string;
  /** Present in SNAPSHOT mode: the capture time of the bundled file. */
  capturedAt?: string;
  /** NOAA file the last live fetch used. */
  url?: string;
  /** Why live was not used (offline, timeout, HTTP status…), for the screen's detail line. */
  liveError?: string;
}

interface CacheRow extends SpaceWeatherRow {
  fetchedAt: string;
  url: string;
  protons10: ProtonSample[];
  protons100: ProtonSample[];
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** GET one NOAA file with a timeout; rejects on HTTP errors, timeouts and files without proton samples. */
export async function fetchLiveProtons(
  range: NoaaRange,
  {
    fetchFn = globalThis.fetch.bind(globalThis),
    timeoutMs = LIVE_TIMEOUT_MS,
  }: { fetchFn?: FetchFn; timeoutMs?: number } = {},
): Promise<ProtonChannels & { url: string }> {
  const url = noaaUrl(range);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseGoesProtons(await res.json());
    if (parsed.protons10.length === 0) throw new Error('no >=10 MeV samples in the NOAA file');
    return { ...parsed, url };
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`timeout after ${timeoutMs / 1000} s`, { cause: e });
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
}

export async function readCachedProtons(database: ArgusDB): Promise<CacheRow | undefined> {
  const row = (await database.spaceWeather.get(CACHE_ROW_ID)) as CacheRow | undefined;
  if (
    !row ||
    !Array.isArray(row.protons10) ||
    !Array.isArray(row.protons100) ||
    typeof row.fetchedAt !== 'string'
  )
    return undefined;
  return row;
}

async function writeCache(
  database: ArgusDB,
  ch: ProtonChannels,
  fetchedAt: string,
  url: string,
): Promise<void> {
  const last = ch.protons10[ch.protons10.length - 1]?.timeTag ?? fetchedAt;
  const row: CacheRow = { id: CACHE_ROW_ID, kind: 'goes-protons', timeTag: last, fetchedAt, url, ...ch };
  await database.spaceWeather.put(row);
}

export interface Snapshot extends ProtonChannels {
  capturedAt: string;
}

let snapshotPromise: Promise<Snapshot> | null = null;
/** The bundled seed/radiation/goes-snapshot.json (captured by `npm run fetch:data`). */
export function loadSnapshotProtons(): Promise<Snapshot> {
  snapshotPromise ??= import('../../../seed/radiation/goes-snapshot.json').then((m) => {
    const json = m.default as { capturedAt: string; data: unknown };
    return { ...parseGoesProtons(json.data), capturedAt: json.capturedAt };
  });
  return snapshotPromise;
}

export interface LoadOptions {
  database: ArgusDB;
  fetchFn?: FetchFn;
  /** navigator.onLine; false skips the live attempt (never poll offline). */
  online?: boolean;
  now?: () => number;
  timeoutMs?: number;
}

/** live → cache → snapshot (doc 10 §7). Never rejects unless the bundled snapshot itself is broken. */
export async function loadProtonFeed(opts: LoadOptions): Promise<ProtonFeed> {
  const { database, fetchFn, online = true, now = Date.now, timeoutMs } = opts;
  let cached: CacheRow | undefined;
  try {
    cached = await readCachedProtons(database);
  } catch {
    cached = undefined;
  }
  let liveError: string | undefined = online ? undefined : 'offline';
  if (online) {
    const fresh = !!cached && now() - Date.parse(cached.fetchedAt) < FULL_REFRESH_AFTER_MS;
    const range: NoaaRange = fresh ? '1-day' : '7-day';
    try {
      const live = await fetchLiveProtons(range, { fetchFn, timeoutMs });
      const lastTag = live.protons10[live.protons10.length - 1]?.timeTag ?? new Date(now()).toISOString();
      const since = new Date(Date.parse(lastTag) - KEEP_MS).toISOString();
      const merged: ProtonChannels = {
        protons10: mergeSamples(fresh && cached ? cached.protons10 : [], live.protons10, since),
        protons100: mergeSamples(fresh && cached ? cached.protons100 : [], live.protons100, since),
      };
      const fetchedAt = new Date(now()).toISOString();
      try {
        await writeCache(database, merged, fetchedAt, live.url);
      } catch {
        // a full or blocked IndexedDB must not hide live data
      }
      return { mode: 'LIVE', fetchedAt, url: live.url, ...merged };
    } catch (e) {
      liveError = e instanceof Error ? e.message : String(e);
    }
  }
  if (cached) {
    const out: ProtonFeed = {
      mode: 'CACHED',
      fetchedAt: cached.fetchedAt,
      url: cached.url,
      protons10: cached.protons10,
      protons100: cached.protons100,
    };
    if (liveError) out.liveError = liveError;
    return out;
  }
  const snap = await loadSnapshotProtons();
  const out: ProtonFeed = {
    mode: 'SNAPSHOT',
    fetchedAt: snap.capturedAt,
    capturedAt: snap.capturedAt,
    protons10: snap.protons10,
    protons100: snap.protons100,
  };
  if (liveError) out.liveError = liveError;
  return out;
}

/** Minutes between `iso` and now (never negative). */
export function ageMinutes(iso: string, now = Date.now()): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60_000) : 0;
}
