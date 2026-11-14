import { describe, expect, it } from 'vitest';

import crewJson from '../../../seed/crew.json';
import missionsJson from '../../../seed/missions.json';
import replayJson from '../../../seed/radiation/spe-replay.json';
import snapshotJson from '../../../seed/radiation/goes-snapshot.json';
import type { CrewMember, MissionProfile, ProtonSample } from '../types';
import {
  ALARA_NOTE,
  computeDoseLedger,
  daysElapsed,
  debouncedS100Alert,
  debouncedSScale,
  mergeSamples,
  parseGoesProtons,
  sLevelOf,
  shelterAdvisory,
  SHELTER_CLOSING,
  speDoseRateMsvPerH,
  speSummaryAt,
  speTimeline,
  buildReplayProfile,
  replayIndexAt,
  eventElapsedMs,
  protons100UpTo,
  SYNTHETIC_REPLAY_WORDS,
} from './index';

const profiles = (missionsJson as { profiles: MissionProfile[] }).profiles;
const crew = (crewJson as unknown as { crew: CrewMember[] }).crew;
const profile = (id: string): MissionProfile => profiles.find((p) => p.id === id) as MissionProfile;
const member = (id: string): CrewMember => crew.find((c) => c.id === id) as CrewMember;

const T0 = Date.parse('2026-11-14T00:00:00Z');
const at = (i: number) => new Date(T0 + i * 300_000).toISOString();
const series = (fluxes: number[], energy = '>=10 MeV'): ProtonSample[] =>
  fluxes.map((f, i) => ({ timeTag: at(i), energy, fluxPfu: f }));
const r1 = (x: number) => Math.round(x * 10) / 10;

describe('parseGoesProtons (doc 10 §1)', () => {
  it('drops missing / negative / zero / non-numeric flux, dedupes satellites, sorts by time', () => {
    const raw = [
      { time_tag: '2026-11-14T00:10:00Z', satellite: 18, flux: 0.3, energy: '>=10 MeV' },
      { time_tag: '2026-11-14T00:00:00Z', satellite: 18, flux: 0.2, energy: '>=10 MeV' },
      { time_tag: '2026-11-14T00:00:00Z', satellite: 19, flux: 9.9, energy: '>=10 MeV' }, // secondary duplicate
      { time_tag: '2026-11-14T00:05:00Z', satellite: 18, flux: -1e5, energy: '>=10 MeV' },
      { time_tag: '2026-11-14T00:05:00Z', satellite: 18, flux: null, energy: '>=100 MeV' },
      { time_tag: '2026-11-14T00:15:00Z', satellite: 18, flux: 0, energy: '>=10 MeV' },
      { time_tag: '2026-11-14T00:20:00', satellite: 18, flux: '0.4', energy: '>=10 MeV' }, // no zone, string flux
      { time_tag: 'garbage', satellite: 18, flux: 1, energy: '>=10 MeV' },
      { time_tag: '2026-11-14T00:00:00Z', satellite: 18, flux: 0.15, energy: '>=100 MeV' },
      { time_tag: '2026-11-14T00:00:00Z', satellite: 18, flux: 2, energy: '>=1 MeV' },
      'not a row',
    ];
    const { protons10, protons100 } = parseGoesProtons(raw);
    expect(protons10.map((s) => [s.timeTag.slice(11, 16), s.fluxPfu, s.satellite])).toEqual([
      ['00:00', 0.2, 18],
      ['00:10', 0.3, 18],
      ['00:20', 0.4, 18],
    ]);
    expect(protons100.map((s) => s.fluxPfu)).toEqual([0.15]);
    expect(parseGoesProtons({ error: 'x' })).toEqual({ protons10: [], protons100: [] });
  });

  it('parses the bundled GOES snapshot (2 channels, 5-min, quiet sun)', () => {
    const { protons10, protons100 } = parseGoesProtons((snapshotJson as { data: unknown }).data);
    expect(protons10.length).toBeGreaterThan(1900);
    expect(protons100.length).toBeGreaterThan(1900);
    expect(debouncedSScale(protons10)).toBe(0);
    expect(debouncedS100Alert(protons100)).toBe(false);
  });

  it('mergeSamples keeps the newer value per time tag and trims to a window', () => {
    const a = series([1, 2, 3]);
    const b = [
      { ...a[2]!, fluxPfu: 30 },
      { timeTag: at(3), energy: '>=10 MeV', fluxPfu: 4 },
    ];
    expect(mergeSamples(a, b).map((s) => s.fluxPfu)).toEqual([1, 2, 30, 4]);
    expect(mergeSamples(a, b, at(2)).map((s) => s.fluxPfu)).toEqual([30, 4]);
  });
});

