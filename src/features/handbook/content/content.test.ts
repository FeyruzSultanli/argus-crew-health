// Content guards for seed/handbook/**, seed/protocols.json and seed/limits.json.
// `npm run check:sources` scans src/ and docs/ only; these tests cover the seed content (docs/PROJECT_RULES.md rules 1 and 3).
import { describe, expect, it } from 'vitest';

import indexJson from '../../../../seed/handbook/index.json';
import limitsJson from '../../../../seed/limits.json';
import protocolsJson from '../../../../seed/protocols.json';
import sourcesJson from '../../../../seed/sources.json';
import { SIGNALS, signalList } from '../../../domain/signals';
import type { Hazard, SignalId, Verdict } from '../../../domain/types';
import { GENERIC_ACTIONS, QUALITY_GATE_ACTION } from '../../../domain/verdict/actions';
import { ADAPTATION_EXPLANATION, VERDICT_MEANING } from '../../../domain/verdict/explain';
import { buildHandbookIndex, serializeHandbookIndex } from './buildIndex';
import { extractInlineSourceIds } from './inlineTags';
import { parseHandbookEntry } from './parse';
import { protocols } from './protocols';
import { protocolFileName, protocolSourceIds, renderProtocolMarkdown } from './renderProtocol';
import type { HandbookEntry, HandbookSection } from './types';
import { REQUIRED_SECTIONS } from './types';

const RAW = import.meta.glob('../../../../seed/handbook/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const FILES = Object.entries(RAW)
  .map(([path, markdown]) => ({ file: path.split('/').at(-1) as string, markdown }))
  .sort((a, b) => a.file.localeCompare(b.file));
const ENTRIES: Array<{ file: string; entry: HandbookEntry }> = FILES.map(({ file, markdown }) => ({
  file,
  entry: parseHandbookEntry(markdown),
}));
const REGISTERED = new Set(sourcesJson.sources.map((s) => s.id));
const byCategory = (c: HandbookEntry['category']) => ENTRIES.filter((e) => e.entry.category === c);
const section = (e: HandbookEntry, heading: string): HandbookSection | undefined =>
  e.sections.find((s) => s.heading === heading);

// ---------------------------------------------------------------------------------------------------------------
// Wording guards

/**
 * Banned wording (docs/PROJECT_RULES.md rule 3, doc 11 §7): diagnosis phrasing, prescriptions, drug doses, drug names and
 * "take <drug>" instructions. Applied to every handbook file and to the text of protocols.json and limits.json.
 */
const BANNED_WORDING: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: '"you have" (diagnosis phrasing)', re: /\byou have\b/i },
  {
    label: '"you are sick/ill/infected"',
    re: /\byou(?:'re| are| might be| may be) (?:sick|ill|infected)\b/i,
  },
  { label: '"you suffer"', re: /\byou suffer/i },
  { label: 'diagnos*', re: /diagnos/i },
  { label: 'prescri*', re: /prescri/i },
  { label: 'treat / treatment', re: /\btreat(?:ment|ments|ed|ing|s)?\b/i },
  { label: 'dose in mg/mcg/µg/mL/IU', re: /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|ml|mL|IU)\b(?!\/)/ },
  {
    label: '"take <pill/drug>"',
    re: /\btake\s+(?:a |an |one |two |some |your |the )?(?:pills?|tablets?|capsules?|medications?|medicines?|drugs?|doses?)\b/i,
  },
  {
    label: 'drug names',
    re: /\b(?:ibuprofen|paracetamol|acetaminophen|aspirin|melatonin|antibiotics?|antihistamines?|antivirals?|zolpidem|modafinil|potassium iodide|decongestants?|painkillers?|sleeping pills?|hypnotics?|steroids?)\b/i,
  },
];

/** The one allowed use of "diagnos…": the negated not-a-medical-device statement (doc 01 §7). */
const ALLOWED_NEGATION = /\bnot a diagnostic\b/gi;

function bannedHits(text: string): string[] {
  const t = text.replace(ALLOWED_NEGATION, '');
  return BANNED_WORDING.filter(({ re }) => re.test(t)).map(({ label }) => label);
}

