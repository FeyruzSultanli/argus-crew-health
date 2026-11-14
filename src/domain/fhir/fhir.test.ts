import { describe, expect, it } from 'vitest';

import { CREW, GOOD, layer } from '../__tests__/fixtures';
import { CANONICAL_UNIT } from '../units';
import type { Assessment, CrewMember, Observation, SignalId } from '../types';
import { observationsToCsv, parseCsv, CSV_COLUMNS } from './csv';
import { LOINC_MAPPED_SIGNALS, LOINC_SYSTEM, LOCAL_CODE_SYSTEM, SIGNAL_CODES } from './loinc';
import { BUNDLE_SCHEMA, OBSERVATION_SCHEMA, validateShape } from './schemaLite';
import { buildPacketSummary, periodLength } from './summary';
import { EXT, fhirId, toFhirBundle } from './toFhir';
import type { FhirObservation, FhirPatient } from './types';

const CREW2: CrewMember = { ...CREW, id: 'c1', displayName: 'R. Vance', sex: 'male', role: 'Commander' };

function o(signalId: SignalId, value: number | null, day: number, extra: Partial<Observation> = {}): Observation {
  return {
    id: `sim:c3:${signalId}:${day}`,
    crewId: 'c3',
    signalId,
    value,
    unit: CANONICAL_UNIT[signalId],
    effectiveAt: `2026-11-${String(day - 129).padStart(2, '0')}T07:00:00.000Z`,
    missionDay: day,
    source: { kind: 'simulated', method: 'ARGUS simulator', label: 'SIMULATED' },
    quality: GOOD,
    ...extra,
  };
}

const HR = o('heart_rate_rest', 69, 143);
const BP = o('blood_pressure', null, 143, { components: { systolic: 114, diastolic: 68 } });
const PVT = o('reaction_test', 3.9, 143, { components: { medianRtMs: 256, lapses: 2, falseStarts: 0, nStimuli: 92 } });
const CAM = o('heart_rate_rest', 71, 143, {
  id: 'f3b0c7a2-0d7e-4a53-9a3e-6c1f1c1b2a10',
  source: { kind: 'camera', method: 'rPPG POS', label: 'MEASURED' },
  quality: { score: 0.55, label: 'fair', reasons: ['some motion'] },
  note: 'after exercise, "felt fine"',
});
const CO2 = { ...o('cabin_co2', 2.4, 143, { components: { avg7d: 2.6 } }), id: 'sim:cabin:cabin_co2:143', crewId: 'cabin' };

const HR_ASSESS: Assessment = {
  crewId: 'c3',
  signalId: 'heart_rate_rest',
  missionDay: 143,
  latest: HR,
  layers: {
    personal: {
      ...layer('personal', 'ACT', 'Resting heart rate is 11 bpm above your usual (58 bpm).'),
      sourceIds: ['SRC_DEMO_BASELINE_ENGINE'],
      numbers: { ref: 58, sigma: 2, z: 5.5, lo: 54, hi: 62, referenceKind: 1 },
    },
    space: layer('space', 'NOMINAL'),
    earth: layer('earth', 'NOMINAL'),
  },
  quality: GOOD,
  verdict: 'ACT',
  drivenBy: ['personal'],
  caughtOnlyByPersonal: true,
  action: { text: 'Tell the CMO. Check temperature and symptoms.', kind: 'protocol', protocolId: 'suspected-infection' },
  explanation: 'Personal baseline: Resting heart rate is 11 bpm above your usual (58 bpm).',
};

const bundle = toFhirBundle({
  crew: [CREW, CREW2],
  observations: [HR, BP, PVT, CAM, CO2],
  assessments: [HR_ASSESS],
  profile: { id: 'mars-transit', label: 'Mars transit' },
  generatedAt: '2026-11-14T16:00:00.000Z',
});
const observations = bundle.entry.map((e) => e.resource).filter((r): r is FhirObservation => r.resourceType === 'Observation');
const patients = bundle.entry.map((e) => e.resource).filter((r): r is FhirPatient => r.resourceType === 'Patient');
const byIdentifier = (id: string) => {
  const r = observations.find((x) => x.identifier[0]?.value === id);
  if (!r) throw new Error(`no observation ${id}`);
  return r;
};
const ext = (r: FhirObservation, url: string) => r.extension.find((e) => e.url === url);
const sub = (r: FhirObservation, url: string, key: string) => ext(r, url)?.extension?.filter((e) => e.url === key) ?? [];

