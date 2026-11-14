// Demo data lifecycle and mission settings (doc 05 §6, doc 06 "Mission clock"): seeding on first run, "Reset demo",
// the stored mission epoch and the current mission day. Not part of the HealthService interface (kept as named
// exports so the shared contract does not change).
import type { CrewMember, MissionProfile, MissionProfileId } from '../domain/types';
import { DATA_VERSION_KEY } from './assessments';
import { db as defaultDb, type ArgusDB } from './db';
import { computeMissionEpoch, dateOf } from './missionClock';
import { DEFAULT_PROFILE_ID, loadSeed, profileById } from './seed';
import { generateObservations, SIM } from './sim/generator';
import { DEFAULT_SEED } from './sim/rng';

export const SETTING_KEYS = {
  profileId: 'mission.profileId',
  epoch: 'mission.epoch',
  currentDay: 'mission.currentDay',
  seed: 'seed.seed',
  seededAt: 'seed.seededAt',
  version: 'seed.version',
} as const;

/** Bump when the generator output changes so existing browsers re-seed. */
export const SEED_VERSION = 1;

async function getSetting<T>(key: string, database: ArgusDB): Promise<T | undefined> {
  return (await database.settings.get(key))?.value as T | undefined;
}

export async function getMissionProfileId(database: ArgusDB = defaultDb): Promise<MissionProfileId> {
  return (await getSetting<MissionProfileId>(SETTING_KEYS.profileId, database)) ?? DEFAULT_PROFILE_ID;
}

export async function getMissionProfile(database: ArgusDB = defaultDb): Promise<MissionProfile> {
  return profileById(await getMissionProfileId(database));
}

/** Stored mission epoch (ISO, 00:00 UTC of mission day 1). Before the first seed: computed for today, not stored. */
export async function getMissionEpoch(database: ArgusDB = defaultDb): Promise<string> {
  const stored = await getSetting<string>(SETTING_KEYS.epoch, database);
  if (stored) return stored;
  return computeMissionEpoch(new Date(), (await getMissionProfile(database)).demoMissionDay);
}

/** Mission day the app is showing (scrubber); defaults to the profile's demo day. */
export async function getCurrentMissionDay(database: ArgusDB = defaultDb): Promise<number> {
  const stored = await getSetting<number>(SETTING_KEYS.currentDay, database);
  if (typeof stored === 'number') return stored;
  return (await getMissionProfile(database)).demoMissionDay;
}

/** Called by the UI when the scrubber moves. Allowed: −180 … demo day, no day 0. */
export async function setCurrentMissionDay(day: number, database: ArgusDB = defaultDb): Promise<void> {
  const profile = await getMissionProfile(database);
  if (!Number.isInteger(day) || day === 0 || day < SIM.firstDay || day > profile.demoMissionDay) {
    throw new RangeError(`Mission day ${day} outside ${SIM.firstDay}…${profile.demoMissionDay} (no day 0).`);
  }
  await database.settings.put({ key: SETTING_KEYS.currentDay, value: day });
}

/** 00:00 UTC of a mission day, using the stored epoch. */
export async function missionDateOf(day: number, database: ArgusDB = defaultDb): Promise<Date> {
  return dateOf(day, await getMissionEpoch(database));
}

export async function listCrew(database: ArgusDB = defaultDb): Promise<CrewMember[]> {
  return database.crew.orderBy('id').toArray();
}

export interface SeedReport {
  profileId: MissionProfileId;
  seed: string;
  missionEpoch: string;
  observations: number;
  generateMs: number;
  insertMs: number;
}

export interface SeedOptions {
  database?: ArgusDB;
  now?: Date;
  seed?: string;
}

const ms = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Reset demo: wipes crew data, derived caches, tasks, messages, packets, streaks and vision maps (the space-weather
 * cache is kept), fixes a new mission epoch so the demo day is today, and writes the simulated timeline.
 * Switching profile = resetDemo(newProfileId): the same crew timeline truncated at that profile's demo day.
 */
export async function resetDemo(profileId?: MissionProfileId, opts: SeedOptions = {}): Promise<SeedReport> {
  const database = opts.database ?? defaultDb;
  const id = profileId ?? (await getMissionProfileId(database));
  const profile = profileById(id);
  const seedStr = opts.seed ?? DEFAULT_SEED;
  const missionEpoch = computeMissionEpoch(opts.now ?? new Date(), profile.demoMissionDay);
  const { crew, scenarios, anchors } = loadSeed();

  const t0 = ms();
  const observations = generateObservations(crew, profile, scenarios, anchors, seedStr, { missionEpoch });
  const t1 = ms();
  const wiped = [
    database.crew, database.observations, database.assessments, database.tasks, database.messages,
    database.packets, database.streaks, database.visionMaps,
  ];
  await database.transaction('rw', [...wiped, database.settings], async () => {
    const prev = ((await database.settings.get(DATA_VERSION_KEY))?.value as number | undefined) ?? 0;
    await Promise.all(wiped.map((t) => t.clear()));
    await database.crew.bulkPut(crew);
    await database.observations.bulkPut(observations);
    await database.settings.bulkPut([
      { key: SETTING_KEYS.profileId, value: id },
      { key: SETTING_KEYS.epoch, value: missionEpoch },
      { key: SETTING_KEYS.currentDay, value: profile.demoMissionDay },
      { key: SETTING_KEYS.seed, value: seedStr },
      { key: SETTING_KEYS.seededAt, value: new Date().toISOString() },
      { key: SETTING_KEYS.version, value: SEED_VERSION },
      { key: DATA_VERSION_KEY, value: prev + 1 }, // drops every in-memory cache (assessments.ts)
    ]);
  });
  const t2 = ms();
  return { profileId: id, seed: seedStr, missionEpoch, observations: observations.length, generateMs: t1 - t0, insertMs: t2 - t1 };
}

const inFlight = new WeakMap<ArgusDB, Promise<SeedReport | null>>();

/** Seeds on first run (or after a generator version bump). Returns null when data was already there. */
export function seedIfEmpty(profileId?: MissionProfileId, opts: SeedOptions = {}): Promise<SeedReport | null> {
  const database = opts.database ?? defaultDb;
  const running = inFlight.get(database);
  if (running) return running;
  const p = (async () => {
    const version = await getSetting<number>(SETTING_KEYS.version, database);
    const seedStr = await getSetting<string>(SETTING_KEYS.seed, database);
    const wanted = opts.seed ?? DEFAULT_SEED;
    if (version === SEED_VERSION && seedStr === wanted && (await database.observations.count()) > 0) return null;
    return resetDemo(profileId, opts);
  })().finally(() => inFlight.delete(database));
  inFlight.set(database, p);
  return p;
}