/** Every string inside a JSON value (keys excluded). */
function jsonStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(jsonStrings);
  if (typeof v === 'object' && v !== null) return Object.values(v).flatMap(jsonStrings);
  return [];
}

// ---------------------------------------------------------------------------------------------------------------
// Numbers guard: every number in a handbook body is followed by a [SRC_…] tag in the same sentence or list item.

/**
 * Spans that are not numbers in the "no invented numbers" sense: names and identifiers, not quantities.
 * - a list ordinal at the start of an item ("1. ")
 * - standard / requirement / dataset identifiers: NASA-STD-3001, V1 4030 / V2 6004, OSD-569 / OSD-575
 * - NOAA S-scale level names S1–S5
 * - "3D" (the 3D body)
 * - mission-day examples written "mission day 143"
 * - markdown link targets to other entries, "](protocol-co2-headache)"
 */
const NUMBER_WHITELIST: readonly RegExp[] = [
  /^\s*\d+\.\s/,
  /NASA-STD-3001/g,
  /\bV[12] \d{4}\b/g,
  /\bOSD-\d{3}\b/g,
  /\bS[1-5]\b/g,
  /\b3D\b/g,
  /\bmission day \d+\b/gi,
  /\]\([a-z0-9-]+\)/g,
];
/** Sections whose items may carry [demo wording] instead of a source (how-to steps, action templates). */
const DEMO_WORDING_SECTIONS = new Set(['How to measure', 'What to do', 'Steps']);

