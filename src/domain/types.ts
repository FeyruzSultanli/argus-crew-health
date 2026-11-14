// ARGUS shared domain types — the contract every module codes against.
//
// Copied verbatim from:
//   docs/06_DATA_MODEL.md §1 (core types), §1a (contract types), §2 (signal identifiers), §4 (space weather)
//   docs/07_CLINICAL_RULES.md §1 (SignalDef)
// Shared contract: do not add or rename types or fields here without updating docs 05, 06 and 07.
// Pure TypeScript: no React, no DOM, no Dexie.

// ---- doc 06 §1 Core types ----

export type Verdict = 'NOMINAL' | 'EXPECTED' | 'WATCH' | 'ACT' | 'NO_DATA';
export type LayerId = 'personal' | 'space' | 'earth';
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export type SourceStatus = 'verified' | 'partial' | 'demo';
export type SourceKind = 'manual' | 'camera' | 'device' | 'import' | 'lab' | 'environment' | 'simulated' | 'derived';
export type MissionProfileId = 'iss' | 'lunar-transit' | 'lunar-surface' | 'lunar-rover' | 'mars-transit' | 'mars-surface';

export interface SourceRef {               // entry in seed/sources.json
  id: string;                              // e.g. "SRC_STD3001_CO2"
  title: string;
  publisher?: string;
  url: string | null;                      // never invented; null if not confirmed
  says: string;                            // one-sentence paraphrase of what we use from it
  status: SourceStatus;
  accessed?: string;                       // ISO date
}

export interface CrewMember {
  id: string;                              // "c1".."c4"
  displayName: string;                     // fictional, e.g. "K. Osei"
  role: 'Commander' | 'Pilot' | 'Flight engineer' | 'Mission specialist';
  isCMO: boolean;
  sex: 'female' | 'male';                  // selects reference body mesh only
  ageYears: number;
  careerDoseMsvPreMission: number;         // for dose ledger (simulated, labeled)
  osdrSubject?: 'C001' | 'C002' | 'C003' | 'C004'; // OSD-569/575 anonymised subject used for blood anchors
  simulatedBaseline: Record<string, number>;       // see seed/crew.json (SIMULATED vitals baselines)
}

export interface MissionProfile {
  id: MissionProfileId;
  label: string;
  gravityG: number;                        // 0 for microgravity
  commsDelayOneWaySec: number | { byMissionDay: Array<[day: number, sec: number]> };
  gcrDoseMsvPerDay: number;                // baseline, sourced
  resupply: 'regular' | 'none';
  demoMissionDay: number;                  // where the demo opens
  durationDays: number;
  shelterPolicyClass: 'leo' | 'deep-space' | 'mars-surface';   // doc 10 §6 — already present in seed/missions.json
  commsDelayNote?: string;
  notes?: string;
  sourceIds: string[];
}

export interface Quality {
  score: number;                           // 0..1
  label: 'good' | 'fair' | 'poor';
  reasons: string[];                       // e.g. ["low SNR 1.8 dB", "motion detected"]
}

export interface Observation {
  id: string;                              // uuid
  crewId: string | 'cabin';
  signalId: SignalId;
  value: number | null;                    // primary numeric value in canonical unit
  components?: Record<string, number>;     // e.g. { systolic: 118, diastolic: 76 }
  unit: string;                            // UCUM canonical unit, see §3
  effectiveAt: string;                     // ISO UTC
  missionDay: number;                      // launch day = 1, L-30 = -30
  source: { kind: SourceKind; method?: string; deviceId?: string; label: 'SIMULATED' | 'MEASURED' | 'LIVE' | 'REPLAY' };
  quality: Quality;
  note?: string;
  context?: { glucose?: 'fasting' | 'random' | 'post-meal'; eye?: 'left' | 'right'; withGlasses?: boolean; posture?: string };
  attachments?: Array<{ kind: 'amsler-map' | 'image'; ref: string }>;
}

export interface LayerResult {
  layer: LayerId;
  verdict: Verdict;
  reason: string;                          // plain language, ≤ 140 chars
  ruleId?: string;
  sourceIds: string[];
  numbers?: Record<string, number>;        // e.g. { z: 3.4, cusum: 5.1, ref: 59, sigma: 2 }
}

export interface Assessment {
  crewId: string | 'cabin';
  signalId: SignalId;
  missionDay: number;
  latest?: Observation;
  layers: Record<LayerId, LayerResult>;
  quality: Quality;
  verdict: Verdict;
  drivenBy: LayerId[];                     // which layers produced the final verdict
  caughtOnlyByPersonal: boolean;           // personal ∈ {WATCH,ACT} and space,earth ∈ {NOMINAL,EXPECTED,n/a} — doc 07 §3 step 7
  action: { text: string; kind: 'none' | 'remeasure' | 'tell-cmo' | 'notify-surgeon' | 'protocol'; protocolId?: string; dueInHours?: number };
  explanation: string;                     // 1–2 sentences
}

export interface Task {
  id: string; crewId: string; missionDay: number;
  kind: 'measure' | 'checkin' | 'exam' | 'countermeasure';
  signalId?: SignalId; title: string; why: string;
  status: 'due' | 'done' | 'skipped' | 'overdue';
  points: number;                          // gamification
}

// ---- doc 06 §1a Contract types ----

export type BodyRegionId = 'brain' | 'eyes' | 'face' | 'heart' | 'lungs' | 'vessels' | 'pancreas_liver'
  | 'kidneys' | 'skeleton' | 'muscles' | 'skin' | 'whole_body';                     // doc 07 §6
