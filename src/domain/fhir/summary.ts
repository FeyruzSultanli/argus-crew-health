// Human summary of an Earth-link packet (FR-EARTH-1). Pure TypeScript.
// Built ONLY from assessment fields (verdict, drivenBy, caughtOnlyByPersonal, explanation, action.text verbatim,
// layers.personal.numbers) and observation quality labels — no new clinical wording, no diagnosis. The crew note
// is passed through as written and never analysed.
import { REFERENCE_KIND } from '../baseline/constants';
import { SIGNALS } from '../signals';
import type { Assessment, CrewMember, LayerId, Observation, PacketRequest, SignalId, Verdict } from '../types';
import { DISPLAY_PRECISION, DISPLAY_UNIT, formatNumber } from '../units';
import { VERDICT_WORD } from './toFhir';

export const LAYER_LONG: Record<LayerId, string> = {
  personal: 'personal baseline',
  space: 'space-adapted rules',
  earth: 'Earth clinical reference',
};

export interface FlagLine {
  signalId: SignalId;
  label: string;
  verdict: Verdict;
  drivenBy: LayerId[];
  caughtOnlyByPersonal: boolean;
  explanation: string;
  actionText: string;
  /** "usual 58 bpm, band 54–62 bpm, day-to-day variation 2 bpm (in-flight reference)" or null. */
  baseline: string | null;
  /** Days of the period on which this signal was flagged (WATCH/ACT). */
  flaggedDays: number[];
}

export interface QualityLine {
  label: string;
  quality: 'fair' | 'poor';
  count: number;
  reasons: string[];
}

export interface CrewSummary {
  crewId: string;
  name: string;
  counts: Record<Verdict, number>;
  readings: number;
  flags: FlagLine[];
  expected: string[];
  lowQuality: QualityLine[];
  stale: string[];
  noData: string[];
}

export interface PacketSummary {
  crews: CrewSummary[];
  flaggedTotal: number;
  text: string;
}

export interface PacketSummaryInput {
  request: PacketRequest;
  crew: readonly CrewMember[];
  /** Assessments of the selected crew on every day of the period (the last day is the "as of" day). */
  assessments: readonly Assessment[];
  /** Observations of the selected crew in the period (all, not only flags — quality counts use them). */
  observations: readonly Observation[];
  profileLabel?: string;
}

const isFlag = (v: Verdict): boolean => v === 'WATCH' || v === 'ACT';
const SEVERITY: Record<Verdict, number> = { ACT: 3, WATCH: 2, EXPECTED: 1, NOMINAL: 0, NO_DATA: -1 };

function withUnit(signalId: SignalId, v: number): string {
  const unit = DISPLAY_UNIT[signalId];
  const text = formatNumber(v, DISPLAY_PRECISION[signalId]);
  return unit === '' ? text : unit === '%' || unit === '/5' ? `${text}${unit}` : `${text} ${unit}`;
}

/** Personal reference numbers formatted with units, from layers.personal.numbers. */
export function baselineText(a: Assessment): string | null {
  const n = a.layers.personal.numbers;
  if (!n || typeof n.ref !== 'number' || a.layers.personal.verdict === 'NO_DATA') return null;
  const parts = [`usual ${withUnit(a.signalId, n.ref)}`];
  if (typeof n.lo === 'number' && typeof n.hi === 'number') {
    parts.push(`band ${formatNumber(n.lo, DISPLAY_PRECISION[a.signalId])}–${withUnit(a.signalId, n.hi)}`);
  }
  if (typeof n.sigma === 'number') parts.push(`day-to-day variation ${withUnit(a.signalId, n.sigma)}`);
  const kind =
    n.referenceKind === REFERENCE_KIND.adaptive
      ? ' (in-flight reference)'
      : n.referenceKind === REFERENCE_KIND.preflight
        ? ' (pre-flight reference)'
        : '';
  return `${parts.join(', ')}${kind}`;
}

const emptyCounts = (): Record<Verdict, number> => ({ ACT: 0, WATCH: 0, EXPECTED: 0, NOMINAL: 0, NO_DATA: 0 });

