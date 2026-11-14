// Assessment engine behind the HealthService (doc 05 §4.1/§4.2): loads observations per crew+signal from Dexie
// once, keeps each array object stable (the baseline engine's memo is keyed on it), runs the domain pipeline
// (computePersonal + assessMany) per crew-day, caches the result in memory and invalidates precisely on writes.
//
// Reactivity: every write bumps the `data.version` settings row inside the write transaction. Every read starts by
// reading that row (and `derived.version`), so useLiveQuery hooks re-run after writes, and another tab's write
// (different version) drops this tab's caches.
import { CABIN_SIGNAL_IDS, getSignal, signalList } from '../domain/signals';
import { preflightOf } from '../domain/rules/history';
import { assessMany } from '../domain/verdict/assess';
import { computePersonal, personalSeriesMemo, type PersonalTrackSeries } from '../domain/baseline/personal';
import { buildTodayPlan, type PlanSignalInput } from '../domain/plan/todayPlan';
import type {
  Assessment,
  CrewMember,
  DoseLedger,
  MissionProfile,
  Observation,
  PersonalResult,
  RuleCtx,
  SignalDef,
  SignalId,
  Task,
} from '../domain/types';
import { db as defaultDb, type ArgusDB } from './db';
import { missionDayRange } from './missionClock';
import { profileById, DEFAULT_PROFILE_ID } from './seed';

export const DATA_VERSION_KEY = 'data.version';
export const DERIVED_VERSION_KEY = 'derived.version';

const CABIN: ReadonlySet<SignalId> = new Set(CABIN_SIGNAL_IDS);
const CREW_DEFS: readonly SignalDef[] = signalList.filter((d) => !CABIN.has(d.id));
const CABIN_DEFS: readonly SignalDef[] = CABIN_SIGNAL_IDS.map(getSignal);
/** Not planned: experimental face index (P2, never generated) — doc 07 §4.12. */
const PLAN_EXCLUDED: ReadonlySet<SignalId> = new Set<SignalId>(['face_fluid_index']);
const EMPTY: Observation[] = [];
const ASSESS_CACHE_MAX = 256;
/** First mission day of the simulated timeline (doc 12 §4). */
const FIRST_DAY = -180;

export const defsFor = (crewId: string): readonly SignalDef[] => (crewId === 'cabin' ? CABIN_DEFS : CREW_DEFS);

// ---- dose seam ----

export type DoseProvider = (crewId: string, missionDay: number) => DoseLedger | undefined;
let doseProvider: DoseProvider | null = null;

/**
 * Dose seam: the dose ledger per crew-day for `radiation_dose` (ctx.dose). Until it is set radiation_dose is
 * NO_DATA. Setting it bumps `derived.version` so cached assessments and live hooks refresh.
 */
export async function setDoseProvider(fn: DoseProvider | null, database: ArgusDB = defaultDb): Promise<void> {
  doseProvider = fn;
  for (const e of engines.values()) e.dropDerived();
  await bumpDerivedVersion(database);
}

/** Call when inputs outside Dexie (e.g. the dose ledger during an SPE replay) changed. */
export async function bumpDerivedVersion(database: ArgusDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const v = ((await database.settings.get(DERIVED_VERSION_KEY))?.value as number | undefined) ?? 0;
    await database.settings.put({ key: DERIVED_VERSION_KEY, value: v + 1 });
  });
}

// ---- helpers ----

const chrono = (a: Observation, b: Observation): number =>
  a.missionDay - b.missionDay || a.effectiveAt.localeCompare(b.effectiveAt) || a.id.localeCompare(b.id);

