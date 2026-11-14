// Unit tests for the handbook content module: parser, inline tags, search, protocols, triggers, limits, loaders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import indexJson from '../../../../seed/handbook/index.json';
import { SYMPTOM_KEYS } from '../../../domain/signals/symptoms';
import {
  ContentValidationError,
  HandbookLoadError,
  HandbookParseError,
  PROTOCOL_IDS,
  SEND_TO_SURGEON_TEXT,
  clearHandbookCache,
  evaluateTrigger,
  getProtocol,
  limits,
  loadHandbookEntry,
  loadHandbookIndex,
  parseHandbookEntry,
  parseHandbookIndex,
  protocols,
  searchHandbook,
  splitInlineTags,
  stripInlineTags,
  tokenize,
} from './index';
import type { HandbookIndexItem } from './index';
import { validateLimits, validateProtocols } from './validate';

const INDEX = indexJson.entries as HandbookIndexItem[];

describe('parseHandbookEntry', () => {
  const md = [
    '\uFEFF---',
    '# a comment',
    'id: sample-entry',
    'title: "Sample: entry"',
    'category: signals',
    'order: 3',
    'signalIds: [heart_rate_rest, not_a_signal]',
    "keywords: [Heart Rate, 'pulse']",
    'sourceIds: [SRC_NASA_RISKS]',
    'summary: One line: with a colon.',
    'mystery: 1',
    '---',
    '',
    '## What it is',
    '',
    'Text [SRC_NASA_RISKS].',
    '',
    '### Not a section',
    '## Sources',
    '- [SRC_NASA_RISKS]',
  ].join('\r\n');

  it('parses front matter tolerantly (BOM, CRLF, quotes, comments, colons in values)', () => {
    const e = parseHandbookEntry(md);
    expect(e.id).toBe('sample-entry');
    expect(e.title).toBe('Sample: entry');
    expect(e.category).toBe('signals');
    expect(e.order).toBe(3);
    expect(e.signalIds).toEqual(['heart_rate_rest']);
    expect(e.keywords).toEqual(['heart rate', 'pulse']);
    expect(e.summary).toBe('One line: with a colon.');
    expect(e.warnings).toEqual(['unknown front-matter key "mystery"', 'unknown signal id "not_a_signal"']);
  });

  it('splits ## sections (### stays inside its section)', () => {
    const e = parseHandbookEntry(md);
    expect(e.sections.map((s) => s.heading)).toEqual(['What it is', 'Sources']);
    expect(e.sections[0]?.slug).toBe('what-it-is');
    expect(e.sections[0]?.markdown).toBe('Text [SRC_NASA_RISKS].\n\n### Not a section');
  });

  it('throws HandbookParseError when id/title/category are missing or invalid', () => {
    expect(() => parseHandbookEntry('no front matter')).toThrow(HandbookParseError);
    expect(() => parseHandbookEntry('---\ntitle: x\ncategory: about\n---\n')).toThrow(/no "id"/);
    expect(() => parseHandbookEntry('---\nid: x\ncategory: about\n---\n')).toThrow(/no "title"/);
    expect(() => parseHandbookEntry('---\nid: x\ntitle: X\ncategory: recipes\n---\n')).toThrow(
      /invalid category/,
    );
  });
});

describe('inline tags', () => {
  it('splits text, source tags and demo-wording tags', () => {
    expect(splitInlineTags('Rest 5 min [demo wording] and 3 mmHg [SRC_STD3001_CO2].')).toEqual([
      { kind: 'text', text: 'Rest 5 min ' },
      { kind: 'demo-wording' },
      { kind: 'text', text: ' and 3 mmHg ' },
      { kind: 'source', id: 'SRC_STD3001_CO2' },
      { kind: 'text', text: '.' },
    ]);
    expect(stripInlineTags('Limit 3 mmHg [SRC_STD3001_CO2]. Rest. [demo wording]')).toBe(
      'Limit 3 mmHg. Rest.',
    );
  });
});

