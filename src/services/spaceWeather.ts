// Space-weather service: one in-memory view of the proton feed (live / cached / snapshot) or the running SPE
// replay, derived S scale, ≥100 MeV alert, modeled SPE dose and shelter advisory; polling; the header badge feed;
// and the dose provider behind ctx.dose (radiation_dose).
//
// Polling (doc 10 §7): every 5 min while the Environment screen is visible, every 15 min otherwise, never while
// navigator.onLine is false. Going offline turns a LIVE view into CACHED (same samples, age from fetchedAt).
//
// Modeled SPE dose in the ledger: the dose integrated over events in the samples on screen (7-day live window or
// the replay so far). It is added to the ledger of the current mission day ("today", profile.demoMissionDay) only;
// scrubbed past days have no modeled SPE dose. Stopping a replay removes its dose (not mission history).
import { create } from 'zustand';

import { computeDoseLedger, NO_SPE, type SpeInput } from '../domain/radiation/doseLedger';
import { protons100UpTo } from '../domain/radiation/replay';
import { shelterAdvisory, type ShelterAdvisory } from '../domain/radiation/shelter';
import { speSummaryAt, speTimeline, type SpeSummary, type SpeTimeline } from '../domain/radiation/speDose';
import type { DoseLedger, MissionProfile, SpaceWeatherState } from '../domain/types';
import { useMissionStore } from '../state/mission';
import { useUiStore } from '../state/ui';
import { loadSepEvents, type DonkiFeed } from './adapters/donkiSource';
import { ageMinutes, loadProtonFeed, type FetchFn, type ProtonFeed } from './adapters/noaaSource';
import { bumpDerivedVersion, setDoseProvider } from './assessments';
import { db as defaultDb, type ArgusDB } from './db';
import { replayOnScreen, useReplayStore, type ReplayRuntime } from './replay';
import { loadSeed, profileById } from './seed';

export const POLL_VISIBLE_MS = 5 * 60_000;
export const POLL_BACKGROUND_MS = 15 * 60_000;

/** Everything the Environment screen needs beyond the SpaceWeatherState contract. */
export interface SpaceWeatherView {
  state: SpaceWeatherState;
  spe: SpeSummary;
  /** Onset of the current event (time tag), when one is active. */
  onsetTag?: string;
  /** Latest sample time on screen. */
  latestTag?: string;
  capturedAt?: string;
  url?: string;
  liveError?: string;
  replay?: {
    label: string;
    synthetic: boolean;
    speed: number;
    status: ReplayRuntime['status'];
    sourceIds: string[];
    startMs: number;
    endMs: number;
    eventMs: number;
  };
}

interface SwStore {
  feed: ProtonFeed | null;
  feedTimeline: SpeTimeline | null;
  donki: DonkiFeed | null;
  loading: boolean;
}

export const useSpaceWeatherStore = create<SwStore>()(() => ({
  feed: null,
  feedTimeline: null,
  donki: null,
  loading: false,
}));

/** The combined view (memoised on the inputs' identity). */
let memo: { feed: SwStore['feed']; replay: ReplayRuntime; view: SpaceWeatherView | undefined } | null = null;

export function deriveView(
  feed: ProtonFeed | null,
  timeline: SpeTimeline | null,
  replay: ReplayRuntime,
  now = Date.now(),
): SpaceWeatherView | undefined {
  if (replayOnScreen(replay) && replay.profile) {
    const p = replay.profile;
    const spe = speSummaryAt(p.timeline, replay.index);
    const latest = p.protons10[replay.index]?.timeTag;
    const view: SpaceWeatherView = {
      state: {
        mode: 'REPLAY',
        protons10: p.protons10.slice(0, replay.index + 1),
        protons100: protons100UpTo(p, replay.index),
        sScale: spe.sScale,
        s100Alert: spe.s100Alert,
        sepEvents: [],
      },
      spe,
      replay: {
        label: p.label,
        synthetic: p.synthetic,
        speed: replay.speed,
        status: replay.status,
        sourceIds: p.sourceIds,
        startMs: p.startMs,
        endMs: p.endMs,
        eventMs: replay.eventMs,
      },
    };
    if (spe.onsetTag) view.onsetTag = spe.onsetTag;
    if (latest) view.latestTag = latest;
    return view;
  }
  if (!feed || !timeline) return undefined;
  const spe = speSummaryAt(timeline);
  const view: SpaceWeatherView = {
    state: {
      mode: feed.mode,
      fetchedAt: feed.fetchedAt,
      ageMinutes: ageMinutes(feed.fetchedAt, now),
      protons10: feed.protons10,
      protons100: feed.protons100,
      sScale: spe.sScale,
      s100Alert: spe.s100Alert,
      sepEvents: [],
    },
    spe,
  };
  if (spe.onsetTag) view.onsetTag = spe.onsetTag;
  const latest = feed.protons10[feed.protons10.length - 1]?.timeTag;
  if (latest) view.latestTag = latest;
  if (feed.capturedAt) view.capturedAt = feed.capturedAt;
  if (feed.url) view.url = feed.url;
  if (feed.liveError) view.liveError = feed.liveError;
  return view;
}