/** Index of the first observation with missionDay > day (observations sorted by day). */
function upperBound(obs: readonly Observation[], day: number): number {
  let lo = 0;
  let hi = obs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((obs[mid] as Observation).missionDay <= day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** Index of the first observation with missionDay ≥ day. */
function lowerBound(obs: readonly Observation[], day: number): number {
  let lo = 0;
  let hi = obs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((obs[mid] as Observation).missionDay < day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const personalMemo = new WeakMap<readonly Observation[], Observation[]>();
/**
 * The personal-baseline input (doc 07 §3 step 9, same rule as dayObservation in domain/verdict/assess.ts): on every
 * mission day that has at least one non-poor reading the poor readings are left out; days with only poor readings
 * keep them. Memoised per array object, so the filtered array stays the same object between writes (baseline memo).
 */
export function personalInput(full: Observation[]): Observation[] {
  let v = personalMemo.get(full);
  if (v) return v;
  if (!full.some((o) => o.quality.label === 'poor')) v = full;
  else {
    const daysWithBetter = new Set(full.filter((o) => o.quality.label !== 'poor').map((o) => o.missionDay));
    v = full.filter((o) => o.quality.label !== 'poor' || !daysWithBetter.has(o.missionDay));
  }
  personalMemo.set(full, v);
  return v;
}

const preflightMemo = new WeakMap<readonly Observation[], RuleCtx['preflight']>();
function preflightFull(obs: readonly Observation[]): RuleCtx['preflight'] {
  let p = preflightMemo.get(obs);
  if (!p) {
    p = preflightOf(obs);
    preflightMemo.set(obs, p);
  }
  return p;
}

export interface FlagCount {
  watch: number;
  act: number;
}
export interface PersonalTrack {
  key: string;
  label: string;
  component?: string;
  eye?: 'left' | 'right' | 'unspecified';
  series: PersonalResult['series'];
}

/** Pure: every assessment of one subject on one day from its observations grouped by signal. */
export function computeAssessments(
  crewId: string,
  missionDay: number,
  bySignal: ReadonlyMap<SignalId, Observation[]>,
  profile: MissionProfile,
  crew: CrewMember | undefined,
  dose?: DoseLedger,
): Assessment[] {
  const base: Omit<RuleCtx, 'history' | 'preflight' | 'sameDay'> = { missionDay, profile };
  if (crew) base.crew = crew;
  if (dose) base.dose = dose;
  return assessMany(defsFor(crewId), base, (def) => {
    const full = bySignal.get(def.id) ?? EMPTY;
    const upTo = full.slice(0, upperBound(full, missionDay));
    return {
      observations: upTo,
      preflight: missionDay >= 1 ? preflightFull(full) : preflightOf(upTo),
      personal: computePersonal(def, personalInput(full), missionDay, profile),
    };
  });
}

const yieldToUi = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ---- engine ----

class AssessmentEngine {
  private version: string | null = null;
  private obs = new Map<string, Map<SignalId, Observation[]>>();
  private staleSignals = new Map<string, Set<SignalId>>();
  private loading = new Map<string, Promise<Map<SignalId, Observation[]>>>();
  private assessCache = new Map<string, Assessment[]>();
  private density = new Map<string, Map<number, FlagCount>>();
  private profile: MissionProfile | null = null;
  private crew: Map<string, CrewMember> | null = null;
  private dataVersion = 0;

  private readonly db: ArgusDB;

  constructor(db: ArgusDB) {
    this.db = db;
  }

  dropAll(): void {
    this.obs.clear();
    this.staleSignals.clear();
    this.loading.clear();
    this.profile = null;
    this.crew = null;
    this.dropDerived();
  }

  dropDerived(): void {
    this.assessCache.clear();
    this.density.clear();
  }

  /** Reads the version rows (this is what useLiveQuery subscribes to) and drops caches when they moved. */
  async sync(): Promise<string> {
    const [d, r] = await this.db.settings.bulkGet([DATA_VERSION_KEY, DERIVED_VERSION_KEY]);
    const dv = (d?.value as number | undefined) ?? 0;
    const token = `${dv}|${(r?.value as number | undefined) ?? 0}`;
    if (token !== this.version) {
      if (dv !== this.dataVersion || this.version === null) this.dropAll();
      else this.dropDerived();
      this.version = token;
      this.dataVersion = dv;
    }
    return token;
  }

  /** Called inside the write transaction of addObservation, after the version row was bumped. */
  noteWrite(prevVersion: number, newVersion: number, crewId: string, signalId: SignalId, day: number): void {
    if (prevVersion !== this.dataVersion) {
      this.dropAll();
      this.version = null;
      return;
    }
    this.dataVersion = newVersion;
    this.version = this.version === null ? null : `${newVersion}|${this.version.split('|')[1] ?? '0'}`;
    const stale = this.staleSignals.get(crewId) ?? new Set<SignalId>();
    stale.add(signalId);
    this.staleSignals.set(crewId, stale);
    for (const key of [...this.assessCache.keys()]) {
      const [c, d] = key.split('|');
      if (c === crewId && Number(d) >= day) this.assessCache.delete(key);
    }
    const dens = this.density.get(crewId);
    if (dens) for (const d of [...dens.keys()]) if (d >= day) dens.delete(d);
  }

  async getProfile(): Promise<MissionProfile> {
    if (!this.profile) {
      const id = (await this.db.settings.get('mission.profileId'))?.value as MissionProfile['id'] | undefined;
      this.profile = profileById(id ?? DEFAULT_PROFILE_ID);
    }
    return this.profile;
  }

  async getCrew(): Promise<Map<string, CrewMember>> {
    if (!this.crew) this.crew = new Map((await this.db.crew.toArray()).map((c) => [c.id, c]));
    return this.crew;
  }

  async crewObs(crewId: string): Promise<Map<SignalId, Observation[]>> {
    let map = this.obs.get(crewId);
    if (!map) {
      let p = this.loading.get(crewId);
      if (!p) {
        p = this.db.observations
          .where('[crewId+missionDay]')
          .between([crewId, -Infinity], [crewId, Infinity], true, true)
          .toArray()
          .then((rows) => {
            const m = new Map<SignalId, Observation[]>();
            for (const o of rows) {
              const list = m.get(o.signalId);
              if (list) list.push(o);
              else m.set(o.signalId, [o]);
            }
            for (const list of m.values()) list.sort(chrono);
            return m;
          });
        this.loading.set(crewId, p);
      }
      map = await p;
      this.loading.delete(crewId);
      this.obs.set(crewId, map);
    }
    const stale = this.staleSignals.get(crewId);
    if (stale && stale.size > 0) {
      for (const s of [...stale]) {
        const rows = await this.db.observations
          .where('[crewId+signalId+missionDay]')
          .between([crewId, s, -Infinity], [crewId, s, Infinity], true, true)
          .toArray();
        map.set(s, rows.sort(chrono)); // a new array object → the personal memo recomputes this signal only
        stale.delete(s);
      }
    }
    return map;
  }

  async assess(crewId: string, missionDay: number): Promise<Assessment[]> {
    await this.sync();
    const key = `${crewId}|${missionDay}`;
    const hit = this.assessCache.get(key);
    if (hit) {
      this.assessCache.delete(key);
      this.assessCache.set(key, hit); // LRU touch
      return hit;
    }
    const bySignal = await this.crewObs(crewId);
    const profile = await this.getProfile();
    const crew = crewId === 'cabin' ? undefined : (await this.getCrew()).get(crewId);
    const out = computeAssessments(crewId, missionDay, bySignal, profile, crew, doseProvider?.(crewId, missionDay));
    this.assessCache.set(key, out);
    if (this.assessCache.size > ASSESS_CACHE_MAX) {
      const oldest = this.assessCache.keys().next().value;
      if (oldest !== undefined) this.assessCache.delete(oldest);
    }
    return out;
  }

  async personal(crewId: string, signalId: SignalId, upToDay: number) {
    await this.sync();
    const bySignal = await this.crewObs(crewId);
    const profile = await this.getProfile();
    return personalSeriesMemo(getSignal(signalId), personalInput(bySignal.get(signalId) ?? EMPTY), profile).tracks.map(
      (t: PersonalTrackSeries) => trackOut(t, upToDay),
    );
  }

  async personalSeries(crewId: string, signalId: SignalId, upToDay: number): Promise<PersonalResult['series']> {
    await this.sync();
    const bySignal = await this.crewObs(crewId);
    const profile = await this.getProfile();
    const s = personalSeriesMemo(getSignal(signalId), personalInput(bySignal.get(signalId) ?? EMPTY), profile);
    return s.series.filter((p) => p.missionDay <= upToDay);
  }

  async todayPlan(crewId: string, missionDay: number): Promise<Task[]> {
    await this.sync();
    if (crewId === 'cabin') return [];
    const bySignal = await this.crewObs(crewId);
    const signals: PlanSignalInput[] = defsFor(crewId)
      .filter((d) => !PLAN_EXCLUDED.has(d.id))
      .map((def) => {
        const obs = bySignal.get(def.id) ?? EMPTY;
        const i = lowerBound(obs, missionDay);
        return {
          signalId: def.id,
          cadenceDays: def.cadenceDays,
          lastObservationDay: i > 0 ? (obs[i - 1] as Observation).missionDay : null,
          observedToday: obs[i]?.missionDay === missionDay,
          label: def.label,
        };
      });
    const tasks = buildTodayPlan({ crewId, missionDay, signals });
    const persisted = await this.db.tasks.where('[crewId+missionDay]').equals([crewId, missionDay]).toArray();
    const byId = new Map(persisted.map((t) => [t.id, t]));
    return tasks.map((t) => {
      const p = byId.get(t.id);
      return p && p.status === 'skipped' && t.status !== 'done' ? { ...t, status: 'skipped' } : t;
    });
  }

  /**
   * Per mission day (−180 … demo day): number of crew signals (c1–c4, not cabin) with combined verdict WATCH / ACT.
   * Time-sliced (yields to the UI every ~12 ms); cached per crew-day and invalidated from the written day on.
   * Rejects with an AbortError when `signal` aborts.
   */
  async flagDensity(signal?: AbortSignal): Promise<Array<{ missionDay: number } & FlagCount>> {
    const token = await this.sync();
    const profile = await this.getProfile();
    const crew = [...(await this.getCrew()).values()].sort((a, b) => a.id.localeCompare(b.id));
    const days = missionDayRange(FIRST_DAY, profile.demoMissionDay);
    let sliceStart = performance.now();
    for (const c of crew) {
      const bySignal = await this.crewObs(c.id);
      let dens = this.density.get(c.id);
      if (!dens) {
        dens = new Map();
        this.density.set(c.id, dens);
      }
      for (const day of days) {
        if (dens.has(day)) continue;
        const list = computeAssessments(c.id, day, bySignal, profile, c, doseProvider?.(c.id, day));
        let watch = 0;
        let act = 0;
        for (const a of list) {
          if (a.verdict === 'WATCH') watch++;
          else if (a.verdict === 'ACT') act++;
        }
        dens.set(day, { watch, act });
        if (performance.now() - sliceStart > 12) {
          await yieldToUi();
          if (signal?.aborted) throw new DOMException('Flag density aborted', 'AbortError');
          if ((await this.sync()) !== token) return this.flagDensity(signal); // data moved under us: restart
          sliceStart = performance.now();
          dens = this.density.get(c.id) ?? dens;
          this.density.set(c.id, dens);
        }
      }
    }
    return days.map((missionDay) => {
      let watch = 0;
      let act = 0;
      for (const c of crew) {
        const f = this.density.get(c.id)?.get(missionDay);
        watch += f?.watch ?? 0;
        act += f?.act ?? 0;
      }
      return { missionDay, watch, act };
    });
  }
}

function trackOut(t: PersonalTrackSeries, upToDay: number): PersonalTrack {
  const out: PersonalTrack = { key: t.key, label: t.label, series: t.series.filter((p) => p.missionDay <= upToDay) };
  if (t.component !== undefined) out.component = t.component;
  if (t.eye !== undefined) out.eye = t.eye;
  return out;
}

const engines = new Map<ArgusDB, AssessmentEngine>();

export function engineFor(database: ArgusDB): AssessmentEngine {
  let e = engines.get(database);
  if (!e) {
    e = new AssessmentEngine(database);
    engines.set(database, e);
  }
  return e;
}

export type { AssessmentEngine };
