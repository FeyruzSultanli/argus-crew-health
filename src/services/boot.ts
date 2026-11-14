// App boot and the bridge between the zustand mission store (UI source of truth) and the Dexie settings
// (mission.currentDay / mission.profileId) that the data service reads. Mounted once by <DataBoot>.
import type { MissionProfileId } from '../domain/types';
import { useMissionStore } from '../state/mission';
import { db as defaultDb, type ArgusDB } from './db';
import { getMissionProfileId, resetDemo, seedIfEmpty, setCurrentMissionDay, type SeedReport } from './demo';
import { profileById } from './seed';
import { registerRadiation } from './spaceWeather';

export interface BootResult {
  seeded: SeedReport | null;
  profileId: MissionProfileId;
  missionDay: number;
  ms: number;
}

let booting: Promise<BootResult> | null = null;
let unsubscribe: (() => void) | null = null;
/** Profile whose timeline Dexie holds; lets the store subscription skip changes made by resetDemoAndStores. */
let syncedProfile: MissionProfileId | null = null;
let profileSwitch: Promise<unknown> = Promise.resolve();

const clampDay = (day: number, profileId: MissionProfileId): number => {
  const demo = profileById(profileId).demoMissionDay;
  if (!Number.isInteger(day)) return demo;
  if (day === 0) return 1;
  return Math.min(demo, Math.max(-180, day));
};

async function writeDay(day: number, profileId: MissionProfileId, database: ArgusDB): Promise<void> {
  await setCurrentMissionDay(clampDay(day, profileId), database);
}

function subscribeStore(database: ArgusDB): void {
  unsubscribe?.();
  unsubscribe = useMissionStore.subscribe((s, prev) => {
    if (s.profileId !== prev.profileId && s.profileId !== syncedProfile) {
      // doc 05 §6: switching profile re-seeds the same crew timeline truncated at that profile's demo day.
      const id = s.profileId;
      syncedProfile = id;
      profileSwitch = profileSwitch
        .then(() => resetDemo(id, { database }))
        .then(() => writeDay(useMissionStore.getState().missionDay, id, database))
        .catch((err: unknown) => console.error('profile switch failed', err));
      return;
    }
    if (s.missionDay !== prev.missionDay) {
      const day = s.missionDay;
      const id = s.profileId;
      profileSwitch = profileSwitch
        .then(() => writeDay(day, id, database))
        .catch((err: unknown) => console.error('mission day sync failed', err));
    }
  });
}

/**
 * Once per page: seed on first run (Mars transit day 143 on a fresh browser), make Dexie hold the store's profile,
 * write the store's mission day to Dexie and keep both in sync afterwards. Safe to call repeatedly.
 */
export function bootData(database: ArgusDB = defaultDb): Promise<BootResult> {
  if (booting) return booting;
  booting = (async () => {
    const t0 = performance.now();
    const { profileId } = useMissionStore.getState();
    const seeded = await seedIfEmpty(profileId, { database });
    if ((await getMissionProfileId(database)) !== profileId) await resetDemo(profileId, { database });
    syncedProfile = profileId;
    const missionDay = useMissionStore.getState().missionDay;
    await writeDay(missionDay, profileId, database);
    subscribeStore(database);
    // Radiation: dose ledger → ctx.dose, space-weather loading + polling + header badge (no network in unit tests).
    await registerRadiation(database, { poll: import.meta.env.MODE !== 'test' });
    return { seeded, profileId, missionDay, ms: performance.now() - t0 };
  })();
  booting.catch(() => {
    booting = null;
  });
  return booting;
}

/**
 * Settings "Reset demo": re-seeds the timeline of `profileId` (default: the current profile) and puts the mission
 * store back on that profile's demo day.
 */
export async function resetDemoAndStores(profileId?: MissionProfileId, database: ArgusDB = defaultDb): Promise<SeedReport> {
  const id = profileId ?? useMissionStore.getState().profileId;
  syncedProfile = id;
  await profileSwitch;
  const report = await resetDemo(id, { database });
  const store = useMissionStore.getState();
  if (store.profileId !== id) store.setProfile(id);
  else store.resetToToday();
  await setCurrentMissionDay(profileById(id).demoMissionDay, database);
  return report;
}

/** Test helper: forget the boot state and the store subscription. */
export function resetBootStateForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  booting = null;
  syncedProfile = null;
  profileSwitch = Promise.resolve();
}
