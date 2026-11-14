// SPE replay engine (doc 10 §8, FR-RAD-4). Plays seed/radiation/spe-replay.json at 60× / 600× / 3600× (default
// 600×). While it plays the space-weather state is REPLAY (see spaceWeather.ts); stop returns to LIVE / CACHED /
// SNAPSHOT and removes the replay's modeled dose: a demo replay is not mission history, so it never reaches the
// stored mission SPE total. The bundled file is the SYNTHETIC S2-class profile (demo), never a recorded event.
//
// API for the demo controls and the scrubber button: startReplay(speed?), stopReplay(), setReplaySpeed(),
// getReplayState(), useReplayStore. Test hook: `?replaySpeed=<n>` in the page URL sets the default speed.
import { create } from 'zustand';

import {
  buildReplayProfile,
  DEFAULT_REPLAY_SPEED,
  eventElapsedMs,
  replayIndexAt,
  type ReplayProfile,
  type ReplaySpeed,
} from '../domain/radiation/replay';
import { useMissionStore } from '../state/mission';

export type ReplayStatus = 'idle' | 'loading' | 'playing' | 'ended';

export interface ReplayRuntime {
  status: ReplayStatus;
  speed: ReplaySpeed;
  /** Event time since the profile start (ms). */
  eventMs: number;
  /** Index into profile.protons10 of the sample on screen. */
  index: number;
  profile: ReplayProfile | null;
  error: string | null;
}

const TICK_MS = 200;

export const useReplayStore = create<ReplayRuntime>()(() => ({
  status: 'idle',
  speed: defaultReplaySpeed(),
  eventMs: 0,
  index: 0,
  profile: null,
  error: null,
}));

let profilePromise: Promise<ReplayProfile> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** performance.now() at which eventMs was `baseEventMs`. */
let baseReal = 0;
let baseEventMs = 0;

/** Loads the bundled replay file (a JS chunk, so it also works offline). */
export function loadReplayProfile(): Promise<ReplayProfile> {
  profilePromise ??= import('../../seed/radiation/spe-replay.json')
    .then((m) => buildReplayProfile(m.default))
    .catch((e: unknown) => {
      profilePromise = null;
      throw e;
    });
  return profilePromise;
}

/** `?replaySpeed=3600` (e2e / demo hook); otherwise 600×. */
export function defaultReplaySpeed(): ReplaySpeed {
  if (typeof location === 'undefined') return DEFAULT_REPLAY_SPEED;
  const n = Number(new URLSearchParams(location.search).get('replaySpeed'));
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? n : DEFAULT_REPLAY_SPEED;
}

function stopTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function tick(): void {
  const s = useReplayStore.getState();
  if (s.status !== 'playing' || !s.profile) return stopTimer();
  const eventMs = baseEventMs + eventElapsedMs(performance.now() - baseReal, s.speed);
  const total = s.profile.endMs - s.profile.startMs;
  const index = replayIndexAt(s.profile, Math.min(eventMs, total));
  if (eventMs >= total) {
    stopTimer();
    useReplayStore.setState({ status: 'ended', eventMs: total, index });
    return;
  }
  if (index !== s.index) useReplayStore.setState({ eventMs, index });
}

/** Start (or restart from the beginning) the SPE replay. */
export async function startReplay(speed: ReplaySpeed = defaultReplaySpeed()): Promise<void> {
  stopTimer();
  useReplayStore.setState({ status: 'loading', speed, error: null });
  let profile: ReplayProfile;
  try {
    profile = await loadReplayProfile();
  } catch (e) {
    useReplayStore.setState({ status: 'idle', error: e instanceof Error ? e.message : String(e) });
    return;
  }
  if (useReplayStore.getState().status !== 'loading') return; // stopped while loading
  baseReal = performance.now();
  baseEventMs = 0;
  useReplayStore.setState({ status: 'playing', profile, eventMs: 0, index: 0 });
  useMissionStore.getState().setReplay({ active: true, id: profile.id });
  timer = setInterval(tick, TICK_MS);
}

/** Stop and leave REPLAY mode; the replay's modeled dose disappears with it. */
export function stopReplay(): void {
  stopTimer();
  useReplayStore.setState({ status: 'idle', eventMs: 0, index: 0 });
  useMissionStore.getState().setReplay({ active: false, id: null });
}

/** Change speed without jumping: event time continues from where it is. */
export function setReplaySpeed(speed: ReplaySpeed): void {
  if (!(speed > 0)) return;
  const s = useReplayStore.getState();
  if (s.status === 'playing') {
    baseEventMs = baseEventMs + eventElapsedMs(performance.now() - baseReal, s.speed);
    baseReal = performance.now();
  }
  useReplayStore.setState({ speed });
}

export function getReplayState(): ReplayRuntime {
  return useReplayStore.getState();
}

/** True while the replay owns the space-weather state (playing, or ended and still on screen). */
export function replayOnScreen(
  s: Pick<ReplayRuntime, 'status' | 'profile'> = useReplayStore.getState(),
): boolean {
  return (s.status === 'playing' || s.status === 'ended') && s.profile !== null;
}