describe('S scale (doc 10 §2)', () => {
  it('threshold edges 10 / 100 / 1,000 / 10,000 / 100,000 pfu', () => {
    const cases: Array<[number, number]> = [
      [9.999, 0],
      [10, 1],
      [99.99, 1],
      [100, 2],
      [999, 2],
      [1000, 3],
      [9999, 3],
      [10000, 4],
      [99999, 4],
      [100000, 5],
      [1e7, 5],
    ];
    for (const [f, s] of cases) expect([f, sLevelOf(f)]).toEqual([f, s]);
  });

  it('debounce: 2 points ≥ threshold → not yet; 3 → yes; a dip resets', () => {
    expect(debouncedSScale(series([1, 12, 12]))).toBe(0);
    expect(debouncedSScale(series([12, 12, 12]))).toBe(1);
    expect(debouncedSScale(series([12, 12, 12, 9]))).toBe(0);
    expect(debouncedSScale(series([12, 12, 12, 9, 12, 12]))).toBe(0);
    expect(debouncedSScale(series([12, 12, 12, 9, 12, 12, 12]))).toBe(1);
    expect(debouncedSScale(series([150, 150, 99]))).toBe(1); // min of the last three decides the level
    expect(debouncedSScale(series([150, 150, 150]))).toBe(2);
    expect(debouncedSScale(series([20, 20]))).toBe(0); // fewer than 3 samples
    expect(debouncedSScale(series([12, 12, 12, 1]), 2)).toBe(1); // at an earlier index
  });

  it('s100Alert: ≥100 MeV ≥ 1 pfu on 3 consecutive samples', () => {
    expect(debouncedS100Alert(series([1, 1, 0.99], '>=100 MeV'))).toBe(false);
    expect(debouncedS100Alert(series([0.5, 1, 1], '>=100 MeV'))).toBe(false);
    expect(debouncedS100Alert(series([1, 1, 1], '>=100 MeV'))).toBe(true);
    expect(debouncedS100Alert(series([1, 1, 1, 0.8], '>=100 MeV'))).toBe(false);
  });
});

describe('modeled SPE dose (doc 10 §5)', () => {
  it('rate = 0.05 × flux≥100 × shieldFactor', () => {
    expect(speDoseRateMsvPerH(0.8)).toBeCloseTo(0.04, 10);
    expect(speDoseRateMsvPerH(2, 0.3)).toBeCloseTo(0.03, 10);
  });

  it('no dose outside an event: quiet background 0.15 pfu for a day adds nothing', () => {
    const n = 288;
    const t = speTimeline(series(Array(n).fill(0.2)), series(Array(n).fill(0.15), '>=100 MeV'));
    expect(t.events).toEqual([]);
    expect(speSummaryAt(t).totalMsv).toBe(0);
  });

  it('integrates only while the debounced event is active, per event and in total', () => {
    // S1 for samples 2..6 (debounced from index 4), back to S0 at index 7; a second event later.
    const f10 = [1, 1, 12, 12, 12, 12, 12, 1, 1, 12, 12, 12, 1];
    const f100 = Array(f10.length).fill(1.2) as number[]; // ≥1 pfu all the time → alert holds from index 2
    const t = speTimeline(series(f10), series(f100, '>=100 MeV'));
    // the ≥100 MeV alert alone keeps the event active (S0 and alert off ends it) → one event from index 2 to the end
    expect(t.events.length).toBe(1);
    const quiet100 = Array(f10.length).fill(0.5) as number[];
    const t2 = speTimeline(series(f10), series(quiet100, '>=100 MeV'));
    expect(t2.events.map((e) => [e.startTag, e.endTag])).toEqual([
      [at(4), at(7)],
      [at(11), at(12)],
    ]);
    // dose per active step = 0.05 × 0.5 × 5/60 h; event 1 active at 4,5,6 → 3 steps; event 2 active at 11 → 1 step
    const step = 0.05 * 0.5 * (5 / 60);
    expect(t2.events[0]!.doseMsv).toBeCloseTo(3 * step, 10);
    expect(t2.events[1]!.doseMsv).toBeCloseTo(step, 10);
    const end = speSummaryAt(t2);
    expect(end.totalMsv).toBeCloseTo(4 * step, 10);
    expect(end.currentEventMsv).toBeCloseTo(step, 10); // most recent event
    expect(end.active).toBe(false);
    expect(speSummaryAt(t2, 5).active).toBe(true);
    expect(speSummaryAt(t2, 5).onsetTag).toBe(at(4));
  });
});