function crewSummary(c: CrewMember, input: PacketSummaryInput): CrewSummary {
  const toDay = input.request.toDay;
  const mine = input.assessments.filter((a) => a.crewId === c.id);
  const today = mine.filter((a) => a.missionDay === toDay);
  const counts = emptyCounts();
  for (const a of today) counts[a.verdict]++;
  const flaggedDaysOf = (id: SignalId) =>
    [...new Set(mine.filter((a) => a.signalId === id && isFlag(a.verdict)).map((a) => a.missionDay))].sort(
      (x, y) => x - y,
    );
  const flags: FlagLine[] = today
    .filter((a) => isFlag(a.verdict))
    .sort((x, y) => SEVERITY[y.verdict] - SEVERITY[x.verdict] || x.signalId.localeCompare(y.signalId))
    .map((a) => ({
      signalId: a.signalId,
      label: SIGNALS[a.signalId].label,
      verdict: a.verdict,
      drivenBy: a.drivenBy,
      caughtOnlyByPersonal: a.caughtOnlyByPersonal,
      explanation: a.explanation,
      actionText: a.action.text,
      baseline: baselineText(a),
      flaggedDays: flaggedDaysOf(a.signalId),
    }));
  const obs = input.observations.filter((o) => o.crewId === c.id);
  const low = new Map<string, QualityLine>();
  for (const o of obs) {
    if (o.quality.label === 'good') continue;
    const key = `${o.signalId}|${o.quality.label}`;
    const q = low.get(key) ?? { label: SIGNALS[o.signalId].label, quality: o.quality.label, count: 0, reasons: [] };
    q.count++;
    for (const r of o.quality.reasons) if (!q.reasons.includes(r)) q.reasons.push(r);
    low.set(key, q);
  }
  const staleOf = (a: Assessment): string | undefined => (a.quality as { stale?: string }).stale;
  return {
    crewId: c.id,
    name: c.displayName,
    counts,
    readings: obs.length,
    flags,
    expected: today.filter((a) => a.verdict === 'EXPECTED').map((a) => SIGNALS[a.signalId].label),
    lowQuality: [...low.values()],
    stale: today.filter((a) => staleOf(a) === 'remeasure').map((a) => SIGNALS[a.signalId].label),
    noData: today.filter((a) => a.verdict === 'NO_DATA').map((a) => SIGNALS[a.signalId].label),
  };
}

const dayLabel = (d: number): string => (d < 0 ? `L${d}` : `MD ${d}`);

function flagText(f: FlagLine, periodDays: number): string[] {
  const driven = f.drivenBy.length ? ` — driven by ${f.drivenBy.map((l) => LAYER_LONG[l]).join(' + ')}` : '';
  const caught = f.caughtOnlyByPersonal ? ' — caught only by personal baseline' : '';
  const lines = [`• ${f.label}: ${VERDICT_WORD[f.verdict]}${driven}${caught}.`, `  ${f.explanation}`];
  if (f.baseline) lines.push(`  Against personal baseline: ${f.baseline}.`);
  if (f.flaggedDays.length) {
    lines.push(
      `  Flagged on ${f.flaggedDays.length} of ${periodDays} days in the period (${f.flaggedDays.map(dayLabel).join(', ')}).`,
    );
  }
  lines.push(`  Action: ${f.actionText}`);
  return lines;
}

/** Number of mission days in [fromDay, toDay], without day 0. */
export function periodLength(fromDay: number, toDay: number): number {
  if (toDay < fromDay) return 0;
  const n = toDay - fromDay + 1;
  return fromDay < 0 && toDay > 0 ? n - 1 : n;
}

/** Structured summary plus the plain-text form stored in Packet.summary. */
export function buildPacketSummary(input: PacketSummaryInput): PacketSummary {
  const { request } = input;
  const crews = input.crew.map((c) => crewSummary(c, input));
  const days = periodLength(request.fromDay, request.toDay);
  const labels = new Map<string, number>();
  for (const o of input.observations) labels.set(o.source.label, (labels.get(o.source.label) ?? 0) + 1);
  const labelText = [...labels.entries()].map(([l, n]) => `${l} ${n}`).join(', ') || 'none';
  const out: string[] = [
    `ARGUS packet${input.profileLabel ? ` · ${input.profileLabel}` : ''} · ${dayLabel(request.fromDay)} to ${dayLabel(request.toDay)} · ${request.flagsOnly ? 'flagged signals only' : 'all readings'}`,
    `Status as of ${dayLabel(request.toDay)}. Readings in the period by data label: ${labelText}.`,
  ];
  for (const c of crews) {
    const k = c.counts;
    out.push(
      '',
      `${c.name} — ${k.ACT + k.WATCH} flagged (${k.ACT} Act, ${k.WATCH} Watch) · ${k.EXPECTED} expected in space · ${k.NOMINAL} nominal · ${k.NO_DATA} no data · ${c.readings} readings in the period`,
    );
    if (c.flags.length === 0) out.push('• No flagged signals.');
    for (const f of c.flags) out.push(...flagText(f, days));
    if (c.expected.length) out.push(`Expected in space: ${c.expected.join(', ')}.`);
    const q: string[] = [];
    if (c.lowQuality.length === 0) q.push('all readings in the period are good quality');
    for (const l of c.lowQuality) {
      q.push(`${l.count} ${l.quality} ${l.label} reading${l.count === 1 ? '' : 's'}${l.reasons.length ? ` (${l.reasons.join('; ')})` : ''}`);
    }
    if (c.stale.length) q.push(`re-measure due: ${c.stale.join(', ')}`);
    if (c.noData.length) q.push(`no recent reading: ${c.noData.join(', ')}`);
    out.push(`Data quality: ${q.join('; ')}.`);
  }
  if (request.note && request.note.trim()) out.push('', `Note from the crew (as written): ${request.note}`);
  return { crews, flaggedTotal: crews.reduce((n, c) => n + c.flags.length, 0), text: out.join('\n') };
}