/** Current view (undefined until the first feed load finished and no replay runs). */
export function getSpaceWeatherView(): SpaceWeatherView | undefined {
  const { feed, feedTimeline } = useSpaceWeatherStore.getState();
  const replay = useReplayStore.getState();
  if (memo && memo.feed === feed && memo.replay === replay) return memo.view;
  memo = { feed, replay, view: deriveView(feed, feedTimeline, replay) };
  return memo.view;
}

/** The modeled SPE input of the view on screen (zero when nothing is loaded). */
export function currentSpe(view = getSpaceWeatherView()): SpeInput {
  if (!view) return NO_SPE;
  return { missionSpeMsvModeled: view.spe.totalMsv, speCurrentEventMsvModeled: view.spe.currentEventMsv };
}

// ---- ledger ----

const seedCrew = loadSeed().crew;

/** Dose ledger of one crew member on a mission day under a profile (modeled SPE on "today" only). */
export function ledgerFor(
  crewId: string,
  missionDay: number,
  profile: MissionProfile,
  spe: SpeInput = currentSpe(),
): DoseLedger | undefined {
  const c = seedCrew.find((m) => m.id === crewId);
  if (!c) return undefined;
  return computeDoseLedger(c, profile, missionDay, missionDay === profile.demoMissionDay ? spe : NO_SPE);
}

export function ledgersFor(
  missionDay: number,
  profile: MissionProfile,
  spe: SpeInput = currentSpe(),
): DoseLedger[] {
  return seedCrew
    .map((c) => ledgerFor(c.id, missionDay, profile, spe))
    .filter((l): l is DoseLedger => l !== undefined)
    .sort((a, b) => a.crewId.localeCompare(b.crewId));
}

/** The provider registered with assessments.ts (ctx.dose). Uses the mission store's profile. */
export function doseProvider(crewId: string, missionDay: number): DoseLedger | undefined {
  if (crewId === 'cabin') return undefined;
  return ledgerFor(crewId, missionDay, profileById(useMissionStore.getState().profileId));
}

/** Shelter advisory of the view on screen under a profile class (null = no banner). */
export function advisoryFor(
  view: SpaceWeatherView | undefined,
  policyClass: MissionProfile['shelterPolicyClass'],
): ShelterAdvisory | null {
  if (!view) return null;
  return shelterAdvisory(policyClass, view.state.sScale, view.state.s100Alert);
}

// ---- loading, polling ----

let database: ArgusDB = defaultDb;
let fetchFn: FetchFn | undefined;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let environmentVisible = false;
let started = false;
let inflight: Promise<void> | null = null;
/** No live NOAA request until something shows space weather (a view hook mounts) or a poll is due: boot reads only
 * the cache / bundled snapshot, so screens that never show space weather (e.g. the camera flow) stay same-origin. */
let liveAttempted = false;

const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

function setFeed(feed: ProtonFeed): void {
  useSpaceWeatherStore.setState({
    feed,
    feedTimeline: speTimeline(feed.protons10, feed.protons100),
    loading: false,
  });
}