describe('dose ledger (doc 10 §4)', () => {
  it('Mars transit: R. Vance 498 mSv = 83 %, L. Duarte 558 mSv = 93 % projected on every mission day', () => {
    const mt = profile('mars-transit');
    for (const day of [-30, -1, 1, 2, 60, 118, 143, 209, 210]) {
      const c1 = computeDoseLedger(member('c1'), mt, day);
      const c4 = computeDoseLedger(member('c4'), mt, day);
      expect([day, r1(c1.projectedEndMsv), Math.round(c1.pctProjected)]).toEqual([day, 498, 83]);
      expect([day, r1(c4.projectedEndMsv), Math.round(c4.pctProjected)]).toEqual([day, 558, 93]);
    }
  });

  it('sums: day 143 on Mars transit', () => {
    const mt = profile('mars-transit');
    const rows = crew.map((c) => computeDoseLedger(c, mt, 143));
    expect(
      rows.map((r) => [
        r.crewId,
        r.careerPreMissionMsv,
        r1(r.missionGcrMsv),
        r1(r.totalMsv),
        r1(r.pctOfCareerLimit),
        r1(r.projectedEndMsv),
      ]),
    ).toEqual([
      ['c1', 120, 257.4, 377.4, 62.9, 498],
      ['c2', 60, 257.4, 317.4, 52.9, 438],
      ['c3', 35, 257.4, 292.4, 48.7, 413],
      ['c4', 180, 257.4, 437.4, 72.9, 558],
    ]);
    for (const r of rows) {
      expect(r.totalMsv).toBeCloseTo(r.careerPreMissionMsv + r.missionGcrMsv + r.missionSpeMsvModeled, 10);
      expect(r.sourceIds).toEqual(
        expect.arrayContaining([
          'SRC_STD3001_RAD',
          'SRC_DEMO_SIMULATION',
          'SRC_RAD_CURIOSITY',
          'SRC_DEMO_RADIATION_MODEL',
        ]),
      );
    }
  });

  it('projected end = total + remaining days × rate, for all six profiles at their demo day', () => {
    const expected: Record<string, [number, number]> = {
      // [missionGcr, projected] for c1 (career 120 mSv) at the demo day
      iss: [90 * 0.7, 120 + 180 * 0.7],
      'lunar-transit': [6 * 1.8, 120 + 10 * 1.8],
      'lunar-surface': [30 * 1.37, 120 + 60 * 1.37],
      'lunar-rover': [7 * 1.37, 120 + 14 * 1.37],
      'mars-transit': [143 * 1.8, 498],
      'mars-surface': [200 * 0.64, 120 + 500 * 0.64],
    };
    for (const p of profiles) {
      const l = computeDoseLedger(member('c1'), p, p.demoMissionDay);
      const [gcr, proj] = expected[p.id]!;
      expect([p.id, l.missionGcrMsv]).toEqual([p.id, expect.closeTo(gcr, 9)]);
      expect([p.id, l.projectedEndMsv]).toEqual([p.id, expect.closeTo(proj, 9)]);
      expect(l.projectedEndMsv).toBeCloseTo(
        l.totalMsv + (p.durationDays - p.demoMissionDay) * p.gcrDoseMsvPerDay,
        9,
      );
      expect(l.sourceIds).toEqual(expect.arrayContaining(p.sourceIds));
    }
  });

  it('modeled SPE adds to total and projection; day counting clamps', () => {
    const mt = profile('mars-transit');
    const l = computeDoseLedger(member('c1'), mt, 143, {
      missionSpeMsvModeled: 0.5,
      speCurrentEventMsvModeled: 0.25,
    });
    expect(l.totalMsv).toBeCloseTo(377.9, 9);
    expect(l.projectedEndMsv).toBeCloseTo(498.5, 9);
    expect(l.speCurrentEventMsvModeled).toBe(0.25);
    expect(daysElapsed(-5, mt)).toBe(0);
    expect(daysElapsed(1, mt)).toBe(1);
    expect(daysElapsed(400, mt)).toBe(210);
    expect(ALARA_NOTE).toBe('Keep exposure as low as reasonably achievable.');
  });
});

