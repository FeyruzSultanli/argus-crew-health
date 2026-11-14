// CSV of the current Trends view (doc 11 §5.3 export). Pure builder + RFC 4180 quoting.
import { unitSymbol } from '../../ui/units';
import type { TrendTrack } from './trendData';

export const CSV_COLUMNS = [
  'signal',
  'track',
  'crew',
  'missionDay',
  'value',
  'unit',
  'bandLo',
  'bandHi',
  'personalVerdict',
  'sourceLabel',
] as const;

export type CsvRow = Record<(typeof CSV_COLUMNS)[number], string | number | null | undefined>;

export interface CsvChart {
  signal: string;
  crew: string;
  unit: string;
  tracks: readonly TrendTrack[];
}

/** Quote a field when it holds a comma, quote, CR or LF; double inner quotes. */
export function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Number(v.toFixed(4))) : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per plotted point of every chart in view (charts in page order, points in day order). */
export function csvRows(charts: readonly CsvChart[]): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const c of charts) {
    for (const t of c.tracks) {
      for (const p of t.points) {
        rows.push({
          signal: c.signal,
          track: t.label,
          crew: c.crew,
          missionDay: p.missionDay,
          value: p.value,
          unit: unitSymbol(c.unit),
          bandLo: t.band ? p.lo : undefined,
          bandHi: t.band ? p.hi : undefined,
          personalVerdict: p.state,
          sourceLabel: p.measured ? 'MEASURED' : 'SIMULATED',
        });
      }
    }
  }
  return rows;
}

/** Header + rows, CRLF line ends (RFC 4180). */
export function buildCsv(charts: readonly CsvChart[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of csvRows(charts)) lines.push(CSV_COLUMNS.map((k) => csvField(r[k])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, CRLF/LF) — used by the tests and the e2e check. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
