// Crew Health Data Service (doc 05 §4.1) + Dexie schema (doc 05 §6) + demo data lifecycle.
export type { HealthService } from './healthService';
export {
  assessAll,
  createHealthService,
  dataVersionToken,
  flagDensity,
  healthService,
  NotImplementedError,
  personalSeries,
  personalTracks,
  placeholderHealthService,
  queryObservations,
  setTaskStatus,
} from './healthService';
export {
  bumpDerivedVersion,
  computeAssessments,
  DATA_VERSION_KEY,
  DERIVED_VERSION_KEY,
  setDoseProvider,
} from './assessments';
export type { DoseProvider, FlagCount, PersonalTrack } from './assessments';
export { bootData, resetDemoAndStores } from './boot';
export { DataBoot } from './DataBoot';
export type { BootResult } from './boot';
export { ArgusDB, db, DB_NAME } from './db';
export type { MessageRow, SettingRow, SpaceWeatherRow, StreakRow, VisionMapRow } from './db';
export {
  getCurrentMissionDay,
  getMissionEpoch,
  getMissionProfile,
  getMissionProfileId,
  listCrew,
  missionDateOf,
  resetDemo,
  seedIfEmpty,
  SEED_VERSION,
  setCurrentMissionDay,
  SETTING_KEYS,
} from './demo';
export type { SeedOptions, SeedReport } from './demo';
export {
  addMissionDays,
  computeMissionEpoch,
  dateOf,
  missionDayOf,
  missionDayRange,
  missionDaysBetween,
  simulatedEffectiveAt,
} from './missionClock';
export { DEFAULT_PROFILE_ID, loadSeed, profileById } from './seed';
export type { SeedData } from './seed';
export { ObservationValidationError, OBSERVATION_SPECS, validateNewObservation } from './validation';
export {
  useAllAssessments,
  useAssessments,
  useCrew,
  useFlagDensity,
  useMissionClock,
  useObservations,
  usePersonalSeries,
  usePersonalTracks,
  useTodayPlan,
} from './hooks';
export type { MissionClockState } from './hooks';
