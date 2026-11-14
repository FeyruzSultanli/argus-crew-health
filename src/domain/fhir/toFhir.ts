// ARGUS → FHIR R4 Bundle (doc 06 §5 mapping table, row by row). Pure TypeScript: no React, no DOM, no Dexie.
//
// Decisions:
// - Cabin observations (crewId 'cabin') have no `subject`; the extension argus-subject = "cabin" says what they are
//   about (a Location resource would need a resource of its own in the bundle for referential integrity).
// - FHIR ids allow [A-Za-z0-9-.]{1,64}; ARGUS ids such as "sim:c3:heart_rate_rest:143" are mapped to a valid id and
//   kept verbatim in `identifier`.
// - Interpretation: NOMINAL / EXPECTED → N; WATCH / ACT → H or L from the sign of the personal z when the personal
//   layer drove the verdict, otherwise A (abnormal, same HL7 code system) because a band verdict carries no
//   direction. NO_DATA → no interpretation. The ARGUS verdict itself is always in extension argus-verdict.
import { SIGNALS } from '../signals';
import type { Assessment, CrewMember, LayerId, MissionProfile, Observation, Verdict } from '../types';
import { SIGNAL_CODES, UCUM_SYSTEM, componentCoding } from './loinc';
import type {
  FhirBundle,
  FhirCodeableConcept,
  FhirCoding,
  FhirExtension,
  FhirObservation,
  FhirObservationComponent,
  FhirPatient,
} from './types';

export const FHIR_BASE = 'https://argus.local/fhir';
const SD = `${FHIR_BASE}/StructureDefinition`;

/** Extension URLs (doc 06 §5). */
export const EXT = {
  source: `${SD}/argus-source`,
  quality: `${SD}/argus-quality`,
  verdict: `${SD}/argus-verdict`,
  sourceIds: `${SD}/argus-source-ids`,
  missionDay: `${SD}/argus-mission-day`,
  subject: `${SD}/argus-subject`,
  fictional: `${SD}/argus-fictional-crew`,
  crewRole: `${SD}/argus-crew-role`,
} as const;

export const TAG_SYSTEM = {
  dataLabel: 'https://argus.local/data-label',
  crew: 'https://argus.local/crew',
  profile: 'https://argus.local/mission-profile',
} as const;

export const OBSERVATION_ID_SYSTEM = 'https://argus.local/observation-id';
export const INTERPRETATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

export const FICTIONAL_TAG: FhirCoding = {
  system: TAG_SYSTEM.crew,
  code: 'fictional-simulated',
  display: 'Fictional crew member; data simulated for a demo',
};

/** ARGUS verdict words (doc 11 §7; same wording as src/ui/tone.ts, copied so the domain stays UI-free). */
export const VERDICT_WORD: Record<Verdict, string> = {
  NOMINAL: 'Nominal',
  EXPECTED: 'Expected in space',
  WATCH: 'Watch',
  ACT: 'Act',
  NO_DATA: 'No data',
};

export interface ToFhirInput {
  crew: readonly CrewMember[];
  observations: readonly Observation[];
  /** Assessments of any days; matched to an observation by crewId + signalId + missionDay. */
  assessments?: readonly Assessment[];
  profile?: Pick<MissionProfile, 'id' | 'label'>;
  generatedAt: string;
  bundleId?: string;
}

/** 32-bit FNV-1a, hex — short stable suffix for long ids. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A valid FHIR id ([A-Za-z0-9-.]{1,64}) for any ARGUS id. */
export function fhirId(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  return clean.length <= 64 ? clean : `${clean.slice(0, 55)}-${fnv(raw)}`;
}

const assessmentKey = (crewId: string, signalId: string, day: number): string => `${crewId}|${signalId}|${day}`;

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];

function interpretation(a: Assessment): FhirCodeableConcept | undefined {
  if (a.verdict === 'NO_DATA') return undefined;
  let code: 'H' | 'L' | 'N' | 'A';
  if (a.verdict === 'NOMINAL' || a.verdict === 'EXPECTED') code = 'N';
  else {
    const z = a.layers.personal.numbers?.z;
    code = a.drivenBy.includes('personal') && typeof z === 'number' && z !== 0 ? (z > 0 ? 'H' : 'L') : 'A';
  }
  const display = { H: 'High', L: 'Low', N: 'Normal', A: 'Abnormal' }[code];
  return { coding: [{ system: INTERPRETATION_SYSTEM, code, display }], text: `ARGUS: ${VERDICT_WORD[a.verdict]}` };
}

function verdictExtension(a: Assessment): FhirExtension {
  const layers: LayerId[] = ['personal', 'space', 'earth'];
  return {
    url: EXT.verdict,
    extension: [
      { url: 'verdict', valueCode: a.verdict },
      ...a.drivenBy.map((l) => ({ url: 'drivenBy', valueCode: l })),
      { url: 'caughtOnlyByPersonal', valueBoolean: a.caughtOnlyByPersonal },
      ...layers.map((l) => ({ url: l, valueCode: a.layers[l].verdict })),
      { url: 'missionDay', valueInteger: a.missionDay },
    ],
  };
}

function sourceExtension(o: Observation): FhirExtension {
  const ext: FhirExtension[] = [
    { url: 'kind', valueCode: o.source.kind },
    { url: 'label', valueCode: o.source.label },
  ];
  if (o.source.method) ext.push({ url: 'method', valueString: o.source.method });
  if (o.source.deviceId) ext.push({ url: 'deviceId', valueString: o.source.deviceId });
  return { url: EXT.source, extension: ext };
}

