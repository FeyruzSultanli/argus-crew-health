// Shared live hooks (doc 05 §4.1). Every hook returns undefined while loading and re-renders after writes: the
// service reads the `data.version` settings row first, so useLiveQuery re-runs whenever any write bumps it.
// Names and signatures are a contract for the UI.
import type { PreviousMap } from '../measurement/vision';
import { previousAmslerMap, type Eye as VisionEye } from './visionMaps';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';

import type {
  Assessment,
  CrewMember,
  DoseLedger,
  EnvironmentSnapshot,
  MissionProfileId,
  ObsQuery,
  Observation,
  PersonalResult,
  SignalId,
  SpaceWeatherState,
  Task,
} from '../domain/types';
import type { ShelterAdvisory } from '../domain/radiation/shelter';
import { useMissionStore } from '../state/mission';
import type { FlagDensityDay } from '../state/ui';
import type { PersonalTrack } from './assessments';
import { getCurrentMissionDay, getMissionEpoch, getMissionProfileId, listCrew } from './demo';
import {
  assessAll,
  dataVersionToken,
  flagDensity,
  healthService,
  personalSeries,
  personalTracks,
} from './healthService';
import { profileById } from './seed';
import { useReplayStore, type ReplayRuntime } from './replay';
import {
  advisoryFor,
  currentSpe,
  ensureSpaceWeather,
  getSpaceWeatherView,
  ledgersFor,
  useSpaceWeatherStore,
  type SpaceWeatherView,
} from './spaceWeather';

/** Observations matching the query, oldest first. */
export function useObservations(q: ObsQuery): Observation[] | undefined {
  const { crewId, signalId, fromDay, toDay } = q;
  return useLiveQuery(
    () => healthService.observations({ crewId, signalId, fromDay, toDay }),
    [crewId, signalId, fromDay, toDay],
  );
}

/** The four crew members (from Dexie, seeded with seed/crew.json). */
export function useCrew(): CrewMember[] | undefined {
  return useLiveQuery(() => listCrew(), []);
}

export interface MissionClockState {
  profileId: MissionProfileId;
  missionEpoch: string;
  currentDay: number;
}

/** Stored mission profile, epoch and current mission day (Dexie `settings`). */
export function useMissionClock(): MissionClockState | undefined {
  return useLiveQuery(async () => {
    const profileId = await getMissionProfileId();
    const missionEpoch = await getMissionEpoch();
    const currentDay = await getCurrentMissionDay();
    return { profileId, missionEpoch, currentDay };
  }, []);
}

/** One Assessment per registered signal of the subject (c1…c4, or 'cabin' for the cabin signals) on that day. */
export function useAssessments(crewId: string | 'cabin', missionDay: number): Assessment[] | undefined {
  return useLiveQuery(() => healthService.assess(crewId, missionDay), [crewId, missionDay]);
}

/** Assessments of c1…c4 and 'cabin' on that day, keyed by crew id. */
export function useAllAssessments(missionDay: number): Record<string, Assessment[]> | undefined {
  return useLiveQuery(() => assessAll(missionDay), [missionDay]);
}

/** Personal-baseline chart series (band lo/hi, state) up to `upToDay`; worse track per day for multi-series signals. */
export function usePersonalSeries(
  crewId: string,
  signalId: SignalId,
  upToDay: number,
): PersonalResult['series'] | undefined {
  return useLiveQuery(() => personalSeries(crewId, signalId, upToDay), [crewId, signalId, upToDay]);
}

/** Per-track series (blood pressure systolic/diastolic, near acuity per eye, …) up to `upToDay`. */
export function usePersonalTracks(crewId: string, signalId: SignalId, upToDay: number): PersonalTrack[] | undefined {
  return useLiveQuery(() => personalTracks(crewId, signalId, upToDay), [crewId, signalId, upToDay]);
}

/** Today plan of one crew member (tasks from cadence/staleness, vision schedule, persisted skips). */
export function useTodayPlan(crewId: string, missionDay: number): Task[] | undefined {
  return useLiveQuery(() => healthService.todayPlan(crewId, missionDay), [crewId, missionDay]);
}

const idle = (fn: () => void): (() => void) => {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 50);
  return () => clearTimeout(id);
};

/**
 * Scrubber flag density per mission day (−180 … demo day): count of crew signals (c1–c4, not cabin) whose combined
 * verdict is WATCH / ACT. Computed after first paint in time-sliced chunks; recomputed incrementally after writes.
 */
