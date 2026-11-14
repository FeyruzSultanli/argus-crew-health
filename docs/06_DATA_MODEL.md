# 06 — Data model

All types live in `src/domain/types.ts`. The model mirrors HL7 FHIR R4 `Observation` closely enough that
export is a mapping, not a redesign.

## 1. Core types

```ts
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
```

## 1a. Contract types (`src/domain/types.ts` holds these verbatim; change both together)

```ts
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
```

**Mission clock.** `missionEpoch` = 00:00 UTC of (today's UTC date − (`demoMissionDay` − 1) days), fixed when the
demo is seeded or reset and stored in `settings`; the profile's demo day is therefore always "today".
`dateOf(day) = missionEpoch + (day − 1) days` for day ≥ 1 and `missionEpoch + day days` for negative days (there is
no day 0). Simulated observations get `effectiveAt = dateOf(day) + 07:00 UTC`. Measurements made in the app get the
real current time and the current `mission.missionDay`. Freshness in `<Value>`: whole days between the selected
mission day and the reading's mission day ("today", "1 d", "9 d"); hours only for readings made in this session.

## 2. Signal identifiers

```ts
export type SignalId =
  | 'heart_rate_rest' | 'blood_pressure' | 'spo2' | 'body_temp' | 'glucose'
  | 'sleep_duration' | 'mood' | 'body_mass' | 'reaction_test' | 'amsler' | 'near_acuity'
  | 'face_fluid_index' | 'hydration' | 'exercise_minutes' | 'hematocrit' | 'wbc'
  | 'symptoms'
  | 'cabin_co2' | 'cabin_temp' | 'cabin_humidity' | 'radiation_dose';
```

## 3. Canonical units, display units, validation ranges, LOINC

Validation ranges reject impossible input (not clinical thresholds). LOINC codes: confirm each
on loinc.org before release; mark unconfirmed ones `loincVerified: false` and still export them.

| signalId | Canonical (UCUM) | Display options | Valid input range | LOINC (verify) |
|----------|------------------|-----------------|-------------------|----------------|
| heart_rate_rest | `/min` | bpm | 25–220 | 8867-4 Heart rate |
| blood_pressure | `mm[Hg]` (components systolic/diastolic) | mmHg | sys 60–260, dia 30–160, sys > dia | 85354-9 panel; 8480-6 systolic; 8462-4 diastolic |
| spo2 | `%` | % | 50–100 | 59408-5 SpO₂ by pulse oximetry |
| body_temp | `Cel` | °C / °F | 30–45 °C | 8310-5 Body temperature |
| glucose | `mg/dL` | mg/dL / mmol/L (÷18.016) | 20–600 mg/dL | 2339-0 Glucose [Mass/volume] in Blood |
| sleep_duration | `h` | h:mm | 0–16 | 93832-4 Sleep duration |
| mood | `{score}` (1–5) | 1–5 faces | 1–5 | local code `argus-mood` |
| body_mass | `kg` | kg / lb | 30–200 | 29463-7 Body weight |
| reaction_test | `/s` — mean response speed (mean of 1000/RT_ms); components `medianRtMs`, `lapses`, `falseStarts`, `nStimuli` | s⁻¹; median ms; lapses | 1.0–10.0 s⁻¹ | local code `argus-pvt` |
| amsler | `{areas}` | count of marked cells | 0–400 | local `argus-amsler` |
| near_acuity | `{logMAR}` | logMAR / Snellen-equivalent | −0.3–1.3 | local `argus-acuity` |
| face_fluid_index | `1` (ratio) | % vs baseline | 0.5–2.0 | local `argus-face` |
| hydration | `L/d` | L | 0–8 | local `argus-water` |
| exercise_minutes | `min/d` | min | 0–300 | local `argus-exercise` |
| hematocrit | `%` | % | 20–70 | 4544-3 Hematocrit |
| wbc | `10*3/uL` | ×10³/µL | 0.5–50 | 6690-2 Leukocytes |
| cabin_co2 | `mm[Hg]` | mmHg | 0–30 | local `argus-ppco2` |
| cabin_temp | `Cel` | °C | 5–40 | local |
| cabin_humidity | `%` | % RH | 0–100 | local |
| radiation_dose | `mSv` | mSv | 0–2000 | local `argus-dose` |

## 4. Space weather types

```ts
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
```

## 5. FHIR export mapping

| ARGUS | FHIR R4 Observation |
|-------|---------------------|
| `id` | `id` |
| `signalId` | `code.coding` (LOINC if available, else `system: "https://argus.local/codes"`) |
| `value`/`unit` | `valueQuantity { value, unit, system: "http://unitsofmeasure.org", code }` |
| `components` | `component[]` (e.g., BP systolic/diastolic) |
| `effectiveAt` | `effectiveDateTime` |
| `crewId` | `subject.reference = "Patient/<crewId>"` (fictional) |
| `source` | `device` / `method.text` / `extension[argus-source]` |
| `quality` | `extension[argus-quality]` {score, label, reasons} |
| verdict | separate `Observation.interpretation` with codes H/L/N + `extension[argus-verdict]` |
| sources | `extension[argus-source-ids]` |

Bundle: `{ resourceType: "Bundle", type: "collection", entry: [Patient×n, Observation×m] }`.
Validate shape in tests with a minimal JSON schema (no external validator needed).

## 6. Crew seed (`seed/crew.json`)

Four fictional crew. Do **not** use real astronaut names. Suggested:

| id | displayName | role | CMO | sex | age | OSDR anchor |
|----|-------------|------|-----|-----|-----|-------------|
| c1 | R. Vance | Commander | no | male | 47 | OSD-569 C001 |
| c2 | M. Ito | Pilot | no | male | 41 | OSD-569 C002 |
| c3 | K. Osei | Flight engineer | no | female | 38 | OSD-569 C003 |
| c4 | L. Duarte | Mission specialist | **yes** | female | 44 | OSD-569 C004 |

Anchor mapping is arbitrary (we do not know or imply anything about the real I4 crew), **except** that the
anchor's lab reference ranges must match the fictional crew member's sex: the OSD-569 file prints a
sex-specific hematocrit range next to each value (e.g., 38.5–50 % vs 35–45 %). Read the
range columns and assign C00x subjects with the male range to male crew and vice versa (re-map the table
above if needed and record the final mapping in `docs/DECISIONS.md`). Use only
the pre-flight CBC/CMP values (L-92, L-44, L-3) as blood baselines, label "Pre-flight values from NASA OSDR
OSD-569 (anonymised commercial crew data)". Vitals baselines are simulated.
