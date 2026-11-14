// Earth link (FR-EARTH-1/2/3): compose a packet (FHIR Bundle + human summary), send it with the profile's one-way
// delay ÷ the demo time compression, track Queued → In transit → Delivered, and carry flight-surgeon replies back
// with the same delay. Delivery is simulated (README "real / simulated" table): nothing leaves the browser.
// The state is derived from createdAt / deliverAt, so it survives a reload and works offline; advanceEarthLink()
// writes the derived state to Dexie, which is the source of truth for what Earth has received.
import { buildPacketSummary, observationsToCsv, toFhirBundle } from '../domain/fhir';
import type { FhirBundle, PacketSummary } from '../domain/fhir';
import type {
  Assessment,
  CrewMember,
  MissionProfile,
  MissionProfileId,
  Observation,
  Packet,
  PacketRequest,
  Verdict,
} from '../domain/types';
import { useMissionStore } from '../state/mission';
import { commsDelaySec } from '../state/missionSelectors';
import { engineFor } from './assessments';
import { db as defaultDb, type ArgusDB, type MessageRow } from './db';
import { getMissionProfile } from './demo';
import { missionDayRange } from './missionClock';

/** The link, its delay table and the time compression are simulation / demo parameters. */
export const EARTH_LINK_SOURCE_IDS: readonly string[] = ['SRC_DEMO_SIMULATION'];

/** Demo parameter [SRC_DEMO_SIMULATION]: the first second of the wait is shown as "Queued" (hand-over to the link). */
export const QUEUE_MS = 1000;

export type PacketStatus = Packet['status'];

/** Stored packet: the contract Packet plus what the UI needs to explain it later. */
export interface PacketRow extends Packet {
  compression: number;
  profileId: MissionProfileId;
  profileLabel: string;
  modeledDelay: boolean;
  /** Structured form of `summary` (part of what is sent; the surgeon's crew overview reads only this). */
  digest: PacketSummary['crews'];
  deliveredAt?: string;
}

/** Flight-surgeon reply (messages table, direction 'from-earth'). Free text, stored and shown as written. */
export interface ReplyRow extends MessageRow {
  direction: 'from-earth';
  status: 'in-transit' | 'delivered';
  sentAt: string;
  deliverAt: string;
  delaySec: number;
  compression: number;
  body: string;
  author: string;
  inReplyTo?: string;
  deliveredAt?: string;
}

export interface Composed {
  bundle: FhirBundle;
  summary: PacketSummary;
  sizeBytes: number;
  observations: Observation[];
  assessments: Assessment[];
  crew: CrewMember[];
}

export interface EarthLinkDeps {
  database?: ArgusDB;
  now?: () => number;
  profile?: MissionProfile;
  /** Real → demo seconds factor; default: the mission store's `timeCompression`. */
  compression?: number;
}

const isFlag = (v: Verdict): boolean => v === 'WATCH' || v === 'ACT';

/** Demo wait in ms for a real one-way delay at a compression factor (660 s at 60× → 11 000 ms). */
export function demoWaitMs(delaySec: number, compression: number): number {
  return (delaySec * 1000) / (compression > 0 ? compression : 1);
}

/** Queued (first QUEUE_MS, or the first 10 % of a shorter wait) → in transit → delivered at deliverAt. */
export function statusAt(p: { createdAt: string; deliverAt: string }, nowMs: number): PacketStatus {
  const start = Date.parse(p.createdAt);
  const end = Date.parse(p.deliverAt);
  if (nowMs >= end) return 'delivered';
  if (nowMs < start + Math.min(QUEUE_MS, (end - start) / 10)) return 'queued';
  return 'in-transit';
}