export type Direction = 'up' | 'down' | 'both';
export type Aggregation = 'daily-median' | 'daily-max' | 'single' | 'mean-3' | 'mean-2';   // doc 08 §7
export type ProtocolId = 'suspected-infection' | 'spe-shelter' | 'co2-headache' | 'vision-change' | 'sleep-debt';

// One PersonalParams per judged series. blood_pressure has two (component 'systolic' and 'diastolic');
// its personal LayerResult is the worse of the two.
export interface PersonalParams { direction: Direction; sigmaFloor: number; aggregation: Aggregation; component?: string }

export interface ShiftCtx { missionDay: number; profile: MissionProfile }

export interface RuleCtx {
  missionDay: number;
  profile: MissionProfile;
  crew?: CrewMember;                          // undefined when crewId = 'cabin'
  history: Observation[];                     // same crew + same signal, missionDay ≤ today, oldest first
  preflight: { median: number | null; n: number; components?: Record<string, number> };  // pre-flight medians (value, and each component, e.g. lapses)
  sameDay: Partial<Record<SignalId, LayerResult>>;   // space-layer results already computed today (the sleep rule reads reaction_test)
  dose?: DoseLedger;                          // filled by the radiation service; absent → radiation_dose returns NO_DATA
}

export interface ActionTemplate { text: string; kind: Assessment['action']['kind']; protocolId?: ProtocolId; dueInHours?: number }

export interface PersonalResult extends LayerResult {          // layer = 'personal'
  series: Array<{ missionDay: number; value: number; lo: number; hi: number; state: Verdict }>;   // band per day for charts (doc 08 §6)
}
export type QualityResult = Quality & { stale: 'fresh' | 'remeasure' | 'no-data' };              // doc 04 FR-SIG-5

export type NewObservation = Omit<Observation, 'id' | 'missionDay' | 'effectiveAt'> & { missionDay?: number; effectiveAt?: string };
export interface ObsQuery { crewId?: string | 'cabin'; signalId?: SignalId; fromDay?: number; toDay?: number }
export interface EnvironmentSnapshot {
  missionDay: number;
  co2: { last1hMmHg: number; avg7dMmHg: number;
         series24h: Array<{ t: string; mmHg: number }>; dailyMeans: Array<{ missionDay: number; mmHg: number }> };
  tempC: number; humidityPct: number;
  assessments: Assessment[];                  // cabin_co2, cabin_temp, cabin_humidity
}
export interface PacketRequest { crewIds: string[]; fromDay: number; toDay: number; flagsOnly: boolean; note?: string }
export interface Packet {
  id: string; request: PacketRequest; createdAt: string; status: 'queued' | 'in-transit' | 'delivered';
  delaySec: number; deliverAt: string; sizeBytes: number; summary: string; bundle: unknown;     // bundle = FHIR Bundle
}

// ---- doc 06 §2 Signal identifiers ----

export type SignalId =
  | 'heart_rate_rest' | 'blood_pressure' | 'spo2' | 'body_temp' | 'glucose'
  | 'sleep_duration' | 'mood' | 'body_mass' | 'reaction_test' | 'amsler' | 'near_acuity'
  | 'face_fluid_index' | 'hydration' | 'exercise_minutes' | 'hematocrit' | 'wbc'
  | 'symptoms'
  | 'cabin_co2' | 'cabin_temp' | 'cabin_humidity' | 'radiation_dose';

// ---- doc 06 §4 Space weather types ----

export interface ProtonSample { timeTag: string; energy: '>=10 MeV' | '>=100 MeV' | string; fluxPfu: number; satellite?: number }
export type SScale = 0 | 1 | 2 | 3 | 4 | 5;
export interface SpaceWeatherState {
  mode: 'LIVE' | 'CACHED' | 'SNAPSHOT' | 'REPLAY';
  fetchedAt?: string; ageMinutes?: number;
  protons10: ProtonSample[]; protons100: ProtonSample[];
  sScale: SScale; s100Alert: boolean;
  sepEvents: Array<{ id: string; eventTime: string; instruments: string[]; link?: string }>;
}
export interface DoseLedger {
  crewId: string; careerPreMissionMsv: number; missionGcrMsv: number; missionSpeMsvModeled: number;
  totalMsv: number; pctOfCareerLimit: number; projectedEndMsv: number; pctProjected: number;
  speCurrentEventMsvModeled: number; sourceIds: string[];
}

// ---- doc 07 §1 Signal definition ----

export interface SignalDef {
  id: SignalId;
  label: string;                         // "Resting heart rate"
  shortWhat: string;                     // one sentence: what it is
  whyInSpace: string;                    // one–two sentences
  howToMeasure: string[];                // ≤ 5 steps
  hazard: Hazard;                        // primary NASA hazard
  nasaRiskIds: string[];                 // source ids of NASA risk pages
  bodyRegions: BodyRegionId[];           // 3D hotspots
  system: 'cardio' | 'neuro-eye' | 'musculoskeletal' | 'metabolic' | 'behavioral' | 'environment';
  cadenceDays: number;                   // expected measurement interval
  concerningDirection: 'up' | 'down' | 'both';
  personal: { enabled: boolean; params: PersonalParams[]; expectedShift?: (ctx: ShiftCtx) => number };  // doc 06 §1a
  earth: (o: Observation, ctx: RuleCtx) => LayerResult;
  space: (o: Observation, ctx: RuleCtx) => LayerResult;
  actions: Partial<Record<Verdict, ActionTemplate>>;
  sourceIds: string[];
}
