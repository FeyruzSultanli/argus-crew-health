// Crew Health Data Service facade — interface copied verbatim from docs/05_ARCHITECTURE.md §4.1.
// The UI talks only to this facade, never to Dexie directly.
// Observations, assessments (domain core + baseline engine, see assessments.ts) and the today plan are
// Dexie-backed; environment / spaceWeather come from the radiation services and sendPacket from services/packets.ts.
// The placeholder service rejects with NotImplementedError, so nothing silently returns fake data.
import type {
  Assessment,
  EnvironmentSnapshot,
  NewObservation,
  ObsQuery,
  Observation,
  Packet,
  PacketRequest,
  PersonalResult,
  SignalId,
  SpaceWeatherState,
  Task,
} from '../domain/types';
import { DATA_VERSION_KEY, engineFor, type FlagCount, type PersonalTrack } from './assessments';
import { db as defaultDb, type ArgusDB } from './db';
import { getCurrentMissionDay } from './demo';
import { sendPacket as sendEarthLinkPacket } from './packets';
import { environmentFor } from './environment';
import { spaceWeatherFor } from './spaceWeather';
import { validateNewObservation } from './validation';

export interface HealthService {
  // observations
  addObservation(o: NewObservation): Promise<Observation>;            // validates, assigns id, persists, triggers re-assessment
  observations(q: ObsQuery): Promise<Observation[]>;
  // assessments (derived, cached per crew/signal/missionDay)
  assess(crewId: string, missionDay: number): Promise<Assessment[]>;  // runs domain.verdict for every signal
  // plan
  todayPlan(crewId: string, missionDay: number): Promise<Task[]>;
  // environment
  environment(missionDay: number): Promise<EnvironmentSnapshot>;
  spaceWeather(): Promise<SpaceWeatherState>;                          // live → cache → snapshot
  // earth link
  sendPacket(p: PacketRequest): Promise<Packet>;
}

export class NotImplementedError extends Error {
  constructor(method: keyof HealthService) {
    super(`HealthService.${method} is not implemented (placeholder service).`);
    this.name = 'NotImplementedError';
  }
}

/** Placeholder: every call rejects. The app uses the Dexie-backed service below. */
export const placeholderHealthService: HealthService = {
  addObservation: () => Promise.reject(new NotImplementedError('addObservation')),
  observations: () => Promise.reject(new NotImplementedError('observations')),
  assess: () => Promise.reject(new NotImplementedError('assess')),
  todayPlan: () => Promise.reject(new NotImplementedError('todayPlan')),
  environment: () => Promise.reject(new NotImplementedError('environment')),
  spaceWeather: () => Promise.reject(new NotImplementedError('spaceWeather')),
  sendPacket: () => Promise.reject(new NotImplementedError('sendPacket')),
};

const sortObs = (a: Observation, b: Observation): number =>
  a.missionDay - b.missionDay || a.effectiveAt.localeCompare(b.effectiveAt) || a.id.localeCompare(b.id);

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Observations matching `q`, oldest first (missionDay, then effectiveAt). */
export async function queryObservations(database: ArgusDB, q: ObsQuery): Promise<Observation[]> {
  const from = q.fromDay ?? -Infinity;
  const to = q.toDay ?? Infinity;
  const t = database.observations;
  let rows: Observation[];
  if (q.crewId !== undefined && q.signalId !== undefined) {
    rows = await t
      .where('[crewId+signalId+missionDay]')
      .between([q.crewId, q.signalId, from], [q.crewId, q.signalId, to], true, true)
      .toArray();
  } else if (q.crewId !== undefined) {
    rows = await t.where('[crewId+missionDay]').between([q.crewId, from], [q.crewId, to], true, true).toArray();
  } else if (q.signalId !== undefined) {
    rows = await t
      .where('signalId')
      .equals(q.signalId)
      .filter((o) => o.missionDay >= from && o.missionDay <= to)
      .toArray();
  } else {
    rows = await t.filter((o) => o.missionDay >= from && o.missionDay <= to).toArray();
  }
  return rows.sort(sortObs);
}