describe('shelter advisory (doc 10 §6) — every class × level', () => {
  const row = (cls: MissionProfile['shelterPolicyClass'], s: 0 | 1 | 2 | 3 | 4 | 5, alert = false) => {
    const a = shelterAdvisory(cls, s, alert);
    return a ? `${a.level}: ${a.text}` : null;
  };
  it('deep space', () => {
    expect(row('deep-space', 0)).toBeNull();
    expect(row('deep-space', 1)).toBe('WATCH: Prepare shelter. Postpone EVA.');
    expect(row('deep-space', 2)).toBe('ACT: Shelter advised.');
    for (const s of [3, 4, 5] as const) expect(row('deep-space', s)).toBe('ACT: Shelter now.');
    expect(row('deep-space', 0, true)).toBe('ACT: Shelter now.');
    expect(row('deep-space', 1, true)).toBe('ACT: Shelter now.');
  });
  it('Mars surface', () => {
    expect(row('mars-surface', 0)).toBeNull();
    expect(row('mars-surface', 1)).toMatch(/^info: /);
    expect(row('mars-surface', 2)).toBe('WATCH: Prepare shelter. Postpone EVA.');
    for (const s of [3, 4, 5] as const) expect(row('mars-surface', s)).toBe('ACT: Shelter now.');
    expect(row('mars-surface', 0, true)).toBe('ACT: Shelter now.');
  });
  it('ISS (LEO)', () => {
    expect(row('leo', 0)).toBeNull();
    expect(row('leo', 1)).toMatch(/^info: /);
    expect(row('leo', 2)).toMatch(/^info: /);
    for (const s of [3, 4, 5] as const)
      expect(row('leo', s)).toBe('WATCH: Follow ground radiation team guidance.');
    expect(row('leo', 0, true)).toBe('WATCH: Follow ground radiation team guidance.');
  });
  it('always ends with the radiation-specialists line; never a per-crew verdict', () => {
    for (const cls of ['leo', 'deep-space', 'mars-surface'] as const)
      for (const s of [1, 2, 3] as const) {
        const a = shelterAdvisory(cls, s, false)!;
        expect(a.closing).toBe(SHELTER_CLOSING);
        expect(a).not.toHaveProperty('crewId');
      }
    expect(SHELTER_CLOSING).toBe("Real shelter calls come from the mission's radiation specialists.");
  });
});

describe('replay chain (doc 10 §8): synthetic S2 profile → S2 → "Shelter advised." → small modeled dose', () => {
  const p = buildReplayProfile(replayJson);
  const mt = profile('mars-transit');

  it('is labeled synthetic', () => {
    expect(p.synthetic).toBe(true);
    expect(p.label).toBe(`REPLAY — ${SYNTHETIC_REPLAY_WORDS}`);
    expect(p.label).not.toMatch(/\b(real|live)\b/i);
  });

  it('reaches S2 ≈ 20 s after play at 600× and the Mars-transit advisory reads "Shelter advised."', () => {
    const firstS = (level: number) => p.timeline.steps.findIndex((s) => s.sScale >= level);
    const s1 = firstS(1);
    const s2 = firstS(2);
    const realS = (i: number) => (Date.parse(p.protons10[i]!.timeTag) - p.startMs) / 600 / 1000;
    expect(realS(s1)).toBeGreaterThan(5);
    expect(realS(s2)).toBeGreaterThan(15);
    expect(realS(s2)).toBeLessThan(22);
    const maxS = Math.max(...p.timeline.steps.map((s) => s.sScale));
    expect(maxS).toBe(2);
    expect(p.timeline.steps.some((s) => s.s100Alert)).toBe(false); // 0.8 pfu peak stays under the alert
    // 20 s of real time at 600× → index → summary → advisory
    const i = replayIndexAt(p, eventElapsedMs(20_000, 600));
    const sum = speSummaryAt(p.timeline, i);
    expect(sum.sScale).toBe(2);
    const adv = shelterAdvisory(mt.shelterPolicyClass, sum.sScale, sum.s100Alert);
    expect(adv?.text).toBe('Shelter advised.');
    expect(adv?.level).toBe('ACT');
    expect(sum.currentEventMsv).toBeGreaterThan(0);
    expect(protons100UpTo(p, i).every((s) => s.timeTag <= p.protons10[i]!.timeTag)).toBe(true);
  });

  it('modeled dose of the whole replay is > 0 and well under 1 mSv; radiation_dose stays WATCH (not ACT)', () => {
    const end = speSummaryAt(p.timeline);
    expect(end.totalMsv).toBeGreaterThan(0.05);
    expect(end.totalMsv).toBeLessThan(1);
    expect(p.timeline.events.length).toBe(1);
    const l = computeDoseLedger(member('c4'), mt, 143, {
      missionSpeMsvModeled: end.totalMsv,
      speCurrentEventMsvModeled: end.currentEventMsv,
    });
    expect(l.speCurrentEventMsvModeled).toBeLessThan(125);
    expect(l.projectedEndMsv).toBeLessThan(570);
  });
});
