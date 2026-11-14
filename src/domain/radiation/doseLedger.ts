// Dose ledger (doc 10 §4). Dose equivalent from published measurements, compared with the NASA-STD-3001 effective
// dose limits [SRC_STD3001_RAD · verified, V1 4030 / 4031]. The ledger is labeled "dose equivalent, published
// measurements" in the UI so the two quantities are not presented as the same thing (doc 10 §3).
//
//   careerPre   = crew.careerDoseMsvPreMission                (simulated → SRC_DEMO_SIMULATION)
//   missionGcr  = daysElapsed × profile.gcrDoseMsvPerDay       (profile.sourceIds)
//   missionSpe  = Σ modeled SPE increments                     (SRC_DEMO_RADIATION_MODEL)
//   total       = careerPre + missionGcr + missionSpe
//   pctCareer   = total / 600 mSv × 100
//   projectedEnd = total + remainingDays × gcrRate
//
// Day-counting convention: the ledger of mission day d covers flight days 1 … d inclusive (the dose through the end
// of day d), so daysElapsed = clamp(d, 0, durationDays) and remainingDays = durationDays − daysElapsed. Pre-flight
// days (d < 0) have no mission dose. Hence projectedEnd = careerPre + durationDays × rate + missionSpe on every day:
// Mars transit (1.8 mSv/day × 210 d = 378 mSv) gives R. Vance 120 + 378 = 498 mSv (83 %) and L. Duarte
// 180 + 378 = 558 mSv (93 %) from pre-flight to arrival.
import type { CrewMember, DoseLedger, MissionProfile } from '../types';
import { CAREER_LIMIT_MSV, SPE_LIMIT_MSV } from '../signals/radiationDose';

export { CAREER_LIMIT_MSV, SPE_LIMIT_MSV };
export const LIMIT_SOURCE_IDS = ['SRC_STD3001_RAD'] as const;
export const ALARA_NOTE = 'Keep exposure as low as reasonably achievable.';
export const LEDGER_QUANTITY_LABEL = 'dose equivalent, published measurements';

export interface SpeInput {
  /** Modeled SPE dose summed over every event counted for this mission (mSv). */
  missionSpeMsvModeled: number;
  /** Modeled dose of the current or most recent event (mSv). */
  speCurrentEventMsvModeled: number;
}

export const NO_SPE: SpeInput = { missionSpeMsvModeled: 0, speCurrentEventMsvModeled: 0 };

export function daysElapsed(missionDay: number, profile: Pick<MissionProfile, 'durationDays'>): number {
  if (!Number.isFinite(missionDay) || missionDay < 1) return 0;
  return Math.min(Math.floor(missionDay), profile.durationDays);
}

export function computeDoseLedger(
  crew: Pick<CrewMember, 'id' | 'careerDoseMsvPreMission'>,
  profile: Pick<MissionProfile, 'gcrDoseMsvPerDay' | 'durationDays' | 'sourceIds'>,
  missionDay: number,
  spe: SpeInput = NO_SPE,
): DoseLedger {
  const elapsed = daysElapsed(missionDay, profile);
  const remaining = profile.durationDays - elapsed;
  const careerPre = crew.careerDoseMsvPreMission;
  const gcr = elapsed * profile.gcrDoseMsvPerDay;
  const speMission = Math.max(0, spe.missionSpeMsvModeled);
  const total = careerPre + gcr + speMission;
  const projected = total + remaining * profile.gcrDoseMsvPerDay;
  return {
    crewId: crew.id,
    careerPreMissionMsv: careerPre,
    missionGcrMsv: gcr,
    missionSpeMsvModeled: speMission,
    totalMsv: total,
    pctOfCareerLimit: (total / CAREER_LIMIT_MSV) * 100,
    projectedEndMsv: projected,
    pctProjected: (projected / CAREER_LIMIT_MSV) * 100,
    speCurrentEventMsvModeled: Math.max(0, spe.speCurrentEventMsvModeled),
    sourceIds: [
      ...new Set([
        'SRC_STD3001_RAD',
        'SRC_DEMO_SIMULATION',
        ...profile.sourceIds,
        'SRC_DEMO_RADIATION_MODEL',
      ]),
    ],
  };
}

/** Fraction of the 250 mSv SPE design limit used by the current event, in percent. */
export function speEventPct(ledger: Pick<DoseLedger, 'speCurrentEventMsvModeled'>): number {
  return (ledger.speCurrentEventMsvModeled / SPE_LIMIT_MSV) * 100;
}