export function useFlagDensity(): FlagDensityDay[] | undefined {
  const token = useLiveQuery(() => dataVersionToken(), []);
  const [state, setState] = useState<{ token: string; days: FlagDensityDay[] } | undefined>(undefined);
  useEffect(() => {
    if (token === undefined) return;
    const ctrl = new AbortController();
    const cancelIdle = idle(() => {
      flagDensity(ctrl.signal)
        .then((days) => {
          if (!ctrl.signal.aborted) setState({ token, days });
        })
        .catch((err: unknown) => {
          if (!(err instanceof DOMException && err.name === 'AbortError')) console.error('flag density failed', err);
        });
    });
    return () => {
      cancelIdle();
      ctrl.abort();
    };
  }, [token]);
  return state?.days;
}

// ---- Space weather, dose ledger, shelter advisory, cabin environment ----

/** Full space-weather view (state + modeled SPE summary + replay info + capture/fetch details); loads on first use. */
export function useSpaceWeatherView(): SpaceWeatherView | undefined {
  const feed = useSpaceWeatherStore((s) => s.feed);
  const replay = useReplayStore();
  useEffect(() => {
    void ensureSpaceWeather();
  }, []);
  // getSpaceWeatherView memoises on (feed, replay) identity; the deps keep React in step with both stores.
  return useMemo(() => getSpaceWeatherView(), [feed, replay]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** SpaceWeatherState (LIVE / CACHED / SNAPSHOT / REPLAY) for the Bridge tile and the Environment screen. */
export function useSpaceWeather(): SpaceWeatherState | undefined {
  return useSpaceWeatherView()?.state;
}

/** Dose ledger of c1…c4 on a mission day under the current profile (modeled SPE of the view on "today" only). */
export function useDoseLedgers(missionDay: number): DoseLedger[] | undefined {
  const view = useSpaceWeatherView();
  const profileId = useMissionStore((s) => s.profileId);
  return useMemo(() => ledgersFor(missionDay, profileById(profileId), currentSpe(view)), [missionDay, profileId, view]);
}

/** Shelter advisory banner for the current profile (null: nothing to show; undefined: loading). Not a crew verdict. */
export function useShelterAdvisory(): ShelterAdvisory | null | undefined {
  const view = useSpaceWeatherView();
  const profileId = useMissionStore((s) => s.profileId);
  return useMemo(
    () => (view ? advisoryFor(view, profileById(profileId).shelterPolicyClass) : undefined),
    [view, profileId],
  );
}

/** Cabin snapshot of a mission day (CO₂ 1-h / 7-day / series, temperature, humidity, the three cabin assessments). */
export function useEnvironment(missionDay: number): EnvironmentSnapshot | undefined {
  return useLiveQuery(() => healthService.environment(missionDay), [missionDay]);
}

/** SPE replay runtime (status, speed, event time) for replay controls. */
export function useReplay(): ReplayRuntime {
  return useReplayStore();
}

// --- Earth link
// Imports kept here, next to the hooks that use them.
import {
  acquireEarthLinkClock as acquireEarthLinkClockImpl,
  getEarthLinkSink,
  type EarthLinkEvent,
} from './adapters/earthLinkSink';
import {
  listDeliveredPackets,
  listPackets,
  listReplies,
  type PacketRow,
  type ReplyRow,
} from './packets';

/** Every packet this tab's crew sent, newest first (status as stored; see useEarthLinkClock). */
export function usePackets(): PacketRow[] | undefined {
  return useLiveQuery(() => listPackets(), []);
}

/** Packets Earth has received (stored status 'delivered'), newest first — the flight surgeon's only data. */
export function useDeliveredPackets(): PacketRow[] | undefined {
  return useLiveQuery(() => listDeliveredPackets(), []);
}

/** Replies from Earth that have arrived on board, newest first. */
export function useInbox(): ReplyRow[] | undefined {
  return useLiveQuery(() => listReplies(true), []);
}

/** Every reply the flight surgeon sent (in transit or delivered), newest first. */
export function useSentReplies(): ReplyRow[] | undefined {
  return useLiveQuery(() => listReplies(false), []);
}

/**
 * Runs the tab's Earth-link clock while mounted (queued → in transit → delivered written to Dexie) and calls
 * `onEvent` for deliveries seen in this tab or announced by another tab (BroadcastChannel 'argus-earth-link').
 */
export function useEarthLinkClock(onEvent?: (e: EarthLinkEvent) => void): void {
  useEffect(() => acquireEarthLinkClockImpl(), []);
  useEffect(() => {
    if (!onEvent) return;
    return getEarthLinkSink().subscribe(onEvent);
  }, [onEvent]);
}

// --- Vision

/** What is known about the previous Amsler test of a crew member's eye before `missionDay` (services/visionMaps). */
export function usePreviousAmslerMap(crewId: string, eye: VisionEye, missionDay: number): PreviousMap | undefined {
  return useLiveQuery(() => previousAmslerMap(crewId, eye, missionDay), [crewId, eye, missionDay]);
}
