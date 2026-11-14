// Observations → CSV (FR-DATA-2), RFC 4180 quoting. Pure TypeScript. parseCsv is the inverse used by tests.
import type { Observation } from '../types';

export const CSV_COLUMNS = [
  'id',
  'crewId',
  'signalId',
  'value',
  'unit',
  'components',
  'effectiveAt',
  'missionDay',
  'sourceKind',
  'sourceMethod',
  'sourceLabel',
  'qualityLabel',
  'qualityScore',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Quote a cell when it contains a comma, quote, CR or LF (doubling inner quotes). */
export function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function row(o: Observation): Record<CsvColumn, string> {
  return {
    id: o.id,
    crewId: o.crewId,
    signalId: o.signalId,
    value: o.value === null ? '' : String(o.value),
    unit: o.unit,
    components: o.components ? JSON.stringify(o.components) : '',
    effectiveAt: o.effectiveAt,
    missionDay: String(o.missionDay),
    sourceKind: o.source.kind,
    sourceMethod: o.source.method ?? '',
    sourceLabel: o.source.label,
    qualityLabel: o.quality.label,
    qualityScore: String(o.quality.score),
  };
}

/** Header + one line per observation, CRLF line ends (RFC 4180). */
export function observationsToCsv(observations: readonly Observation[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const o of observations) {
    const r = row(o);
    lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** RFC 4180 parser (quoted cells may hold commas, quotes and line breaks). Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cur.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}