/** "11 min", "45 s", "1.3 s", "2 h 05 min". */
export function formatDuration(sec: number): string {
  if (sec < 10) return `${Math.round(sec * 10) / 10} s`;
  if (sec < 90) return `${Math.round(sec)} s`;
  const min = Math.round(sec / 60);
  if (min < 120) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Acceptance copy: "arrives in 11 min (demo: 11 s)"; at 1× "arrives in 11 min (real time)". */
export function arrivalText(delaySec: number, compression: number): string {
  const real = formatDuration(delaySec);
  if (compression === 1) return `arrives in ${real} (real time)`;
  return `arrives in ${real} (demo: ${formatDuration(delaySec / compression)})`;
}

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function periodObservations(database: ArgusDB, crewId: string, from: number, to: number): Promise<Observation[]> {
  const rows = await database.observations
    .where('[crewId+missionDay]')
    .between([crewId, from], [crewId, to], true, true)
    .toArray();
  return rows.sort((a, b) => a.missionDay - b.missionDay || a.effectiveAt.localeCompare(b.effectiveAt));
}

/** Builds the bundle and summary for a request without storing anything (composer preview). */
export async function composePacket(req: PacketRequest, deps: EarthLinkDeps = {}): Promise<Composed> {
  const database = deps.database ?? defaultDb;
  const profile = deps.profile ?? (await getMissionProfile(database));
  const engine = engineFor(database);
  const crewMap = await engine.getCrew();
  const crew = req.crewIds.map((id) => crewMap.get(id)).filter((c): c is CrewMember => c !== undefined);
  const days = missionDayRange(Math.min(req.fromDay, req.toDay), req.toDay);
  const assessments: Assessment[] = [];
  const all: Observation[] = [];
  for (const c of crew) {
    for (const d of days) assessments.push(...(await engine.assess(c.id, d)));
    all.push(...(await periodObservations(database, c.id, req.fromDay, req.toDay)));
  }
  let observations = all;
  if (req.flagsOnly) {
    const flagged = new Set<string>();
    const latestIds = new Set<string>();
    for (const a of assessments) {
      if (!isFlag(a.verdict)) continue;
      flagged.add(`${a.crewId}|${a.signalId}|${a.missionDay}`);
      if (a.latest) latestIds.add(a.latest.id);
    }
    observations = all.filter((o) => latestIds.has(o.id) || flagged.has(`${o.crewId}|${o.signalId}|${o.missionDay}`));
  }
  const generatedAt = new Date((deps.now ?? Date.now)()).toISOString();
  const bundle = toFhirBundle({ crew, observations, assessments, profile, generatedAt });
  const summary = buildPacketSummary({ request: req, crew, assessments, observations: all, profileLabel: profile.label });
  return { bundle, summary, sizeBytes: byteLength(JSON.stringify(bundle)), observations, assessments, crew };
}

const currentCompression = (deps: EarthLinkDeps): number => deps.compression ?? useMissionStore.getState().timeCompression;

/**
 * HealthService.sendPacket: compose, store as Queued; delivery at createdAt + delay ÷ compression. The delay is the
 * profile's one-way delay on the packet's last day (request.toDay — the composer's default is the selected day).
 */
export async function sendPacket(req: PacketRequest, deps: EarthLinkDeps = {}): Promise<PacketRow> {
  const database = deps.database ?? defaultDb;
  const profile = deps.profile ?? (await getMissionProfile(database));
  const composed = await composePacket(req, { ...deps, database, profile });
  const now = (deps.now ?? Date.now)();
  const compression = currentCompression(deps);
  const delaySec = commsDelaySec(profile, req.toDay);
  const row: PacketRow = {
    id: newId(),
    request: { ...req, crewIds: [...req.crewIds] },
    createdAt: new Date(now).toISOString(),
    status: 'queued',
    delaySec,
    deliverAt: new Date(now + demoWaitMs(delaySec, compression)).toISOString(),
    sizeBytes: composed.sizeBytes,
    summary: composed.summary.text,
    bundle: composed.bundle,
    compression,
    profileId: profile.id,
    profileLabel: profile.label,
    modeledDelay: typeof profile.commsDelayOneWaySec !== 'number',
    digest: composed.summary.crews,
  };
  await database.packets.put(row);
  return row;
}

export interface ReplyInput {
  body: string;
  inReplyTo?: string;
  /** Mission day the delay is taken at (the surgeon's view of the mission clock). */
  missionDay: number;
}

/** Flight surgeon → crew. Same one-way delay and compression as packets. */
export async function sendReply(input: ReplyInput, deps: EarthLinkDeps = {}): Promise<ReplyRow> {
  const database = deps.database ?? defaultDb;
  const profile = deps.profile ?? (await getMissionProfile(database));
  const now = (deps.now ?? Date.now)();
  const compression = currentCompression(deps);
  const delaySec = commsDelaySec(profile, input.missionDay);
  const row: ReplyRow = {
    id: newId(),
    direction: 'from-earth',
    status: 'in-transit',
    sentAt: new Date(now).toISOString(),
    deliverAt: new Date(now + demoWaitMs(delaySec, compression)).toISOString(),
    delaySec,
    compression,
    body: input.body,
    author: 'Flight surgeon',
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
  };
  await database.messages.put(row);
  return row;
}

export interface AdvanceResult {
  packetsDelivered: string[];
  repliesDelivered: string[];
}

/** Writes derived states to Dexie (queued → in-transit → delivered). Idempotent; safe from several tabs. */
export async function advanceEarthLink(nowMs: number, database: ArgusDB = defaultDb): Promise<AdvanceResult> {
  const out: AdvanceResult = { packetsDelivered: [], repliesDelivered: [] };
  await database.transaction('rw', database.packets, database.messages, async () => {
    const open = (await database.packets.where('status').anyOf('queued', 'in-transit').toArray()) as PacketRow[];
    for (const p of open) {
      const s = statusAt(p, nowMs);
      if (s === p.status) continue;
      const next: PacketRow = s === 'delivered' ? { ...p, status: s, deliveredAt: p.deliverAt } : { ...p, status: s };
      await database.packets.put(next);
      if (s === 'delivered') out.packetsDelivered.push(p.id);
    }
    const replies = (await database.messages.where('status').equals('in-transit').toArray()) as ReplyRow[];
    for (const r of replies) {
      if (nowMs < Date.parse(r.deliverAt)) continue;
      await database.messages.update(r.id, { status: 'delivered', deliveredAt: r.deliverAt });
      out.repliesDelivered.push(r.id);
    }
  });
  return out;
}

/** All packets, newest first. */
export async function listPackets(database: ArgusDB = defaultDb): Promise<PacketRow[]> {
  return ((await database.packets.orderBy('createdAt').reverse().toArray()) as PacketRow[]);
}

/** Packets Earth has received (stored status 'delivered'), newest first. The flight surgeon sees only these. */
export async function listDeliveredPackets(database: ArgusDB = defaultDb): Promise<PacketRow[]> {
  return (await listPackets(database)).filter((p) => p.status === 'delivered');
}

/** Replies from Earth, newest first. `deliveredOnly` = what the crew has received. */
export async function listReplies(deliveredOnly: boolean, database: ArgusDB = defaultDb): Promise<ReplyRow[]> {
  const rows = (await database.messages.where('direction').equals('from-earth').toArray()) as ReplyRow[];
  return rows
    .filter((r) => !deliveredOnly || r.status === 'delivered')
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export interface ExportRequest {
  crewIds: string[];
  fromDay: number;
  toDay: number;
}

export interface ExportFile {
  fileName: string;
  mime: string;
  text: string;
  count: number;
}

const fileDay = (d: number): string => (d < 0 ? `L${-d}` : `MD${d}`);

/** FR-DATA-2: FHIR R4 Bundle of every observation of the crew in the period → argus-fhir-<profile>-MD<day>.json. */
export async function exportFhir(req: ExportRequest, deps: EarthLinkDeps = {}): Promise<ExportFile> {
  const database = deps.database ?? defaultDb;
  const profile = deps.profile ?? (await getMissionProfile(database));
  const c = await composePacket({ ...req, flagsOnly: false }, { ...deps, database, profile });
  return {
    fileName: `argus-fhir-${profile.id}-${fileDay(req.toDay)}.json`,
    mime: 'application/fhir+json',
    text: JSON.stringify(c.bundle, null, 2),
    count: c.observations.length,
  };
}

/** FR-DATA-2: observations of the crew in the period as CSV → argus-observations-<profile>-MD<day>.csv. */
export async function exportCsv(req: ExportRequest, deps: EarthLinkDeps = {}): Promise<ExportFile> {
  const database = deps.database ?? defaultDb;
  const profile = deps.profile ?? (await getMissionProfile(database));
  const rows: Observation[] = [];
  for (const id of req.crewIds) rows.push(...(await periodObservations(database, id, req.fromDay, req.toDay)));
  return {
    fileName: `argus-observations-${profile.id}-${fileDay(req.toDay)}.csv`,
    mime: 'text/csv',
    text: observationsToCsv(rows),
    count: rows.length,
  };
}
