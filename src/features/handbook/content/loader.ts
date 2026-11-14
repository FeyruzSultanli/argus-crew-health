// Run-time loaders for the handbook. The markdown and index.json are fetched (not bundled): seed/handbook/** is
// copied to public/seed/handbook/ by `npm run sync:seed` (doc 05 §8) and requested through assetUrl(), so the
// app also works when it is served under a sub-path.
import { assetUrl } from '../../../config/paths';
import { parseHandbookEntry } from './parse';
import type { HandbookEntry, HandbookIndexItem } from './types';
import { HANDBOOK_CATEGORIES } from './types';

export class HandbookLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandbookLoadError';
  }
}

const CATEGORY_IDS = new Set<string>(HANDBOOK_CATEGORIES.map((c) => c.id));

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isIndexItem(v: unknown): v is HandbookIndexItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.file === 'string' &&
    typeof o.title === 'string' &&
    typeof o.category === 'string' &&
    CATEGORY_IDS.has(o.category) &&
    typeof o.order === 'number' &&
    typeof o.summary === 'string' &&
    isStringArray(o.signalIds) &&
    isStringArray(o.keywords) &&
    isStringArray(o.sourceIds)
  );
}

/** Validates the parsed index.json; throws HandbookLoadError on a bad shape. */
export function parseHandbookIndex(json: unknown): HandbookIndexItem[] {
  const entries = (json as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) throw new HandbookLoadError('handbook index has no "entries" array');
  entries.forEach((e, i) => {
    if (!isIndexItem(e)) throw new HandbookLoadError(`handbook index entry ${i} has an invalid shape`);
  });
  return entries as HandbookIndexItem[];
}

let indexPromise: Promise<HandbookIndexItem[]> | null = null;
const entryCache = new Map<string, Promise<HandbookEntry>>();

async function fetchOk(path: string): Promise<Response> {
  const url = assetUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new HandbookLoadError(`GET ${url} failed (${res.status})`);
  return res;
}

/** The handbook index (cached after the first successful load). */
export function loadHandbookIndex(): Promise<HandbookIndexItem[]> {
  indexPromise ??= fetchOk('seed/handbook/index.json')
    .then((r) => r.json() as Promise<unknown>)
    .then(parseHandbookIndex)
    .catch((err: unknown) => {
      indexPromise = null; // let a later call retry (e.g. after coming back online)
      throw err;
    });
  return indexPromise;
}

/** One entry by id, parsed (cached). Rejects with HandbookLoadError for an unknown id. */
export function loadHandbookEntry(id: string): Promise<HandbookEntry> {
  let p = entryCache.get(id);
  if (!p) {
    p = loadHandbookIndex()
      .then(async (index) => {
        const item = index.find((e) => e.id === id);
        if (!item) throw new HandbookLoadError(`no handbook entry "${id}"`);
        const text = await (await fetchOk(`seed/handbook/${item.file}`)).text();
        const entry = parseHandbookEntry(text);
        if (entry.id !== id)
          throw new HandbookLoadError(`${item.file} declares id "${entry.id}", expected "${id}"`);
        return entry;
      })
      .catch((err: unknown) => {
        entryCache.delete(id);
        throw err;
      });
    entryCache.set(id, p);
  }
  return p;
}

/** Test helper: forget cached index and entries. */
export function clearHandbookCache(): void {
  indexPromise = null;
  entryCache.clear();
}