describe('searchHandbook', () => {
  it('tokenizes with stopwords, subscripts and light stemming', () => {
    expect(tokenize('What should I do about my sleep?')).toEqual(['sleep']);
    expect(tokenize('CO₂ headaches')).toEqual(['co2', 'headache']);
  });

  it('"sleep" returns the sleep entry first', () => {
    expect(searchHandbook(INDEX, 'sleep')[0]?.id).toBe('sleep');
    expect(searchHandbook(INDEX, 'What should I do about my sleep?')[0]?.id).toBe('sleep');
  });

  it('"headache" returns the CO₂ protocol and the cabin CO₂ entry at the top', () => {
    const top = searchHandbook(INDEX, 'headache', { limit: 3 }).map((e) => e.id);
    expect(['protocol-co2-headache', 'cabin-co2']).toContain(top[0]);
    expect(top).toContain('protocol-co2-headache');
    expect(top).toContain('cabin-co2');
  });

  it.each([
    ['pulse', 'heart-rate'],
    ['blood pressure', 'blood-pressure'],
    ['radiation storm', 'hazard-radiation'],
    ['co2', 'cabin-co2'],
    ['my eyes are blurry', 'near-acuity'],
    ['tired', 'sleep'],
  ])('"%s" finds %s in the top 3', (query, id) => {
    expect(searchHandbook(INDEX, query, { limit: 3 }).map((e) => e.id)).toContain(id);
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(searchHandbook(INDEX, '')).toEqual([]);
    expect(searchHandbook(INDEX, 'what should I do')).toEqual([]);
    expect(searchHandbook(INDEX, 'zebra')).toEqual([]);
  });
});

describe('protocols', () => {
  it('has exactly the five ProtocolIds in doc 07 §5 table order', () => {
    expect(protocols.map((p) => p.id)).toEqual([
      'suspected-infection',
      'spe-shelter',
      'co2-headache',
      'vision-change',
      'sleep-debt',
    ]);
    expect(PROTOCOL_IDS).toEqual(protocols.map((p) => p.id));
  });

  it('every step has a tag, source tags carry sources, demo wording carries none', () => {
    for (const p of protocols) {
      expect(p.steps.length).toBeGreaterThanOrEqual(4);
      expect(p.steps.length).toBeLessThanOrEqual(8);
      for (const s of p.steps) {
        expect(['source', 'demo wording']).toContain(s.tag);
        if (s.tag === 'source') expect(s.sourceIds.length).toBeGreaterThan(0);
        else expect(s.sourceIds).toEqual([]);
      }
      const last = p.steps.at(-1);
      expect(last?.kind).toBe('send-to-surgeon');
      expect(last?.text).toBe(SEND_TO_SURGEON_TEXT);
      expect(last?.tag).toBe('demo wording');
    }
  });

  it('timers only where doc 07 §5 states a time (2 h, 1 h)', () => {
    const timers = protocols.flatMap((p) =>
      p.steps.filter((s) => s.timerSec !== undefined).map((s) => [p.id, s.timerSec]),
    );
    expect(timers).toEqual([
      ['suspected-infection', 7200],
      ['co2-headache', 3600],
    ]);
  });

  it('steps render the table fragments of doc 07 §5 in order', () => {
    const table: Record<string, string[]> = {
      'suspected-infection': [
        'rest',
        're-measure HR & temp in 2 h',
        'hydrate',
        'isolate shared items',
        'log symptoms',
        'notify surgeon',
      ],
      'spe-shelter': [
        'move to shelter location',
        'wear dosimeter',
        'reduce EVA',
        'log time-in-shelter',
        'follow Earth radiation team instructions [SRC_STD3001_RAD ALARA]',
      ],
      'co2-headache': [
        'check CO₂ panel',
        'ventilate sleep station/improve airflow',
        'hydrate',
        're-check in 1 h [SRC_NASA_CO2_PAGE]',
      ],
      'vision-change': [
        'repeat test each eye',
        'use anticipation glasses if issued',
        'schedule imaging exam',
        'notify surgeon [SRC_VISION_ISS]',
      ],
      'sleep-debt': [
        'protect next sleep window',
        'light/schedule hygiene',
        'avoid critical tasks if lapses high',
        're-test [SRC_SLEEP_BARGER]',
      ],
    };
    for (const p of protocols) {
      expect(p.steps.map((s) => s.tableText).filter((t) => t !== null)).toEqual(table[p.id]);
    }
  });

  it('getProtocol finds by id', () => {
    expect(getProtocol('sleep-debt').title).toBe('Sleep debt');
  });

  it('validation rejects malformed files', () => {
    const good = structuredClone(validateProtocols({ _note: 'n', protocols: [...protocols] }));
    expect(() => validateProtocols({ _note: 'n', protocols: good.protocols.slice(1) })).toThrow(
      ContentValidationError,
    );
    const reordered = {
      _note: 'n',
      protocols: [good.protocols[1], good.protocols[0], ...good.protocols.slice(2)],
    };
    expect(() => validateProtocols(reordered)).toThrow(/in this order/);
    const badTag = structuredClone(good);
    (badTag.protocols[0]?.steps[0] as { tag: string }).tag = 'vibes';
    expect(() => validateProtocols(badTag)).toThrow(/invalid tag/);
    const sourced = structuredClone(good);
    sourced.protocols[0]?.steps[0]?.sourceIds.push('SRC_DEMO_RULE_BANDS');
    expect(() => validateProtocols(sourced)).toThrow(/carries no source/);
    const noEnd = structuredClone(good);
    noEnd.protocols[0]?.steps.pop();
    expect(() => validateProtocols(noEnd)).toThrow(/send-to-surgeon/);
    const badRule = structuredClone(good) as unknown as { protocols: Array<{ triggerRule: unknown }> };
    (badRule.protocols[0] as { triggerRule: unknown }).triggerRule = { any: [{ symptom: 'fever' }] };
    expect(() => validateProtocols(badRule)).toThrow(/unknown symptom/);
  });
});

