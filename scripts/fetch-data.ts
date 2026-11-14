// Downloads OSDR + NOAA + DONKI snapshots into seed/ (doc 12 §2, doc 10 §1/§8). Needs network; run once and commit.
//
//   npm run fetch:data
//
// Steps: (1) OSDR OSD-569 CBC + OSD-575 CMP via the OSDR file API → seed/osdr/*.csv, MANIFEST.md;
// (2) parse → seed/osdr/preflight-anchors.json (sex-specific ranges, subject → crew mapping by sex);
// (3) NOAA GOES 7-day integral protons → seed/radiation/goes-snapshot.json (>=10 and >=100 MeV only) and
//     seed/radiation/spe-replay.json (recorded event window, or the synthetic S2 profile of doc 10 §8);
// (4) DONKI SEP, last 365 days → seed/radiation/donki-sep-365.json.
// HTTP errors fail loudly: every failed step is printed in the summary and the process exits 1. A failed DONKI step
// still writes an explicit "unavailable" file (with the error in `note`) so the P0 outputs can be committed.
// No API key is stored: api.nasa.gov is only tried when NASA_API_KEY is set in the environment.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAnchors, mapSubjectsToCrew, type AnchorFile, type Sex } from './lib/osdr';
import { findEventWindow, isGoesSample, keepChannels, sliceWindow, syntheticS2Profile, type GoesSample } from './lib/spe';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OSDR_DIR = join(root, 'seed', 'osdr');
const RAD_DIR = join(root, 'seed', 'radiation');
const OSDR_BASE = 'https://osdr.nasa.gov';
const GOES_7D = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json';
const DONKI_CCMC = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP';
const DONKI_API = 'https://api.nasa.gov/DONKI/SEP';

const OSDR_FILES = [
  { study: 'OSD-569', pattern: /^LSDS-7_Complete_Blood_Count_CBC\.upload_SUBMITTED\.csv$/, out: 'OSD-569_CBC.csv' },
  { study: 'OSD-575', pattern: /^LSDS-8_Comprehensive_Metabolic_Panel_CMP\.upload_SUBMITTED\.csv$/, out: 'OSD-575_CMP.csv' },
] as const;

