// Parser for seed/handbook/*.md: a small YAML-style front-matter block plus `## ` sections.
// Pure (no DOM, no import.meta.env) so scripts/build-handbook-index.ts can use it too.
//
// Front matter, between two `---` lines:
//   key: value                 — string (surrounding quotes optional)
//   key: [a, b c, d]           — list of strings (comma-separated, items trimmed, quotes optional)
//   order: 3 / experimental: true
// Tolerant: CRLF line ends, blank lines and `#` comment lines inside the block, unknown keys (→ warning).
// Fatal (HandbookParseError): no front matter, missing id/title, invalid category.
import type { Hazard, SignalId } from '../../../domain/types';
import { CANONICAL_UNIT } from '../../../domain/units';
import { isProtocolId } from './protocolIds';
import type { HandbookCategory, HandbookEntry, HandbookMeta, HandbookSection } from './types';
import { HANDBOOK_CATEGORIES } from './types';

export class HandbookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandbookParseError';
  }
}

type RawValue = string | string[];

const KNOWN_KEYS = new Set([
  'id',
  'title',
  'category',
  'order',
  'signalIds',
  'keywords',
  'sourceIds',
  'summary',
  'hazard',
  'protocolId',
  'experimental',
]);
const CATEGORIES = new Set<string>(HANDBOOK_CATEGORIES.map((c) => c.id));
const SIGNAL_IDS = new Set<string>(Object.keys(CANONICAL_UNIT));
const HAZARDS = new Set<string>(['radiation', 'isolation', 'distance', 'gravity', 'environment']);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseValue(raw: string): RawValue {
  const t = raw.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return inner
      .split(',')
      .map(unquote)
      .filter((s) => s !== '');
  }
  return unquote(t);
}

/** Splits `---\n…\n---\nbody`. Returns null when there is no front-matter block. */
export function splitFrontMatter(markdown: string): { block: string; body: string } | null {
  const text = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length && lines[start]?.trim() === '') start++;
  if (lines[start]?.trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === '---');
  if (end === -1) return null;
  return { block: lines.slice(start + 1, end).join('\n'), body: lines.slice(end + 1).join('\n') };
}

/** Parses the front-matter block into raw key/value pairs. */
export function parseFrontMatterBlock(block: string): Map<string, RawValue> {
  const out = new Map<string, RawValue>();
  for (const line of block.split('\n')) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue;
    const colon = t.indexOf(':');
    if (colon <= 0) continue;
    out.set(t.slice(0, colon).trim(), parseValue(t.slice(colon + 1)));
  }
  return out;
}

export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Splits a markdown body into `## ` sections. Text before the first heading is returned as `intro`. */
export function splitSections(body: string): { intro: string; sections: HandbookSection[] } {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const sections: HandbookSection[] = [];
  const intro: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) {
      sections.push({
        heading: current.heading,
        slug: slugify(current.heading),
        markdown: current.lines.join('\n').trim(),
      });
    }
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m?.[1] !== undefined && !line.startsWith('###')) {
      flush();
      current = { heading: m[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  flush();
  return { intro: intro.join('\n').trim(), sections };
}

function asString(v: RawValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v.join(', ') : v;
}
function asList(v: RawValue | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  return v === '' ? [] : [v];
}

/** Front matter → typed metadata. Collects non-fatal problems in `warnings`. */
export function toMeta(fm: Map<string, RawValue>, warnings: string[]): HandbookMeta {
  for (const key of fm.keys()) if (!KNOWN_KEYS.has(key)) warnings.push(`unknown front-matter key "${key}"`);

  const id = asString(fm.get('id'));
  const title = asString(fm.get('title'));
  const category = asString(fm.get('category'));
  if (!id) throw new HandbookParseError('front matter has no "id"');
  if (!title) throw new HandbookParseError(`entry "${id}": front matter has no "title"`);
  if (!category || !CATEGORIES.has(category)) {
    throw new HandbookParseError(`entry "${id}": invalid category "${category ?? ''}"`);
  }
  if (!KEBAB.test(id)) warnings.push(`id "${id}" is not kebab-case`);

  const signalIds: SignalId[] = [];
  for (const s of asList(fm.get('signalIds'))) {
    if (SIGNAL_IDS.has(s)) signalIds.push(s as SignalId);
    else warnings.push(`unknown signal id "${s}"`);
  }

  const orderRaw = asString(fm.get('order'));
  const order = orderRaw === undefined ? 0 : Number(orderRaw);
  if (!Number.isFinite(order)) warnings.push(`order "${orderRaw ?? ''}" is not a number`);

  const summary = asString(fm.get('summary')) ?? '';
  if (summary === '') warnings.push('no summary');

  const meta: HandbookMeta = {
    id,
    title,
    category: category as HandbookCategory,
    order: Number.isFinite(order) ? order : 0,
    signalIds,
    keywords: asList(fm.get('keywords')).map((k) => k.toLowerCase()),
    sourceIds: asList(fm.get('sourceIds')),
    summary,
  };

  const hazard = asString(fm.get('hazard'));
  if (hazard !== undefined) {
    if (HAZARDS.has(hazard)) meta.hazard = hazard as Hazard;
    else warnings.push(`unknown hazard "${hazard}"`);
  }
  const protocolId = asString(fm.get('protocolId'));
  if (protocolId !== undefined) {
    if (isProtocolId(protocolId)) meta.protocolId = protocolId;
    else warnings.push(`unknown protocol id "${protocolId}"`);
  }
  const experimental = asString(fm.get('experimental'));
  if (experimental !== undefined) meta.experimental = experimental === 'true';
  return meta;
}

/** Parses one handbook markdown file (front matter + sections). */
export function parseHandbookEntry(markdown: string): HandbookEntry {
  const split = splitFrontMatter(markdown);
  if (!split) throw new HandbookParseError('no front-matter block (--- … ---) at the top of the file');
  const warnings: string[] = [];
  const meta = toMeta(parseFrontMatterBlock(split.block), warnings);
  const body = split.body.trim();
  const { intro, sections } = splitSections(body);
  if (intro !== '') warnings.push('text before the first "## " heading');
  return { ...meta, sections, body, warnings };
}