describe('evaluateTrigger', () => {
  const rule = (id: string) =>
    protocols.find((p) => p.id === id)?.triggerRule as Parameters<typeof evaluateTrigger>[0];

  it('suspected infection: HR personal ≥ WATCH + temp ≥ WATCH, or rash', () => {
    const r = rule('suspected-infection');
    expect(
      evaluateTrigger(r, {
        verdicts: { heart_rate_rest: { personal: 'WATCH' }, body_temp: { combined: 'WATCH' } },
      }),
    ).toBe(true);
    expect(
      evaluateTrigger(r, {
        verdicts: { heart_rate_rest: { personal: 'ACT' }, body_temp: { combined: 'ACT' } },
      }),
    ).toBe(true);
    expect(
      evaluateTrigger(r, {
        verdicts: { heart_rate_rest: { combined: 'ACT' }, body_temp: { combined: 'WATCH' } },
      }),
    ).toBe(false);
    expect(evaluateTrigger(r, { verdicts: { heart_rate_rest: { personal: 'WATCH' } } })).toBe(false);
    expect(evaluateTrigger(r, { symptoms: ['rash'] })).toBe(true);
    expect(evaluateTrigger(r, {})).toBe(false);
  });

  it('SPE shelter: S2 or higher, or the ≥100 MeV alert', () => {
    const r = rule('spe-shelter');
    expect(evaluateTrigger(r, { spaceWeather: { sScale: 1 } })).toBe(false);
    expect(evaluateTrigger(r, { spaceWeather: { sScale: 2 } })).toBe(true);
    expect(evaluateTrigger(r, { spaceWeather: { sScale: 0, s100Alert: true } })).toBe(true);
  });

  it('CO₂ headache: headache + 7-day average ≥ 2.5 mmHg', () => {
    const r = rule('co2-headache');
    expect(evaluateTrigger(r, { symptoms: ['headache'], cabin: { co2Avg7dMmHg: 2.5 } })).toBe(true);
    expect(evaluateTrigger(r, { symptoms: ['headache'], cabin: { co2Avg7dMmHg: 2.4 } })).toBe(false);
    expect(evaluateTrigger(r, { cabin: { co2Avg7dMmHg: 4 } })).toBe(false);
  });

  it('vision change: Amsler space WATCH (new cells) or acuity WATCH', () => {
    const r = rule('vision-change');
    expect(evaluateTrigger(r, { verdicts: { amsler: { space: 'WATCH' } } })).toBe(true);
    expect(evaluateTrigger(r, { verdicts: { near_acuity: { combined: 'WATCH' } } })).toBe(true);
    expect(evaluateTrigger(r, { verdicts: { near_acuity: { combined: 'EXPECTED' } } })).toBe(false);
  });

  it('sleep debt: sleep WATCH + reaction WATCH', () => {
    const r = rule('sleep-debt');
    expect(
      evaluateTrigger(r, {
        verdicts: { sleep_duration: { combined: 'WATCH' }, reaction_test: { combined: 'ACT' } },
      }),
    ).toBe(true);
    expect(
      evaluateTrigger(r, {
        verdicts: { sleep_duration: { combined: 'EXPECTED' }, reaction_test: { combined: 'WATCH' } },
      }),
    ).toBe(false);
    expect(evaluateTrigger(r, { verdicts: { sleep_duration: { combined: 'NO_DATA' } } })).toBe(false);
  });

  it('symptom keys used by triggers exist in the checklist', () => {
    expect(SYMPTOM_KEYS).toContain('rash');
    expect(SYMPTOM_KEYS).toContain('headache');
  });
});