/** Dexie-backed service. */
export function createHealthService(database: ArgusDB = defaultDb): HealthService {
  const engine = engineFor(database);
  return {
    async addObservation(o) {
      validateNewObservation(o);
      const missionDay = o.missionDay ?? (await getCurrentMissionDay(database));
      const obs: Observation = { ...o, id: newId(), missionDay, effectiveAt: o.effectiveAt ?? new Date().toISOString() };
      await database.transaction('rw', database.observations, database.settings, async () => {
        await database.observations.add(obs);
        const prev = ((await database.settings.get(DATA_VERSION_KEY))?.value as number | undefined) ?? 0;
        await database.settings.put({ key: DATA_VERSION_KEY, value: prev + 1 });
        // Drop what this reading affects: this signal's series for the crew, and that crew's assessments and flag
        // counts from this day on (covers same-day dependents such as sleep reading the reaction test).
        engine.noteWrite(prev, prev + 1, obs.crewId, obs.signalId, missionDay);
      });
      return obs;
    },
    observations: (q) => queryObservations(database, q),
    assess: (crewId, missionDay) => engine.assess(crewId, missionDay),
    todayPlan: (crewId, missionDay) => engine.todayPlan(crewId, missionDay),
    // Cabin snapshot (services/environment.ts) and space weather live → cache → snapshot (services/spaceWeather.ts)
    environment: (missionDay) =>
      environmentFor(missionDay, {
        observations: (q) => queryObservations(database, q),
        assess: (crewId, day) => engine.assess(crewId, day),
      }),
    spaceWeather: () => spaceWeatherFor(database),
    sendPacket: (p) => sendEarthLinkPacket(p, { database }), // services/packets.ts
  };
}

/**
 * The service instance the UI imports (the export name `healthService` is the contract). Dexie-backed.
 */
export const healthService: HealthService = createHealthService(defaultDb);

// ---- named extras (not part of the HealthService contract) ----

/** Every assessment of c1…c4 and the cabin on one day, keyed by crew id. */
export async function assessAll(missionDay: number, database: ArgusDB = defaultDb): Promise<Record<string, Assessment[]>> {
  const engine = engineFor(database);
  const crew = [...(await engine.getCrew()).keys()].sort();
  const out: Record<string, Assessment[]> = {};
  for (const id of [...crew, 'cabin']) out[id] = await engine.assess(id, missionDay);
  return out;
}

/** Merged personal-baseline series of a crew+signal up to `upToDay` (worse track per day for multi-series signals). */
export function personalSeries(
  crewId: string,
  signalId: SignalId,
  upToDay: number,
  database: ArgusDB = defaultDb,
): Promise<PersonalResult['series']> {
  return engineFor(database).personalSeries(crewId, signalId, upToDay);
}

/** Per-track personal series (blood pressure systolic/diastolic, near acuity per eye, …). */
export function personalTracks(
  crewId: string,
  signalId: SignalId,
  upToDay: number,
  database: ArgusDB = defaultDb,
): Promise<PersonalTrack[]> {
  return engineFor(database).personal(crewId, signalId, upToDay);
}

/** Scrubber flag density for −180 … demo day (time-sliced; see assessments.ts). */
export function flagDensity(
  signal?: AbortSignal,
  database: ArgusDB = defaultDb,
): Promise<Array<{ missionDay: number } & FlagCount>> {
  return engineFor(database).flagDensity(signal);
}

/** Current data/derived version token; reading it inside useLiveQuery subscribes to every data change. */
export function dataVersionToken(database: ArgusDB = defaultDb): Promise<string> {
  return engineFor(database).sync();
}

/** Persist a plan task's status ('skipped'); 'due' removes the override. 'done' comes from observations only. */
export async function setTaskStatus(
  task: Task,
  status: Extract<Task['status'], 'skipped' | 'due'>,
  database: ArgusDB = defaultDb,
): Promise<void> {
  if (status === 'due') await database.tasks.delete(task.id);
  else await database.tasks.put({ ...task, status });
}
