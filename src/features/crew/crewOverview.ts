// Crew overview row models (doc 11 §5.6, FR-CREW-3). Pure.
// The layer counting and the severity order are copied from src/features/bridge/counters.ts and crewRows.ts
// (feature folders do not import each other).
import type { CrewSummary } from '../../domain/fhir';
import type { Assessment, CrewMember, LayerId, Observation, Verdict } from '../../domain/types';
import type { PacketRow } from '../../services/packets';

export const SEVERITY: Record<Verdict, number> = { ACT: 3, WATCH: 2, EXPECTED: 1, NOMINAL: 0, NO_DATA: -1 };
export const LAYERS: readonly LayerId[] = ['personal', 'space', 'earth'];

export const isFlag = (v: Verdict): boolean => v === 'WATCH' || v === 'ACT';

export function worst(verdicts: readonly Verdict[]): Verdict {
  return verdicts.reduce<Verdict>((w, v) => (SEVERITY[v] > SEVERITY[w] ? v : w), 'NO_DATA');
}

export interface LayerFlags {
  personal: number;
  space: number;
  earth: number;
  flagged: number;
  caughtOnlyByPersonal: number;
}

/** A layer flag = that layer's verdict is WATCH or ACT (bridge counters rule). Cabin assessments skipped. */
export function layerFlags(assessments: readonly Assessment[]): LayerFlags {
  const c: LayerFlags = { personal: 0, space: 0, earth: 0, flagged: 0, caughtOnlyByPersonal: 0 };
  for (const a of assessments) {
    if (a.crewId === 'cabin') continue;
    for (const l of LAYERS) if (isFlag(a.layers[l].verdict)) c[l]++;
    if (isFlag(a.verdict)) c.flagged++;
    if (a.caughtOnlyByPersonal) c.caughtOnlyByPersonal++;
  }
  return c;
}

export interface CrewRow {
  member: CrewMember;
  assessments: readonly Assessment[];
  verdict: Verdict;
  flags: LayerFlags;
}

export function crewRow(member: CrewMember, assessments: readonly Assessment[]): CrewRow {
  return { member, assessments, verdict: worst(assessments.map((a) => a.verdict)), flags: layerFlags(assessments) };
}

/** Severity of the worst verdict (Act first), then number of flags, then name. */
export function sortRows<T extends { verdict: Verdict; flagged: number; name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => SEVERITY[b.verdict] - SEVERITY[a.verdict] || b.flagged - a.flagged || a.name.localeCompare(b.name),
  );
}

export function sortCrewRows(rows: readonly CrewRow[]): CrewRow[] {
  const keyed = rows.map((r) => ({ r, verdict: r.verdict, flagged: r.flags.flagged, name: r.member.displayName }));
  return sortRows(keyed).map((k) => k.r);
}

/** Flagged assessments, most severe first. */
export function topFlags(assessments: readonly Assessment[], n = 3): Assessment[] {
  return assessments
    .filter((a) => a.crewId !== 'cabin' && isFlag(a.verdict))
    .sort((x, y) => SEVERITY[y.verdict] - SEVERITY[x.verdict] || x.signalId.localeCompare(y.signalId))
    .slice(0, n);
}

/** The most recent reading behind the day's assessments (prefers readings with a primary value). */
export function lastMeasurement(assessments: readonly Assessment[]): Observation | undefined {
  let best: Observation | undefined;
  for (const a of assessments) {
    const o = a.latest;
    if (!o || o.crewId === 'cabin') continue;
    if (!best || o.effectiveAt > best.effectiveAt || (o.effectiveAt === best.effectiveAt && best.value === null && o.value !== null)) {
      best = o;
    }
  }
  return best;
}

// ---- flight surgeon: only what delivered packets contain ----

export interface ReceivedCrewRow {
  crewId: string;
  name: string;
  summary: CrewSummary;
  packet: PacketRow;
  verdict: Verdict;
  /** Flags per driving layer (the packet carries the layers that drove each flag). */
  byLayer: Record<LayerId, number>;
  flagged: number;
}

function verdictOf(s: CrewSummary): Verdict {
  const k = s.counts;
  if (k.ACT) return 'ACT';
  if (k.WATCH) return 'WATCH';
  if (k.EXPECTED) return 'EXPECTED';
  if (k.NOMINAL) return 'NOMINAL';
  return 'NO_DATA';
}

/** One row per crew member present in a delivered packet, from the newest delivered packet that contains them. */
export function receivedRows(packets: readonly PacketRow[]): ReceivedCrewRow[] {
  const newest = new Map<string, { packet: PacketRow; summary: CrewSummary }>();
  for (const p of packets) {
    if (p.status !== 'delivered') continue;
    for (const s of p.digest) {
      const cur = newest.get(s.crewId);
      if (!cur || p.deliverAt > cur.packet.deliverAt) newest.set(s.crewId, { packet: p, summary: s });
    }
  }
  const rows = [...newest.values()].map(({ packet, summary }) => {
    const byLayer: Record<LayerId, number> = { personal: 0, space: 0, earth: 0 };
    for (const f of summary.flags) for (const l of f.drivenBy) byLayer[l]++;
    return {
      crewId: summary.crewId,
      name: summary.name,
      summary,
      packet,
      verdict: verdictOf(summary),
      byLayer,
      flagged: summary.flags.length,
    };
  });
  return sortRows(rows);
}