interface StepResult {
  step: string;
  ok: boolean;
  detail: string;
}
const results: StepResult[] = [];
const now = new Date();
const today = now.toISOString().slice(0, 10);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchOk(url: string, opts: { retries?: number; timeoutMs?: number } = {}): Promise<Response> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      return res;
    } catch (err) {
      lastErr = err;
      const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
      console.error(`  attempt ${attempt + 1}/${retries + 1} failed: ${String(err)}${cause}`);
      if (attempt < retries) await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const sha256 = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex');
const rel = (p: string): string => relative(root, p);
const writeJson = (path: string, data: unknown): void => writeFileSync(path, JSON.stringify(data, null, 1) + '\n');

// ---- (1)+(2) OSDR ----

interface OsdrStudyFiles {
  studies: Record<string, { study_files: Array<{ file_name: string; remote_url: string; file_size?: number }> }>;
}

async function stepOsdr(): Promise<void> {
  mkdirSync(OSDR_DIR, { recursive: true });
  const manifest: Array<{ study: string; file: string; savedAs: string; url: string; bytes: number; sha256: string }> = [];
  const texts: Record<string, string> = {};
  for (const f of OSDR_FILES) {
    const num = f.study.replace('OSD-', '');
    console.log(`OSDR: listing files of ${f.study}`);
    const list = (await (await fetchOk(`${OSDR_BASE}/osdr/data/osd/files/${num}`)).json()) as OsdrStudyFiles;
    const files = list.studies?.[f.study]?.study_files;
    if (!Array.isArray(files)) throw new Error(`OSDR API: unexpected shape for ${f.study} (no study_files[])`);
    const hit = files.find((x) => f.pattern.test(x.file_name));
    if (!hit) throw new Error(`OSDR API: ${f.study} has no file matching ${f.pattern}`);
    const url = `${OSDR_BASE}${hit.remote_url}`;
    console.log(`OSDR: downloading ${hit.file_name}`);
    const buf = Buffer.from(await (await fetchOk(url)).arrayBuffer());
    const out = join(OSDR_DIR, f.out);
    writeFileSync(out, buf);
    texts[f.study] = buf.toString('utf8');
    manifest.push({ study: f.study, file: hit.file_name, savedAs: rel(out), url, bytes: buf.length, sha256: sha256(buf) });
    results.push({ step: `OSDR ${f.study}`, ok: true, detail: `${rel(out)} ${buf.length} B` });
  }

  const cbc = texts['OSD-569'];
  if (!cbc) throw new Error('OSD-569 CBC text missing');
  const parsed = buildAnchors(cbc, texts['OSD-575'] ?? null);

  const crewJson = JSON.parse(readFileSync(join(root, 'seed', 'crew.json'), 'utf8')) as {
    crew: Array<{ id: string; sex: Sex; osdrSubject?: string }>;
  };
  const mapping = mapSubjectsToCrew(crewJson.crew, parsed.subjects);
  const changed = mapping.filter((m) => m.changed);

  const anchorFile: AnchorFile = {
    _note:
      'Generated by scripts/fetch-data.ts from the NASA OSDR long-format lab files. Pre-flight time points only (L-92, L-44, L-3). ' +
      'Sex comes from the SEX column; preflightHematocritRangeSex says which sex-specific range the lab printed pre-flight. ' +
      'crewMapping assigns subjects to the fictional crew by sex (doc 06 §6); it implies nothing about the real Inspiration4 crew.',
    label: 'Pre-flight values from NASA OSDR OSD-569 (anonymised commercial crew data)',
    sourceIds: ['SRC_OSD569', 'SRC_OSD575'],
    downloadedAt: now.toISOString(),
    files: { cbc: 'seed/osdr/OSD-569_CBC.csv', cmp: 'seed/osdr/OSD-575_CMP.csv' },
    glucosePresent: parsed.glucosePresent,
    glucoseNote: parsed.glucosePresent
      ? 'OSD-575 CMP has a GLUCOSE analyte (mg/dL); pre-flight values are used as fasting-glucose anchors (doc 07 §4.5). The dataset does not state whether the draws were fasting.'
      : 'OSD-575 CMP has no GLUCOSE analyte; glucose stays fully simulated.',
    units: {
      hematocrit: '%',
      wbc: '10*3/uL',
      hemoglobin: 'g/dL',
      lymphocytes: '%',
      lymphocytesAbsolute: 'cells/uL',
      glucose: 'mg/dL',
    },
    rangesBySex: parsed.rangesBySex,
    subjects: parsed.subjects,
    crewMapping: mapping.map(({ crewId, crewSex, subject }) => ({ crewId, crewSex, subject })),
    anchors: parsed.anchors,
  };
  const anchorsPath = join(OSDR_DIR, 'preflight-anchors.json');
  writeJson(anchorsPath, anchorFile);
  results.push({
    step: 'OSDR anchors',
    ok: true,
    detail: `${parsed.anchors.length} anchors, glucose ${parsed.glucosePresent ? 'present' : 'absent'}`,
  });

  for (const s of parsed.subjects) {
    console.log(
      `OSDR: ${s.subject} SEX=${s.sex} pre-flight Hct range=${s.preflightHematocritRangeSex}` +
        `${s.rangeConsistent ? '' : '  <-- printed pre-flight range does not match SEX column'}`,
    );
  }
  for (const m of mapping) console.log(`OSDR: crew ${m.crewId} (${m.crewSex}) → ${m.subject}${m.changed ? '  (re-mapped)' : ''}`);
  if (changed.length > 0) {
    console.error(
      `OSDR: seed/crew.json osdrSubject must be updated for ${changed.map((c) => `${c.crewId}→${c.subject}`).join(', ')} ` +
        '(edit only those values by hand; this script does not rewrite crew.json).',
    );
    results.push({ step: 'crew.json mapping', ok: false, detail: `needs re-map: ${changed.map((c) => `${c.crewId}→${c.subject}`).join(', ')}` });
  } else {
    results.push({ step: 'crew.json mapping', ok: true, detail: mapping.map((m) => `${m.crewId}→${m.subject}`).join(' ') });
  }

  const md = [
    '# seed/osdr — MANIFEST',
    '',
    `Downloaded ${now.toISOString()} by \`scripts/fetch-data.ts\` (\`npm run fetch:data\`).`,
    'File list from the OSDR API `https://osdr.nasa.gov/osdr/data/osd/files/<n>` (`studies["OSD-<n>"].study_files[]`,',
    '`remote_url` relative to `https://osdr.nasa.gov`). The long-format `*.upload_SUBMITTED.csv` file was chosen because it',
    'carries the reference-range columns (`RANGE_MIN`, `RANGE_MAX`) together with `SEX` and the time point on every row.',
    '',
    '| Study | Original file name | Saved as | Bytes | SHA-256 |',
    '|-------|--------------------|----------|-------|---------|',
    ...manifest.map((m) => `| ${m.study} | \`${m.file}\` | \`${m.savedAs}\` | ${m.bytes} | \`${m.sha256}\` |`),
    '',
    'Derived: `seed/osdr/preflight-anchors.json` (pre-flight time points L-92, L-44, L-3 only).',
    '',
    '## Credits',
    '',
    '- NASA Open Science Data Repository (OSDR), OSD-569 "Inspiration4 complete blood count" and OSD-575 "Inspiration4',
    '  metabolic and cytokine panels" — https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 and',
    '  https://osdr.nasa.gov/bio/repo/data/studies/OSD-575. Open NASA data; anonymised commercial crew subjects C001–C004.',
    '- ARGUS uses only the pre-flight values, as anchors for four fictional crew members; the mapping implies nothing about',
    '  the real crew.',
    '',
  ].join('\n');
  writeFileSync(join(OSDR_DIR, 'MANIFEST.md'), md);
}

// ---- (3) NOAA ----

async function stepNoaa(): Promise<void> {
  mkdirSync(RAD_DIR, { recursive: true });
  console.log('NOAA: downloading GOES integral protons 7-day');
  const raw: unknown = await (await fetchOk(GOES_7D)).json();
  if (!Array.isArray(raw) || !raw.every(isGoesSample)) throw new Error('NOAA: unexpected JSON shape');
  const all = raw as GoesSample[];
  const data = keepChannels(all);
  const p10 = data.filter((d) => d.energy === '>=10 MeV');
  const max10 = Math.max(...p10.map((d) => d.flux));
  writeJson(join(RAD_DIR, 'goes-snapshot.json'), {
    capturedAt: now.toISOString(),
    source: GOES_7D,
    sourceIds: ['SRC_NOAA_SWPC_PROTONS'],
    note: 'NOAA SWPC GOES primary integral protons, 7-day file; only the >=10 MeV and >=100 MeV channels are kept.',
    channels: ['>=10 MeV', '>=100 MeV'],
    data,
  });
  results.push({ step: 'NOAA snapshot', ok: true, detail: `${data.length} samples (of ${all.length}), max >=10 MeV ${max10.toFixed(3)} pfu` });

  const win = findEventWindow(data);
  const replayPath = join(RAD_DIR, 'spe-replay.json');
  if (win) {
    writeJson(replayPath, {
      synthetic: false,
      label: `REPLAY — NOAA SWPC GOES, captured ${today}`,
      source: `NOAA SWPC GOES, captured ${today}`,
      sourceIds: ['SRC_NOAA_SWPC_PROTONS'],
      capturedAt: now.toISOString(),
      window: win,
      data: sliceWindow(data, win.from, win.to),
    });
    results.push({ step: 'SPE replay', ok: true, detail: `recorded event, peak ${win.peakPfu.toFixed(1)} pfu` });
  } else {
    const start = `${today}T00:00:00Z`;
    writeJson(replayPath, {
      synthetic: true,
      label: 'REPLAY — synthetic S2-class profile (demo), not a recorded event',
      source: 'Synthetic profile of docs/10_RADIATION.md §8 (demo parameters)',
      sourceIds: ['SRC_DEMO_RADIATION_MODEL'],
      capturedAt: now.toISOString(),
      note: `No >=10 MeV sample reached 10 pfu in the GOES 7-day file captured ${today} (max ${max10.toFixed(3)} pfu); synthetic profile written instead.`,
      profile: { durationHours: 36, stepMinutes: 5, p10: { backgroundPfu: 0.2, peakPfu: 150, peakAtHours: 3 }, p100: { backgroundPfu: 0.15, peakPfu: 0.8, peakAtHours: 3 }, riseStartHours: 0.5, decayEfoldHours: 10 },
      data: syntheticS2Profile(start),
    });
    results.push({ step: 'SPE replay', ok: true, detail: `no event (max ${max10.toFixed(3)} pfu) → synthetic S2 profile` });
  }
}

// ---- (4) DONKI ----

interface DonkiSep {
  sepID: string;
  eventTime: string;
  instruments?: Array<{ displayName?: string } | string>;
  linkedEvents?: Array<{ activityID: string }> | null;
  link?: string;
}

async function stepDonki(): Promise<void> {
  mkdirSync(RAD_DIR, { recursive: true });
  const end = today;
  const start = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const out = join(RAD_DIR, 'donki-sep-365.json');
  const urls = [`${DONKI_CCMC}?startDate=${start}&endDate=${end}`];
  const key = process.env.NASA_API_KEY;
  if (key) urls.push(`${DONKI_API}?startDate=${start}&endDate=${end}&api_key=${key}`);
  const errors: string[] = [];
  for (const url of urls) {
    const shown = url.replace(/api_key=[^&]+/, 'api_key=***');
    try {
      console.log(`DONKI: GET ${shown}`);
      const text = await (await fetchOk(url, { retries: 3, timeoutMs: 30_000 })).text();
      const raw: unknown = text.trim() === '' ? [] : JSON.parse(text);
      if (!Array.isArray(raw)) throw new Error('DONKI: response is not an array');
      const events = (raw as DonkiSep[]).map((e) => ({
        id: e.sepID,
        eventTime: e.eventTime,
        instruments: (e.instruments ?? []).map((i) => (typeof i === 'string' ? i : (i.displayName ?? ''))).filter(Boolean),
        linkedEvents: (e.linkedEvents ?? []).map((l) => l.activityID),
        link: e.link,
      }));
      writeJson(out, {
        status: 'ok',
        fetchedAt: now.toISOString(),
        startDate: start,
        endDate: end,
        source: shown.replace(/\?.*$/, ''),
        sourceIds: ['SRC_DONKI'],
        events,
      });
      results.push({ step: 'DONKI SEP 365 d', ok: true, detail: `${events.length} events` });
      return;
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
      errors.push(`${shown}: ${String(err)}${cause}`);
    }
  }
  writeJson(out, {
    status: 'unavailable',
    fetchedAt: now.toISOString(),
    startDate: start,
    endDate: end,
    sourceIds: ['SRC_DONKI'],
    note: `DONKI could not be downloaded on ${today}: ${errors.join(' | ')}. This list is empty because the download failed, not because no SEP events occurred. Re-run npm run fetch:data when the service answers.`,
    events: [],
  });
  throw new Error(errors.join(' | '));
}

// ---- main ----

async function run(step: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`FAILED ${step}: ${String(err)}`);
    results.push({ step, ok: false, detail: String(err).slice(0, 160) });
  }
}

await run('OSDR', stepOsdr);
await run('NOAA', stepNoaa);
await run('DONKI SEP 365 d', stepDonki);

console.log('\nfetch:data summary');
console.log('| step | result | detail |');
console.log('|------|--------|--------|');
for (const r of results) console.log(`| ${r.step} | ${r.ok ? 'ok' : 'FAILED'} | ${r.detail} |`);
if (results.some((r) => !r.ok)) {
  console.error('\nfetch:data: at least one step FAILED (see above).');
  process.exit(1);
}