describe('toFhirBundle (doc 06 §5)', () => {
  it('is a collection Bundle: Patients first, then Observations; passes the schema-lite check', () => {
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.entry.map((e) => e.resource.resourceType)).toEqual([
      'Patient',
      'Patient',
      'Observation',
      'Observation',
      'Observation',
      'Observation',
      'Observation',
    ]);
    expect(validateShape(JSON.parse(JSON.stringify(bundle)), BUNDLE_SCHEMA)).toEqual([]);
  });

  it('schema-lite catches broken shapes', () => {
    const bad = { resourceType: 'Observation', id: 'a:b', status: 'final', code: { coding: [] }, extension: [] };
    const errors = validateShape(bad, OBSERVATION_SCHEMA);
    expect(errors).toEqual(
      expect.arrayContaining([
        '$.effectiveDateTime: required',
        '$.id: "a:b" does not match pattern',
        '$.code.coding: fewer than 1 items',
        '$.extension: fewer than 1 items',
      ]),
    );
  });

  it('Patients are fictional and say so', () => {
    expect(patients.map((p) => p.id)).toEqual(['c3', 'c1']);
    const p = patients[0];
    expect(p?.name[0]?.text).toBe('K. Osei');
    expect(p?.name[0]?.use).toBe('anonymous');
    expect(p?.meta.tag?.[0]?.code).toBe('fictional-simulated');
    expect(p?.extension.find((e) => e.url === EXT.fictional)?.valueBoolean).toBe(true);
  });

  it('blood pressure: panel 85354-9 with exactly two components 8480-6 / 8462-4 in mm[Hg], no valueQuantity', () => {
    const r = byIdentifier(BP.id);
    expect(r.code.coding?.[0]).toMatchObject({ system: LOINC_SYSTEM, code: '85354-9' });
    expect(r.valueQuantity).toBeUndefined();
    expect(r.component).toHaveLength(2);
    expect(r.component?.map((c) => [c.code.coding?.[0]?.code, c.valueQuantity.value, c.valueQuantity.code])).toEqual([
      ['8480-6', 114, 'mm[Hg]'],
      ['8462-4', 68, 'mm[Hg]'],
    ]);
  });

  it('every Observation has code + effectiveDateTime + (valueQuantity or component); units are the doc 06 §3 UCUM', () => {
    for (const r of observations) {
      expect(r.code.coding?.length).toBeGreaterThan(0);
      expect(r.effectiveDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(r.valueQuantity !== undefined || (r.component?.length ?? 0) > 0).toBe(true);
      const signal = (Object.keys(SIGNAL_CODES) as SignalId[]).find((s) => SIGNAL_CODES[s].code.code === r.code.coding?.[0]?.code);
      expect(signal).toBeDefined();
      if (signal && r.valueQuantity) {
        expect(r.valueQuantity.code).toBe(SIGNAL_CODES[signal].ucum);
        expect(r.valueQuantity.system).toBe('http://unitsofmeasure.org');
      }
    }
  });

  it('LOINC for every mapped signal of doc 06 §3; local system otherwise', () => {
    expect([...LOINC_MAPPED_SIGNALS].sort()).toEqual(
      ['blood_pressure', 'body_mass', 'body_temp', 'glucose', 'heart_rate_rest', 'hematocrit', 'sleep_duration', 'spo2', 'wbc'].sort(),
    );
    expect(byIdentifier(HR.id).code.coding?.[0]).toMatchObject({ system: LOINC_SYSTEM, code: '8867-4' });
    expect(byIdentifier(PVT.id).code.coding?.[0]).toMatchObject({ system: LOCAL_CODE_SYSTEM, code: 'argus-pvt' });
    expect(byIdentifier(PVT.id).component?.map((c) => c.code.coding?.[0]?.code)).toEqual([
      'argus-pvt-median-rt',
      'argus-pvt-lapses',
      'argus-pvt-false-starts',
      'argus-pvt-stimuli',
    ]);
    for (const id of LOINC_MAPPED_SIGNALS) expect(SIGNAL_CODES[id].code.loincVerified).toBe(true);
  });

  it('source labels, method and quality survive the export', () => {
    const sim = byIdentifier(HR.id);
    expect(sim.meta.tag?.[0]?.code).toBe('SIMULATED');
    expect(sub(sim, EXT.source, 'label')[0]?.valueCode).toBe('SIMULATED');
    const cam = byIdentifier(CAM.id);
    expect(cam.meta.tag?.[0]?.code).toBe('MEASURED');
    expect(sub(cam, EXT.source, 'kind')[0]?.valueCode).toBe('camera');
    expect(sub(cam, EXT.source, 'method')[0]?.valueString).toBe('rPPG POS');
    expect(cam.method?.text).toBe('rPPG POS (camera)');
    expect(sub(cam, EXT.quality, 'label')[0]?.valueCode).toBe('fair');
    expect(sub(cam, EXT.quality, 'score')[0]?.valueDecimal).toBe(0.55);
    expect(sub(cam, EXT.quality, 'reason').map((e) => e.valueString)).toEqual(['some motion']);
    expect(cam.note?.[0]?.text).toBe('after exercise, "felt fine"');
    expect(bundle.meta.tag?.map((t) => t.code)).toEqual(expect.arrayContaining(['SIMULATED', 'MEASURED', 'mars-transit']));
  });

  it('interpretation H + argus-verdict when an assessment is supplied; none otherwise', () => {
    const hr = byIdentifier(HR.id);
    expect(hr.interpretation?.[0]?.coding?.[0]?.code).toBe('H');
    expect(sub(hr, EXT.verdict, 'verdict')[0]?.valueCode).toBe('ACT');
    expect(sub(hr, EXT.verdict, 'caughtOnlyByPersonal')[0]?.valueBoolean).toBe(true);
    expect(sub(hr, EXT.verdict, 'drivenBy').map((e) => e.valueCode)).toEqual(['personal']);
    expect(sub(hr, EXT.verdict, 'personal')[0]?.valueCode).toBe('ACT');
    expect(sub(hr, EXT.verdict, 'earth')[0]?.valueCode).toBe('NOMINAL');
    expect(sub(hr, EXT.sourceIds, 'sourceId').map((e) => e.valueString)).toEqual(
      expect.arrayContaining(['SRC_DEMO_BASELINE_ENGINE', 'SRC_DEMO_SIMULATION']),
    );
    expect(byIdentifier(BP.id).interpretation).toBeUndefined();
  });

  it('subject: Patient/<crewId>; cabin has no subject and an argus-subject extension; ids are valid FHIR ids', () => {
    expect(byIdentifier(HR.id).subject?.reference).toBe('Patient/c3');
    const co2 = byIdentifier(CO2.id);
    expect(co2.subject).toBeUndefined();
    expect(ext(co2, EXT.subject)?.valueString).toBe('cabin');
    expect(byIdentifier(HR.id).id).toBe('sim-c3-heart_rate_rest-143'.replace(/_/g, '-'));
    expect(fhirId('x'.repeat(100))).toHaveLength(64);
  });
});