describe('limits', () => {
  it('covers every data kind and the required rows', () => {
    const ids = limits.dataKinds.map((r) => r.id);
    for (const id of [
      'noaa-goes-protons',
      'nasa-donki-events',
      'osdr-preflight-blood',
      'published-limits',
      'camera-pulse',
      'reaction-test',
      'manual-entries',
      'crew-readings',
      'cabin-sensors',
      'career-doses',
      'gcr-dose-rates',
      'spe-dose',
      'shelter-advisory',
      'spe-replay',
      'comms-delay',
      'readiness',
      'rule-bands',
      'baseline-constants',
      'face-fluid-index',
      'respiration',
    ]) {
      expect(ids).toContain(id);
    }
    expect(limits.dataKinds.find((r) => r.id === 'nasa-donki-events')?.availability).toBe('unavailable');
    expect(limits.dataKinds.find((r) => r.id === 'respiration')?.availability).toBe('not-built');
    expect(limits.dataKinds.find((r) => r.id === 'comms-delay')?.detail).toContain('Modeled delay (demo)');
  });

  it('has the honest rPPG default, the statement and the doc 01 §7 non-goals', () => {
    expect(limits.rppgValidation).toEqual({
      done: false,
      placeholder: 'No paired validation against a reference device has been done yet.',
    });
    expect(limits.notMedicalDevice).toContain('not a diagnostic or certified medical device');
    expect(limits.nonGoals).toHaveLength(4);
    expect(limits.knownGaps.length).toBeGreaterThanOrEqual(5);
  });

  it('validation rejects malformed files', () => {
    expect(() =>
      validateLimits({ ...limits, dataKinds: limits.dataKinds.filter((r) => r.kind !== 'demo') }),
    ).toThrow(/no row of kind "demo"/);
    expect(() =>
      validateLimits({ ...limits, dataKinds: [{ ...limits.dataKinds[0], kind: 'vibes' }] }),
    ).toThrow(ContentValidationError);
  });
});

describe('loaders', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const SLEEP_MD =
    '---\nid: sleep\ntitle: Sleep duration\ncategory: signals\nsummary: s\n---\n\n## What it is\n\nx\n';

  beforeEach(() => {
    clearHandbookCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the index and an entry through assetUrl (base-relative, never an absolute /seed path)', async () => {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith('seed/handbook/index.json')) return new Response(JSON.stringify(indexJson));
      if (u.endsWith('seed/handbook/sleep.md')) return new Response(SLEEP_MD);
      return new Response('nope', { status: 404 });
    });
    const index = await loadHandbookIndex();
    expect(index.length).toBe(INDEX.length);
    const entry = await loadHandbookEntry('sleep');
    expect(entry.title).toBe('Sleep duration');
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      `${import.meta.env.BASE_URL}seed/handbook/index.json`,
      `${import.meta.env.BASE_URL}seed/handbook/sleep.md`,
    ]);
    await loadHandbookEntry('sleep');
    expect(fetchMock).toHaveBeenCalledTimes(2); // cached
  });

  it('rejects unknown ids and failed requests, and retries the index after a failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 503 }));
    await expect(loadHandbookIndex()).rejects.toThrow(HandbookLoadError);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(indexJson)));
    await expect(loadHandbookEntry('no-such-entry')).rejects.toThrow(/no handbook entry/);
  });

  it('parseHandbookIndex checks the shape', () => {
    expect(() => parseHandbookIndex({})).toThrow(HandbookLoadError);
    expect(() => parseHandbookIndex({ entries: [{ id: 'x' }] })).toThrow(/invalid shape/);
    expect(parseHandbookIndex(indexJson)).toHaveLength(INDEX.length);
  });
});