/** One live → cache → snapshot pass. Concurrent calls share the pass. */
export function refreshSpaceWeather(live = true): Promise<void> {
  if (live && started) liveAttempted = true;
  inflight ??= (async () => {
    useSpaceWeatherStore.setState({ loading: true });
    try {
      // Live NOAA only once registerRadiation({ poll: true }) ran (the app); unit tests stay on cache → snapshot.
      const opts: Parameters<typeof loadProtonFeed>[0] = { database, online: live && started && isOnline() };
      if (fetchFn) opts.fetchFn = fetchFn;
      setFeed(await loadProtonFeed(opts));
      if (!useSpaceWeatherStore.getState().donki)
        useSpaceWeatherStore.setState({ donki: await loadSepEvents() });
    } catch (e) {
      useSpaceWeatherStore.setState({ loading: false });
      console.warn('space weather: no data source answered', e);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function schedulePoll(): void {
  if (pollTimer !== null) clearTimeout(pollTimer);
  if (!started) return;
  const visible =
    environmentVisible && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
  pollTimer = setTimeout(
    () => {
      pollTimer = null;
      if (isOnline()) void refreshSpaceWeather().finally(schedulePoll);
      else schedulePoll();
    },
    visible ? POLL_VISIBLE_MS : POLL_BACKGROUND_MS,
  );
}

/** The Environment screen calls this on mount (true) / unmount (false): 5-min polling while it is visible. */
export function setEnvironmentVisible(visible: boolean): void {
  environmentVisible = visible;
  if (started) schedulePoll();
}

function onOffline(): void {
  const { feed } = useSpaceWeatherStore.getState();
  if (feed && feed.mode === 'LIVE') setFeed({ ...feed, mode: 'CACHED', liveError: 'offline' });
}
function onOnline(): void {
  void refreshSpaceWeather().finally(schedulePoll);
}

/** First load if nothing is loaded yet (used by the hooks and healthService.spaceWeather). */
export async function ensureSpaceWeather(): Promise<SpaceWeatherView | undefined> {
  if (started && !liveAttempted) {
    if (inflight) await inflight; // the boot pass (cache / snapshot) first, then the first live attempt
    await refreshSpaceWeather(true);
  } else if (!useSpaceWeatherStore.getState().feed) await refreshSpaceWeather();
  return getSpaceWeatherView();
}

/** healthService.spaceWeather(): the registered database uses the shared view; another database loads on its own. */
export async function spaceWeatherFor(db: ArgusDB): Promise<SpaceWeatherState> {
  if (db === database) {
    const view = await ensureSpaceWeather();
    if (view) return view.state;
    throw new Error('space weather: no data source answered (live, cache and bundled snapshot all failed)');
  }
  const feed = await loadProtonFeed({ database: db, online: false });
  const view = deriveView(feed, speTimeline(feed.protons10, feed.protons100), {
    ...useReplayStore.getState(),
    status: 'idle',
  });
  if (!view) throw new Error('space weather: no data');
  return view.state;
}

// ---- derived-version bumps and the header badge ----

let lastSig = '';
let bumpTimer: ReturnType<typeof setTimeout> | null = null;

function onViewChange(): void {
  const view = getSpaceWeatherView();
  if (!view) return;
  if (useUiStore.getState().spaceWeatherMode !== view.state.mode)
    useUiStore.getState().setSpaceWeatherMode(view.state.mode);
  // radiation_dose reads the ledger through the provider: refresh cached assessments when the SPE input moved.
  const sig = `${view.state.mode}|${view.state.sScale}|${view.spe.active}|${view.spe.totalMsv.toFixed(1)}|${view.spe.currentEventMsv.toFixed(1)}`;
  if (sig === lastSig) return;
  lastSig = sig;
  if (bumpTimer !== null) return;
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    void bumpDerivedVersion(database).catch(() => undefined);
  }, 400);
}

let unsubs: Array<() => void> = [];

export interface RegisterOptions {
  /** Start loading + polling (false in unit tests: no network). */
  poll?: boolean;
  fetchFn?: FetchFn;
}

/** Boot: register the dose provider (ctx.dose) and, when `poll`, start loading, polling and the badge feed. */
export async function registerRadiation(db: ArgusDB = defaultDb, opts: RegisterOptions = {}): Promise<void> {
  database = db;
  fetchFn = opts.fetchFn;
  await setDoseProvider(doseProvider, db);
  if (!opts.poll || started) return;
  started = true;
  unsubs.push(useSpaceWeatherStore.subscribe(onViewChange), useReplayStore.subscribe(onViewChange));
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', schedulePoll);
  }
  void refreshSpaceWeather(false).finally(schedulePoll);
}

/** Test helper: stop polling, drop listeners and state. */
export function resetSpaceWeatherForTests(): void {
  started = false;
  liveAttempted = false;
  if (pollTimer !== null) clearTimeout(pollTimer);
  if (bumpTimer !== null) clearTimeout(bumpTimer);
  pollTimer = null;
  bumpTimer = null;
  lastSig = '';
  memo = null;
  for (const u of unsubs) u();
  unsubs = [];
  if (typeof window !== 'undefined') {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', schedulePoll);
  }
  database = defaultDb;
  fetchFn = undefined;
  useSpaceWeatherStore.setState({ feed: null, feedTimeline: null, donki: null, loading: false });
}