describe('CSV export', () => {
  it('round-trips through parseCsv with quoting of commas, quotes and JSON components', () => {
    const csv = observationsToCsv([HR, BP, CAM]);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(4);
    const col = (r: string[], c: (typeof CSV_COLUMNS)[number]) => r[CSV_COLUMNS.indexOf(c)];
    const bp = rows[2] ?? [];
    expect(col(bp, 'value')).toBe('');
    expect(JSON.parse(col(bp, 'components') ?? '')).toEqual({ systolic: 114, diastolic: 68 });
    const cam = rows[3] ?? [];
    expect(col(cam, 'sourceLabel')).toBe('MEASURED');
    expect(col(cam, 'qualityLabel')).toBe('fair');
    expect(Number(col(cam, 'qualityScore'))).toBe(0.55);
    expect(col(rows[1] ?? [], 'missionDay')).toBe('143');
    expect(parseCsv('a,"b,""c"""\r\n"x\ny",z\r\n')).toEqual([
      ['a', 'b,"c"'],
      ['x\ny', 'z'],
    ]);
  });
});

describe('packet summary', () => {
  const day = (d: number, verdict: Assessment['verdict']): Assessment => ({ ...HR_ASSESS, missionDay: d, verdict });
  const s = buildPacketSummary({
    request: { crewIds: ['c3'], fromDay: 137, toDay: 143, flagsOnly: true, note: 'Slept badly, "noisy fan"' },
    crew: [CREW],
    assessments: [day(141, 'WATCH'), day(142, 'WATCH'), HR_ASSESS, day(140, 'NOMINAL')],
    observations: [HR, CAM],
    profileLabel: 'Mars transit',
  });

  it('flags, driving layer, caught-only marker, baseline numbers with units, verbatim explanation and action', () => {
    const text = s.text;
    expect(s.flaggedTotal).toBe(1);
    expect(text).toContain('K. Osei — 1 flagged (1 Act, 0 Watch)');
    expect(text).toContain('• Resting heart rate: Act — driven by personal baseline — caught only by personal baseline.');
    expect(text).toContain(HR_ASSESS.explanation);
    expect(text).toContain(`Action: ${HR_ASSESS.action.text}`);
    expect(text).toContain('Against personal baseline: usual 58 bpm, band 54–62 bpm, day-to-day variation 2 bpm (in-flight reference).');
    expect(text).toContain('Flagged on 3 of 7 days in the period (MD 141, MD 142, MD 143).');
    expect(text).toContain('1 fair Resting heart rate reading (some motion)');
    expect(text).toContain('Note from the crew (as written): Slept badly, "noisy fan"');
    expect(text).toContain('Readings in the period by data label: SIMULATED 1, MEASURED 1.');
  });

  it('period length skips day 0', () => {
    expect(periodLength(137, 143)).toBe(7);
    expect(periodLength(-3, 3)).toBe(6);
  });
});
