// Shelter advisory — demo policy (doc 10 §6) [SRC_DEMO_RADIATION_MODEL · demo; S levels SRC_NOAA_SWPC_PROTONS].
// An environment-level banner, NOT a per-crew verdict: it never changes radiation_dose assessments, crew status
// rings or readiness (doc 07 §4.20).
//
// | Profile class                                   | S1                                   | S2                  | S3+ or s100Alert |
// | deep-space (lunar transit, Mars transit, lunar surface/rover) | WATCH "Prepare shelter. Postpone EVA." | ACT "Shelter advised." | ACT "Shelter now." |
// | mars-surface                                    | info                                 | WATCH               | ACT              |
// | leo (ISS, inside the magnetosphere)             | info                                 | info                | WATCH "Follow ground radiation team guidance." |
//
// Mars surface reuses the deep-space wording of the same verdict (WATCH → "Prepare shelter. Postpone EVA.", ACT →
// "Shelter now."); the info rows carry no instruction, only the storm level.
import type { MissionProfile, SScale } from '../types';
import { S_SCALE_WORD } from './sscale';

export type ShelterLevel = 'info' | 'WATCH' | 'ACT';

export interface ShelterAdvisory {
  level: ShelterLevel;
  /** The instruction line from the doc 10 §6 table (or the information line). */
  text: string;
  /** Always "Real shelter calls come from the mission's radiation specialists." */
  closing: string;
  sScale: SScale;
  s100Alert: boolean;
  policyClass: MissionProfile['shelterPolicyClass'];
  sourceIds: string[];
}

export const SHELTER_CLOSING = "Real shelter calls come from the mission's radiation specialists.";
export const SHELTER_SOURCE_IDS = ['SRC_DEMO_RADIATION_MODEL', 'SRC_NOAA_SWPC_PROTONS'];

export const SHELTER_TEXT = {
  prepare: 'Prepare shelter. Postpone EVA.',
  advised: 'Shelter advised.',
  now: 'Shelter now.',
  ground: 'Follow ground radiation team guidance.',
} as const;

function infoText(sScale: SScale): string {
  return `Solar radiation storm S${sScale} (${S_SCALE_WORD[sScale].toLowerCase()}): information only under this mission profile's policy.`;
}

/** The advisory for a debounced S level / alert under a profile class, or null when there is nothing to show. */
export function shelterAdvisory(
  policyClass: MissionProfile['shelterPolicyClass'],
  sScale: SScale,
  s100Alert: boolean,
): ShelterAdvisory | null {
  const severe = sScale >= 3 || s100Alert;
  let level: ShelterLevel | null = null;
  let text = '';
  if (policyClass === 'deep-space') {
    if (severe) [level, text] = ['ACT', SHELTER_TEXT.now];
    else if (sScale === 2) [level, text] = ['ACT', SHELTER_TEXT.advised];
    else if (sScale === 1) [level, text] = ['WATCH', SHELTER_TEXT.prepare];
  } else if (policyClass === 'mars-surface') {
    if (severe) [level, text] = ['ACT', SHELTER_TEXT.now];
    else if (sScale === 2) [level, text] = ['WATCH', SHELTER_TEXT.prepare];
    else if (sScale === 1) [level, text] = ['info', infoText(1)];
  } else {
    if (severe) [level, text] = ['WATCH', SHELTER_TEXT.ground];
    else if (sScale >= 1) [level, text] = ['info', infoText(sScale)];
  }
  if (level === null) return null;
  return {
    level,
    text,
    closing: SHELTER_CLOSING,
    sScale,
    s100Alert,
    policyClass,
    sourceIds: [...SHELTER_SOURCE_IDS],
  };
}
