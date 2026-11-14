// Zustand stores (doc 05 §5) and the hooks/selectors around them.
export { useSessionStore, DEMO_PIN, CMO_CREW_ID, ROLE_LABEL } from './session';
export type { Role, SessionState, SignInInput } from './session';
export { useMissionStore, useMissionProfile } from './mission';
export type { MissionState, DemoFlags, ReplayState } from './mission';
export { useUiStore } from './ui';
export type {
  UiState,
  Theme,
  LayerLens,
  BodySystemFilter,
  TempUnit,
  GlucoseUnit,
  SpaceWeatherMode,
  FlagDensityDay,
  FocusedFlow,
} from './ui';
export {
  MIN_MISSION_DAY,
  DEFAULT_PROFILE_ID,
  DELAY_SOURCE_IDS,
  missionProfiles,
  getProfile,
  commsDelaySec,
  isModeledDelay,
  delayDisplay,
  maxMissionDay,
  clampMissionDay,
  dayToIndex,
  indexToDay,
  stepMissionDay,
  missionDayRange,
  missionDayLabel,
  missionDayText,
} from './missionSelectors';
export {
  useOnlineStatus,
  useReducedMotionPreference,
  useFocusedFlow,
  useApplyPreferences,
  useSessionIdentity,
} from './hooks';