function qualityExtension(o: Observation): FhirExtension {
  return {
    url: EXT.quality,
    extension: [
      { url: 'score', valueDecimal: o.quality.score },
      { url: 'label', valueCode: o.quality.label },
      ...o.quality.reasons.map((r) => ({ url: 'reason', valueString: r })),
    ],
  };
}

function components(o: Observation): FhirObservationComponent[] | undefined {
  if (!o.components) return undefined;
  const list = Object.entries(o.components).filter(([, v]) => Number.isFinite(v));
  if (list.length === 0) return undefined;
  return list.map(([key, value]) => {
    const c = componentCoding(o.signalId, key, o.unit);
    return {
      code: { coding: [{ system: c.code.system, code: c.code.code, display: c.code.display }], text: key },
      valueQuantity: { value, unit: c.ucum, system: UCUM_SYSTEM, code: c.ucum },
    };
  });
}

/** One Observation resource (doc 06 §5). */
export function toFhirObservation(o: Observation, a?: Assessment): FhirObservation {
  const coding = SIGNAL_CODES[o.signalId];
  const sourceIds = uniq([
    ...SIGNALS[o.signalId].sourceIds,
    ...(a ? [...a.layers.personal.sourceIds, ...a.layers.space.sourceIds, ...a.layers.earth.sourceIds] : []),
    ...(o.source.label === 'SIMULATED' ? ['SRC_DEMO_SIMULATION'] : []),
  ]);
  const extension: FhirExtension[] = [
    sourceExtension(o),
    qualityExtension(o),
    { url: EXT.missionDay, valueInteger: o.missionDay },
  ];
  if (o.crewId === 'cabin') extension.push({ url: EXT.subject, valueString: 'cabin' });
  if (a) extension.push(verdictExtension(a));
  extension.push({ url: EXT.sourceIds, extension: sourceIds.map((id) => ({ url: 'sourceId', valueString: id })) });

  const res: FhirObservation = {
    resourceType: 'Observation',
    id: fhirId(o.id),
    meta: { tag: [{ system: TAG_SYSTEM.dataLabel, code: o.source.label }] },
    identifier: [{ system: OBSERVATION_ID_SYSTEM, value: o.id }],
    status: 'final',
    code: {
      coding: [{ system: coding.code.system, code: coding.code.code, display: coding.code.display }],
      text: SIGNALS[o.signalId].label,
    },
    effectiveDateTime: o.effectiveAt,
    extension,
  };
  if (o.crewId !== 'cabin') res.subject = { reference: `Patient/${fhirId(o.crewId)}` };
  if (o.value !== null && Number.isFinite(o.value)) {
    res.valueQuantity = { value: o.value, unit: o.unit, system: UCUM_SYSTEM, code: o.unit };
  }
  const comp = components(o);
  if (comp) res.component = comp;
  res.method = { text: o.source.method ? `${o.source.method} (${o.source.kind})` : o.source.kind };
  if (o.source.deviceId) res.device = { display: o.source.deviceId };
  const interp = a ? interpretation(a) : undefined;
  if (interp) res.interpretation = [interp];
  if (o.note) res.note = [{ text: o.note }];
  return res;
}

/** Fictional Patient for a simulated crew member. */
export function toFhirPatient(c: CrewMember): FhirPatient {
  return {
    resourceType: 'Patient',
    id: fhirId(c.id),
    meta: { tag: [FICTIONAL_TAG] },
    extension: [
      { url: EXT.fictional, valueBoolean: true },
      { url: EXT.crewRole, valueString: c.isCMO ? `${c.role} · CMO` : c.role },
    ],
    active: true,
    name: [{ use: 'anonymous', text: c.displayName }],
    gender: c.sex,
  };
}

/** Bundle(collection): Patient × n, then Observation × m (doc 06 §5). */
export function toFhirBundle(input: ToFhirInput): FhirBundle {
  const byKey = new Map<string, Assessment>();
  for (const a of input.assessments ?? []) byKey.set(assessmentKey(a.crewId, a.signalId, a.missionDay), a);
  const tags: FhirCoding[] = [];
  const labels = uniq(input.observations.map((o) => o.source.label)).sort();
  for (const l of labels) tags.push({ system: TAG_SYSTEM.dataLabel, code: l });
  if (input.profile) tags.push({ system: TAG_SYSTEM.profile, code: input.profile.id, display: input.profile.label });
  tags.push(FICTIONAL_TAG);
  return {
    resourceType: 'Bundle',
    id: fhirId(input.bundleId ?? `argus-${input.generatedAt}`),
    meta: { lastUpdated: input.generatedAt, tag: tags },
    type: 'collection',
    timestamp: input.generatedAt,
    entry: [
      ...input.crew.map((c) => {
        const resource = toFhirPatient(c);
        return { fullUrl: `${FHIR_BASE}/Patient/${resource.id}`, resource };
      }),
      ...input.observations.map((o) => {
        const resource = toFhirObservation(o, byKey.get(assessmentKey(o.crewId, o.signalId, o.missionDay)));
        return { fullUrl: `${FHIR_BASE}/Observation/${resource.id}`, resource };
      }),
    ],
  };
}