/** Splits a section into list items and paragraph sentences. */
function textUnits(markdown: string): string[] {
  const units: string[] = [];
  let item: string | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      units.push(...para.join(' ').split(/(?<=[.!?]["”')]?)\s+/));
      para = [];
    }
  };
  const flushItem = () => {
    if (item !== null) units.push(item);
    item = null;
  };
  for (const line of markdown.split('\n')) {
    if (/^\s*(?:[-*]|\d+\.)\s/.test(line)) {
      flushPara();
      flushItem();
      item = line;
    } else if (line.trim() === '') {
      flushPara();
      flushItem();
    } else if (item !== null) {
      item += ` ${line.trim()}`;
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  flushItem();
  return units.filter((u) => u.trim() !== '');
}

/** Numbers in a unit that have no tag after them (whitelisted spans ignored). */
function untaggedNumbers(unit: string, allowDemoWording: boolean): string[] {
  let masked = unit;
  for (const re of NUMBER_WHITELIST) masked = masked.replace(re, (m) => ' '.repeat(m.length));
  const tagRe = allowDemoWording ? /\[(?:SRC_[A-Z0-9_]+|demo wording)\]/g : /\[SRC_[A-Z0-9_]+\]/g;
  const tagAt = [...masked.matchAll(tagRe)].map((m) => m.index);
  masked = masked.replace(/\[SRC_[A-Z0-9_]+\]/g, (m) => ' '.repeat(m.length));
  return [...masked.matchAll(/\d+(?:[.,]\d+)*/g)]
    .filter((m) => !tagAt.some((t) => t > m.index))
    .map((m) => m[0]);
}

// ---------------------------------------------------------------------------------------------------------------

describe('handbook files', () => {
  it('has the expected number of entries', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(35);
  });

  it.each(FILES.map((f) => f.file))('%s parses without warnings', (file) => {
    const e = ENTRIES.find((x) => x.file === file)?.entry as HandbookEntry;
    expect(e.warnings).toEqual([]);
    expect(file).toBe(`${e.id}.md`);
    expect(e.summary.length).toBeLessThanOrEqual(160);
    expect(e.summary.length).toBeGreaterThan(0);
    expect(e.keywords.length).toBeGreaterThan(0);
    for (const k of e.keywords) expect(k).toBe(k.toLowerCase());
    // A protocol whose steps are all demo wording has no source (seed/protocols.json).
    if (e.category !== 'protocols') expect(e.sourceIds.length).toBeGreaterThan(0);
  });

  it('ids are unique', () => {
    const ids = ENTRIES.map((e) => e.entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has the fixed headings of its category, in order', () => {
    for (const { file, entry } of ENTRIES) {
      const headings = entry.sections.map((s) => s.heading);
      if (entry.category === 'about') {
        expect(headings.at(-1), file).toBe('Sources');
        expect(headings.length, file).toBeGreaterThanOrEqual(2);
      } else {
        expect(headings, file).toEqual(REQUIRED_SECTIONS[entry.category]);
      }
      for (const s of entry.sections) expect(s.markdown, `${file} § ${s.heading}`).not.toBe('');
    }
  });
});

describe('sources in handbook content', () => {
  it('every front-matter sourceId and every inline [SRC_…] exists in seed/sources.json', () => {
    for (const { file, entry } of ENTRIES) {
      for (const id of entry.sourceIds) expect(REGISTERED.has(id), `${file}: ${id}`).toBe(true);
      for (const id of extractInlineSourceIds(entry.body))
        expect(REGISTERED.has(id), `${file}: ${id}`).toBe(true);
    }
  });

  it('inline ids are listed in the front matter, and the Sources section lists exactly the front-matter ids', () => {
    for (const { file, entry } of ENTRIES) {
      const declared = new Set(entry.sourceIds);
      for (const id of extractInlineSourceIds(entry.body))
        expect(declared.has(id), `${file}: ${id}`).toBe(true);
      const listed = extractInlineSourceIds(section(entry, 'Sources')?.markdown ?? '');
      expect(listed, file).toEqual(entry.sourceIds);
    }
  });

  it('every source id in protocols.json and limits.json exists in seed/sources.json', () => {
    const ids = new Set([
      ...jsonStrings(protocolsJson).flatMap((s) => s.match(/SRC_[A-Z0-9_]+/g) ?? []),
      ...jsonStrings(limitsJson).flatMap((s) => s.match(/SRC_[A-Z0-9_]+/g) ?? []),
    ]);
    expect(ids.size).toBeGreaterThan(5);
    for (const id of ids) expect(REGISTERED.has(id), id).toBe(true);
  });
});

describe('signal entries', () => {
  const signalEntries = byCategory('signals');

  it('every registered SignalId has exactly one signal entry', () => {
    const covered = signalEntries.flatMap((e) => e.entry.signalIds);
    for (const id of Object.keys(SIGNALS) as SignalId[]) {
      expect(
        covered.filter((c) => c === id),
        id,
      ).toHaveLength(1);
    }
    expect(covered).toHaveLength(Object.keys(SIGNALS).length);
  });

  it('every signal entry lists the sources of its SignalDef', () => {
    for (const { file, entry } of signalEntries) {
      for (const sid of entry.signalIds) {
        for (const src of SIGNALS[sid].sourceIds) expect(entry.sourceIds, `${file}: ${src}`).toContain(src);
      }
    }
  });

  it('"What to do" quotes only the doc 07 §3/§4 action templates, verbatim, each tagged', () => {
    const LABEL: Record<string, Verdict> = {
      'Expected in space': 'EXPECTED',
      Watch: 'WATCH',
      Act: 'ACT',
    };
    for (const { file, entry } of signalEntries) {
      const def = SIGNALS[entry.signalIds[0] as SignalId];
      const lines = (section(entry, 'What to do')?.markdown ?? '').split('\n').filter((l) => l.trim() !== '');
      expect(lines.length, file).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, file).toMatch(/\[demo wording\]/);
        const m = /^- \*\*(.+?):\*\* (.+?) \[demo wording\]( \[SRC_[A-Z0-9_]+\])*$/.exec(line);
        expect(m, `${file}: ${line}`).not.toBeNull();
        const label = m?.[1] as string;
        const quoted = (m?.[2] as string).replace(/^"|"$/g, '');
        if (label in LABEL) {
          const v = LABEL[label] as Verdict;
          const expected = (def.actions[v] ?? GENERIC_ACTIONS[v]).text;
          expect(quoted, `${file}: ${label}`).toBe(expected);
        } else if (label === 'Poor reading quality') {
          expect(quoted).toBe(QUALITY_GATE_ACTION.text);
        } else if (label === 'Countermeasures') {
          // doc 07 §4.6 sleep countermeasures card, "[general, demo wording]".
          expect(def.id).toBe('sleep_duration');
          expect(quoted).toBe('light, schedule, noise, caffeine timing.');
        } else if (label === 'Vision change') {
          // doc 07 §4.17: "vision change → schedule Amsler/acuity now."
          expect(def.id).toBe('symptoms');
          expect(quoted).toBe('schedule Amsler/acuity now');
        } else {
          throw new Error(`${file}: unexpected "What to do" label ${label}`);
        }
      }
    }
  });

  it('face fluid-shift index is labeled experimental', () => {
    const e = signalEntries.find((x) => x.entry.signalIds.includes('face_fluid_index'))
      ?.entry as HandbookEntry;
    expect(e.experimental).toBe(true);
    expect(e.summary).toContain('Experimental — not validated');
    expect(section(e, 'What it is')?.markdown).toContain('Experimental — not validated');
  });

  it('near acuity states the amended space rule of doc 07 §4.11', () => {
    const e = signalEntries.find((x) => x.entry.signalIds.includes('near_acuity'))?.entry as HandbookEntry;
    const judge = section(e, 'How ARGUS judges it')?.markdown ?? '';
    expect(judge).toContain('up to 0.1 logMAR, corrected with glasses, is Expected in space');
    expect(judge).toContain('0.11–0.19 logMAR is Expected in space with or without glasses');
    expect(judge).toContain('0.2 logMAR or more is Watch [SRC_DEMO_RULE_BANDS]');
  });

  it('sleep entry carries the adaptation explanation verbatim', () => {
    const e = signalEntries.find((x) => x.entry.signalIds.includes('sleep_duration'))?.entry as HandbookEntry;
    expect(e.body).toContain(ADAPTATION_EXPLANATION);
  });
});

describe('hazard entries', () => {
  const HAZARDS: Hazard[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment'];
  it('one entry per NASA hazard, linking every signal tagged with that hazard', () => {
    const hazardEntries = byCategory('hazards');
    expect(hazardEntries.map((e) => e.entry.hazard).sort()).toEqual([...HAZARDS].sort());
    for (const { file, entry } of hazardEntries) {
      const tagged = signalList.filter((s) => s.hazard === entry.hazard).map((s) => s.id);
      expect([...entry.signalIds].sort(), file).toEqual([...tagged].sort());
      expect(entry.sourceIds, file).toContain('SRC_NASA_HAZARDS');
      expect(entry.sourceIds, file).toContain('SRC_NASA_RISKS');
    }
  });
});

describe('measurement entries', () => {
  it('has the five measurement flows', () => {
    expect(
      byCategory('measurements')
        .map((e) => e.entry.id)
        .sort(),
    ).toEqual(
      [
        'measure-camera-pulse',
        'measure-device-import',
        'measure-manual-vitals',
        'measure-reaction-test',
        'measure-vision-check',
      ].sort(),
    );
  });
  it('camera pulse shows the privacy line verbatim', () => {
    const e = ENTRIES.find((x) => x.entry.id === 'measure-camera-pulse')?.entry as HandbookEntry;
    expect(e.body).toContain('Video stays on this device. Only the number is saved.');
    for (const id of [
      'SRC_POS_WANG2017',
      'SRC_RPPG_KOSSACK',
      'SRC_MEDIAPIPE_FACE',
      'SRC_DEMO_QUALITY_SCORES',
    ]) {
      expect(e.sourceIds).toContain(id);
    }
  });
});

describe('about entries', () => {
  it('"How ARGUS judges a reading" gives the five verdict meanings of doc 07 §2 verbatim', () => {
    const e = ENTRIES.find((x) => x.entry.id === 'about-how-argus-judges')?.entry as HandbookEntry;
    for (const meaning of Object.values(VERDICT_MEANING)) expect(e.body).toContain(`"${meaning}"`);
    expect(e.body).toContain('Caught only by personal baseline');
  });
  it('"What is real and what is simulated" carries the not-a-medical-device statement of seed/limits.json', () => {
    const e = ENTRIES.find((x) => x.entry.id === 'about-real-vs-simulated')?.entry as HandbookEntry;
    expect(section(e, 'Not a medical device')?.markdown).toBe(limitsJson.notMedicalDevice);
  });
});

describe('protocol entries (generated from seed/protocols.json)', () => {
  it('one handbook entry per protocol, identical to a fresh rendering', () => {
    for (const p of protocols) {
      const f = FILES.find((x) => x.file === protocolFileName(p));
      expect(f, p.id).toBeDefined();
      expect(f?.markdown, `${p.id}: run npm run sync:seed`).toBe(renderProtocolMarkdown(p));
      const e = parseHandbookEntry(f?.markdown ?? '');
      expect(e.sourceIds).toEqual(protocolSourceIds(p));
    }
    expect(byCategory('protocols')).toHaveLength(protocols.length);
  });
});

describe('seed/handbook/index.json', () => {
  it('matches the markdown files (run npm run sync:seed if this fails)', () => {
    expect(serializeHandbookIndex(buildHandbookIndex(FILES))).toBe(
      serializeHandbookIndex(indexJson as never),
    );
  });
});

describe('banned wording', () => {
  it.each(FILES.map((f) => f.file))('%s has no banned wording', (file) => {
    const md = FILES.find((f) => f.file === file)?.markdown ?? '';
    expect(bannedHits(md)).toEqual([]);
  });
  it('protocols.json and limits.json have no banned wording', () => {
    for (const s of [...jsonStrings(protocolsJson), ...jsonStrings(limitsJson)]) {
      expect(bannedHits(s), s).toEqual([]);
    }
  });
  it('the banned list catches what it should', () => {
    for (const bad of [
      'You have an infection.',
      'This could diagnose',
      'prescribed',
      'Take 400 mg now',
      'take two tablets',
      'use ibuprofen',
      'Start treatment',
    ]) {
      expect(bannedHits(bad), bad).not.toEqual([]);
    }
    for (const ok of [
      '120 mg/dL',
      'Tell the CMO.',
      'a dose of 600 mSv',
      'Mars gravity is 3/8 g',
      'It is not a diagnostic device.',
    ]) {
      expect(bannedHits(ok), ok).toEqual([]);
    }
  });
});

describe('numbers guard', () => {
  it('every number in a handbook body carries a [SRC_…] tag in the same sentence or list item', () => {
    const problems: string[] = [];
    for (const { file, entry } of ENTRIES) {
      for (const s of entry.sections) {
        const allowDemo = DEMO_WORDING_SECTIONS.has(s.heading);
        for (const unit of textUnits(s.markdown)) {
          const bad = untaggedNumbers(unit, allowDemo);
          if (bad.length > 0) problems.push(`${file} § ${s.heading}: [${bad.join(', ')}] in "${unit}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
  it('the guard itself works', () => {
    expect(untaggedNumbers('Nominal at 95 % or more [SRC_NASA_RISKS].', false)).toEqual([]);
    expect(untaggedNumbers('Nominal at 95 % or more.', false)).toEqual(['95']);
    expect(untaggedNumbers('[SRC_NASA_RISKS] then 95 %.', false)).toEqual(['95']);
    expect(untaggedNumbers('- Rest 5 min. [demo wording]', true)).toEqual([]);
    expect(untaggedNumbers('- Rest 5 min. [demo wording]', false)).toEqual(['5']);
    expect(untaggedNumbers('1. Rest. [demo wording]', false)).toEqual([]);
    expect(untaggedNumbers('NASA-STD-3001 V2 6004 and S2 on mission day 143.', false)).toEqual([]);
    expect(textUnits('One 1 [SRC_NASA_RISKS]. Two 2.\n\n- item 3\n  more 4 [SRC_BONE_NASA]')).toEqual([
      'One 1 [SRC_NASA_RISKS].',
      'Two 2.',
      '- item 3 more 4 [SRC_BONE_NASA]',
    ]);
  });
});
