// Static seed data (doc 12 §2 step 6): crew.json, missions.json, scenarios.json and the OSDR anchors are imported
// statically and validated once against the contract types. Throws loudly when a file drifts from the types.
import crewJson from '../../seed/crew.json';
import missionsJson from '../../seed/missions.json';
import anchorsJson from '../../seed/osdr/preflight-anchors.json';
import scenariosJson from '../../seed/scenarios.json';
import type { CrewMember, MissionProfile, MissionProfileId } from '../domain/types';
import { validateAnchors, type AnchorSet } from './sim/anchors';
import { validateScenarios, type ScenarioDef } from './sim/scenarios';

const ROLES: ReadonlyArray<CrewMember['role']> = ['Commander', 'Pilot', 'Flight engineer', 'Mission specialist'];
const SUBJECTS: ReadonlyArray<NonNullable<CrewMember['osdrSubject']>> = ['C001', 'C002', 'C003', 'C004'];
const PROFILE_IDS: readonly MissionProfileId[] = [
  'iss', 'lunar-transit', 'lunar-surface', 'lunar-rover', 'mars-transit', 'mars-surface',
];
const SHELTER: ReadonlyArray<MissionProfile['shelterPolicyClass']> = ['leo', 'deep-space', 'mars-surface'];

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';

export function validateCrew(json: unknown): CrewMember[] {
  const list = (json as { crew?: unknown }).crew;
  if (!Array.isArray(list)) throw new Error('seed/crew.json: `crew` must be an array');
  return list.map((raw: unknown): CrewMember => {
    const c = raw as Record<string, unknown>;
    const err = (m: string): never => {
      throw new Error(`seed/crew.json: crew "${String(c.id)}": ${m}`);
    };
    if (!isStr(c.id) || !isStr(c.displayName)) err('id/displayName');
    if (!ROLES.includes(c.role as CrewMember['role'])) err(`role ${String(c.role)}`);
    if (typeof c.isCMO !== 'boolean') err('isCMO');
    if (c.sex !== 'male' && c.sex !== 'female') err('sex');
    if (!isNum(c.ageYears) || !isNum(c.careerDoseMsvPreMission)) err('ageYears/careerDoseMsvPreMission');
    if (c.osdrSubject !== undefined && !SUBJECTS.includes(c.osdrSubject as 'C001')) err('osdrSubject');
    const b = c.simulatedBaseline as Record<string, unknown> | undefined;
    if (!b || !Object.values(b).every(isNum)) err('simulatedBaseline must map to numbers');
    const member: CrewMember = {
      id: c.id as string,
      displayName: c.displayName as string,
      role: c.role as CrewMember['role'],
      isCMO: c.isCMO as boolean,
      sex: c.sex as CrewMember['sex'],
      ageYears: c.ageYears as number,
      careerDoseMsvPreMission: c.careerDoseMsvPreMission as number,
      simulatedBaseline: { ...(b as Record<string, number>) },
    };
    if (c.osdrSubject !== undefined) member.osdrSubject = c.osdrSubject as CrewMember['osdrSubject'];
    return member;
  });
}

export function validateProfiles(json: unknown): MissionProfile[] {
  const list = (json as { profiles?: unknown }).profiles;
  if (!Array.isArray(list)) throw new Error('seed/missions.json: `profiles` must be an array');
  return list.map((raw: unknown): MissionProfile => {
    const p = raw as Record<string, unknown>;
    const err = (m: string): never => {
      throw new Error(`seed/missions.json: profile "${String(p.id)}": ${m}`);
    };
    if (!PROFILE_IDS.includes(p.id as MissionProfileId)) err('id');
    if (!isStr(p.label)) err('label');
    if (!isNum(p.gravityG) || !isNum(p.gcrDoseMsvPerDay) || !isNum(p.durationDays)) err('numbers');
    if (!isNum(p.demoMissionDay) || !Number.isInteger(p.demoMissionDay) || p.demoMissionDay < 1) err('demoMissionDay');
    if ((p.demoMissionDay as number) > (p.durationDays as number)) err('demoMissionDay after durationDays');
    const delay = p.commsDelayOneWaySec;
    const okDelay =
      isNum(delay) ||
      (typeof delay === 'object' &&
        delay !== null &&
        Array.isArray((delay as { byMissionDay?: unknown }).byMissionDay) &&
        (delay as { byMissionDay: unknown[] }).byMissionDay.every(
          (t) => Array.isArray(t) && t.length === 2 && isNum(t[0]) && isNum(t[1]),
        ));
    if (!okDelay) err('commsDelayOneWaySec');
    if (p.resupply !== 'regular' && p.resupply !== 'none') err('resupply');
    if (!SHELTER.includes(p.shelterPolicyClass as 'leo')) err('shelterPolicyClass');
    if (!Array.isArray(p.sourceIds) || !p.sourceIds.every(isStr)) err('sourceIds');
    const profile: MissionProfile = {
      id: p.id as MissionProfileId,
      label: p.label as string,
      gravityG: p.gravityG as number,
      commsDelayOneWaySec: delay as MissionProfile['commsDelayOneWaySec'],
      gcrDoseMsvPerDay: p.gcrDoseMsvPerDay as number,
      resupply: p.resupply as MissionProfile['resupply'],
      demoMissionDay: p.demoMissionDay as number,
      durationDays: p.durationDays as number,
      shelterPolicyClass: p.shelterPolicyClass as MissionProfile['shelterPolicyClass'],
      sourceIds: p.sourceIds as string[],
    };
    if (isStr(p.commsDelayNote)) profile.commsDelayNote = p.commsDelayNote;
    if (isStr(p.notes)) profile.notes = p.notes;
    return profile;
  });
}

export interface SeedData {
  crew: CrewMember[];
  profiles: MissionProfile[];
  scenarios: ScenarioDef[];
  anchors: AnchorSet;
}

let cached: SeedData | null = null;

/** Validated seed data (memoised). */
export function loadSeed(): SeedData {
  if (cached) return cached;
  const crew = validateCrew(crewJson);
  const anchors = validateAnchors(anchorsJson);
  for (const c of crew) {
    const subj = anchors.subjects.find((s) => s.subject === c.osdrSubject);
    if (c.osdrSubject && !subj) throw new Error(`seed: crew ${c.id} osdrSubject ${c.osdrSubject} not in anchors`);
    if (subj && subj.sex !== c.sex) {
      throw new Error(`seed: crew ${c.id} (${c.sex}) mapped to ${subj.subject} (${subj.sex}) — doc 06 §6 needs same sex`);
    }
  }
  cached = {
    crew,
    profiles: validateProfiles(missionsJson),
    scenarios: validateScenarios(scenariosJson, crew.map((c) => c.id)),
    anchors,
  };
  return cached;
}

export const DEFAULT_PROFILE_ID: MissionProfileId = 'mars-transit';

export function profileById(id: MissionProfileId): MissionProfile {
  const p = loadSeed().profiles.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown mission profile ${id}`);
  return p;
}
