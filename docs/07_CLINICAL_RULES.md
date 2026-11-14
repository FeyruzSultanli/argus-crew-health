# 07 — Clinical rules and signal catalog

> **Safety framing.** These are decision-support rules for a hackathon prototype. Thresholds marked
> `partial` come from general clinical references or secondary sources and must be re-checked; `demo` values
> are our own choices and are labeled "Demo parameter" in the UI. Nothing here is medical advice.

## 1. How each signal is defined (code shape)

```ts
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
```

## 2. Verdict meanings (UI copy)

| Verdict | Colour token | Icon | Meaning shown to user |
|---------|-------------|------|-----------------------|
| NOMINAL | `--ok` | check | "Within your usual range." |
| EXPECTED | `--info` | orbit | "A known change in space. Keep doing your countermeasures." |
| WATCH | `--watch` | eye | "Unusual. Re-measure and keep an eye on it." |
| ACT | `--act` | alert-triangle | "Needs action now. Follow the next step and tell the CMO." |
| NO_DATA | `--muted` | circle-dashed | "No recent reading. Measure to update." |

## 3. Combining layers (`domain/verdict/combine.ts`)

```
input: personal, space, earth : LayerResult ; quality : Quality
1. Ignore layers whose verdict is NO_DATA (rule not applicable or no baseline yet).
2. If no layer remains → NO_DATA.
3. sev(NOMINAL)=0, sev(EXPECTED)=1, sev(WATCH)=2, sev(ACT)=3.
4. Adaptation downgrade: if earth ∈ {WATCH} AND space = EXPECTED AND personal ∈ {NOMINAL, EXPECTED, n/a}
     → final = EXPECTED, drivenBy = [space], explanation "Earth would flag this, but it is a known adaptation in space."
   If earth = ACT AND space = EXPECTED AND personal ∈ {NOMINAL, EXPECTED, n/a}
     → final = WATCH, drivenBy = [earth, space] (an Earth ACT is softened by one level only, never below WATCH).
5. Else final = argmax sev over remaining layers; drivenBy = all layers at that severity.
6. Quality gate: if quality.label = 'poor' → final = min(final, WATCH) and action = re-measure ("reading quality is poor").
   If quality.label = 'fair' and final = ACT driven only by personal → final = WATCH (avoid acting on a shaky single reading).
7. caughtOnlyByPersonal = sev(personal) ≥ 2 AND sev(space) ≤ 1 AND sev(earth) ≤ 1 (treating n/a as ≤ 1).
8. action = signal.actions[final] (fallback: the generic template below). If the quality gate of step 6 fired, the
   action stays "re-measure": step 6 wins over step 8.
9. The `quality` given to combine() is that of the best-quality reading of the mission day, so adding a fair camera
   reading never weakens a day that already has a good reading.
```
Unit tests must cover each branch (see doc 14 §2).

**Generic action templates.** Use these for every signal that has no signal-specific template in §4; do not write
other clinical wording. NOMINAL → no action. EXPECTED → "Known change in space. Keep doing your countermeasures."
(kind none). WATCH → "Re-measure. If it is still outside your usual range, tell the CMO." (kind remeasure).
ACT → "Tell the CMO now and send a report to the flight surgeon." (kind tell-cmo). NO_DATA → "Measure to update."
(kind remeasure). Quality gate → "Reading quality is poor. Re-measure." (kind remeasure).

## 4. Signal catalog

Notation: **E** = Earth layer, **S** = Space layer, **P** = Personal layer parameters (doc 08).
Source IDs in brackets → `seed/sources.json`.

**Band evaluation rule (applies to every band below).** First round the value to the signal's display precision
(bpm, mmHg blood pressure, %, mg/dL: integer; °C, hours, litres, mmHg CO₂: one decimal; logMAR: two decimals).
Then test in the order ACT → WATCH → EXPECTED → NOMINAL and return the first match; a value that matches no listed
band is NOMINAL. Ranges written `a–b` include both ends. Every band edge marked [demo] cites
`SRC_DEMO_RULE_BANDS` in addition to any real source named on the line.

### 4.1 Resting heart rate — `heart_rate_rest`
- Region: heart. System: cardio. Hazard: gravity. NASA risk: Cardiovascular Adaptations [SRC_NASA_RISKS].
- Cadence: 1 day. Direction: both (up is the main concern).
- **E**: general reference 60–100 bpm [SRC_EARTH_VITALS_GENERAL · partial]; because resting rates of 50–59 are
  common in fit adults, ARGUS uses NOMINAL 50–100; WATCH 40–49 or 101–130; ACT < 40 or > 130 [band edges demo].
  Note: a rise from 58 to 69 stays "normal" here — exactly why the personal layer matters (doc 08 TV-8).
- **S**: Same bands as Earth; no published in-flight resting-HR rule used [demo]. Context text: weightlessness alters
  circulation [SRC_NASA_RISKS].
- **P**: sigmaFloor = 2 bpm; direction both; WATCH/ACT per doc 08.
- Actions: WATCH → "Re-measure after 20 min seated rest (camera or wearable)." ACT → "Tell the CMO. Check
  temperature and symptoms. Open protocol: Suspected infection / overreaching."

### 4.2 Blood pressure — `blood_pressure` (components systolic/diastolic)
- Region: heart + blood vessels. System: cardio. Hazard: gravity.
- Cadence: 7 days (and with symptoms).
- **E** (adult categories) [SRC_EARTH_BP_ACC_AHA · verified]: ACT if systolic > 180 or diastolic > 120; otherwise
  WATCH if systolic 130–180 or diastolic 80–120, or if systolic < 90 or diastolic < 60 (low, [demo]); otherwise
  NOMINAL. (ARGUS merges the "normal" and "elevated" categories into NOMINAL — say so in the source drawer.)
- **S**: same bands [demo]; context: fluid shift toward head; orthostatic intolerance on return to gravity
  [SRC_NASA_RISKS].
- **P**: on systolic and diastolic separately; floors 5 / 4 mmHg; direction up.
- Actions: WATCH → "Re-measure twice, 1 min apart, seated, arm at heart level." ACT → "Re-measure now; if still
  above 180/120 tell the CMO immediately and notify the flight surgeon."

### 4.3 Oxygen saturation — `spo2`
- Region: lungs. System: cardio. Hazard: environment. NASA risk: Hypoxia [SRC_NASA_RISKS].
- Cadence: 7 days; after EVA prep / symptoms.
- **E** [SRC_EARTH_VITALS_GENERAL · partial]: NOMINAL ≥ 95 %; WATCH 90–94 %; ACT < 90 % [band edges below 95 % demo].
- **S**: same; context: EVA pre-breathe protocols raise mild hypoxia risk [SRC_NASA_RISKS]; cabin O₂ is in the
  Environment panel.
- **P**: floor 1 %; direction down.

### 4.4 Body temperature — `body_temp`
- Region: whole body/skin. System: metabolic. Hazard: environment.
- Cadence: 1 day, oral or ear thermometer (same device and site each time), or on symptoms. These bands are for
  body (core/oral) temperature. Wearable *skin* temperature runs several degrees lower and follows the cabin, so it
  must not be judged against them: if a skin-temperature stream is imported, show it as a trend only.
- **E** [SRC_EARTH_VITALS_GENERAL · partial]: NOMINAL 36.1–37.4 °C; WATCH 37.5–37.9 °C or 35.0–36.0 °C; ACT ≥ 38.0 °C or < 35.0 °C [band edges demo].
- **S**: same bands as Earth in the demo [demo]. Resting core body temperature was reported about 1 °C higher on
  the ISS, developing gradually over about 2.5 months [SRC_CORE_TEMP_STAHN · verified]. ARGUS shows this as context
  text ("Why it matters in space") and keeps the expected shift at 0, because the simulated crew has no such rise.
  Do not enable a shift in the demo.
- **P**: floor 0.2 °C; direction up. Combined with HR rise → infection protocol suggestion.

### 4.5 Blood glucose — `glucose` (mg/dL; context: fasting | random | post-meal)
- Region: pancreas/liver. System: metabolic. Hazard: environment (nutrition). NASA risk: Inadequate Food and Nutrition.
- Cadence: 14 days (fingerstick) or as needed.
- **E** [SRC_EARTH_GLUCOSE_ADA · verified]: fasting NOMINAL 70–99; WATCH 100–125 or 54–69; ACT ≥ 126 (repeat to confirm) or < 54.
  Random or post-meal: NOMINAL 70–139; WATCH 140–199 or 54–69; ACT ≥ 200 or < 54. (≥ 200 and the low limits follow
  the same source; the 140–199 band is the source's 2-hour tolerance-test range reused here as a [demo] choice.)
- **S**: same bands [demo]; context: diet and inactivity changes; Earth research link to Type-2 diabetes from CSA
  [SRC_CSA_WHY_SCIENCE].
- **P**: fasting only; floor 5 mg/dL; direction both.
- Real-data hook: if OSD-575 metabolic panel includes glucose, use pre-flight values as personal anchors.

### 4.6 Sleep duration — `sleep_duration` (+ quality 1–5)
- Region: brain. System: behavioral. Hazard: isolation. NASA risk: Inadequate Sleep and Irregular Schedules.
- Cadence: 1 day (actigraphy / self-report). Uses 3-night rolling mean.
- **E**: adults ≥ 7 h recommended [SRC_EARTH_SLEEP_7H · partial] → WATCH if 3-night mean < 7 h.
- **S** [SRC_SLEEP_BARGER · verified]: NASA schedules 8.5 h, but measured ISS average was ~6.1 h →
  NOMINAL ≥ 7.0 h; EXPECTED for 5.5–6.9 h ("typical in flight; protect your sleep"); WATCH < 5.5 h [demo];
  ACT if the 3-night mean is < 5.0 h, OR < 5.5 h with Reaction Self-Test WATCH/ACT the same day [demo].
  (The WATCH line sits below the measured in-flight average on purpose: a line at 6.0 h would flag about half of
  ordinary in-flight nights.)
- **P**: floor 0.3 h; direction down; in-flight expected shift −0.9 h (doc 08 §7, TV-4).
- Countermeasures card: light, schedule, noise, caffeine timing [general, demo wording].
- This is the flagship "Earth false alarm" example → EXPECTED via adaptation downgrade.

### 4.7 Mood — `mood` (1–5, optional note)
- Region: brain. System: behavioral. Hazard: isolation. NASA risk: Behavioral Changes and Psychiatric Disorders.
- Cadence: 1 day. Uses 3-day mean.
- **E**: no Earth threshold applied → NO_DATA (n/a).
- **S** [demo]: WATCH if 3-day mean ≤ 2.5; ACT if ≤ 1.5. Action for both: "Tell the CMO. You can ask for a private
  conference with the flight surgeon." No keyword matching on the free-text note — the note is stored and shown to
  the CMO, nothing else.
- **P**: floor 0.4; direction down.

### 4.8 Body mass — `body_mass`
- Region: muscles. System: musculoskeletal/metabolic. Hazard: gravity, environment (nutrition).
- Cadence: 7 days (ISS measures mass by acceleration devices; here: manual entry).
- **E**: WATCH if loss ≥ 5 % vs pre-flight within 30 days; ACT ≥ 10 % [demo].
- **S**: same [demo]; context: NASA plans ~3,035 kcal/day per crewmember [SRC_STD3001_ECLSS · verified].
- **P**: floor 0.5 kg; direction down.

### 4.9 Reaction Self-Test — `reaction_test` (doc 09 §4)
- Region: brain. System: behavioral. Hazard: isolation (sleep/fatigue). Source: [SRC_COGNITION, SRC_PVT_SPINOFF · verified].
- Cadence: 7 days, and after poor sleep.
- `Observation.value` = mean response speed (mean of 1000/RT_ms, unit `/s`); `components` = `medianRtMs`, `lapses`
  (RT ≥ 355 ms), `falseStarts`, `nStimuli`. "Baseline lapses" = median `lapses` of the pre-flight runs
  (`ctx.preflight.components.lapses`).
- **E**: n/a (NO_DATA).
- **S**: WATCH if lapses ≥ baseline lapses + 3; ACT if ≥ baseline + 6 [demo].
- **P**: on speed; floor 0.1 s⁻¹; direction down.

### 4.10 Amsler grid — `amsler` (per eye)
- Region: eyes. System: neuro-eye. Hazard: gravity. NASA risk: SANS. Source: [SRC_VISION_ISS · verified], [SRC_SANS_CAMBRIDGE · verified].
- Cadence: mission days 10, 30, 60, 90, 120, then every 30 [SRC_OCULAR_CADENCE · verified — modeled on research cadence].
- Value: number of grid cells marked distorted/missing; plus diff vs previous map.
- **E**: any marked cell → WATCH ("see an eye professional"); new central (within 2 cells of centre) → ACT.
- **S**: any new cell vs previous map → WATCH + schedule imaging/remote eye exam; new central → ACT + notify surgeon.
- **P**: disabled (count data; diff logic used instead).

### 4.11 Near visual acuity — `near_acuity` (logMAR, per eye)
- Region: eyes. Cadence: as Amsler.
- **E**: WATCH if worse than 0.3 logMAR (≈ 20/40) [SRC_EARTH_ACUITY · partial]; the 0.3 cut-off is [demo].
- **S**: hyperopic (far-sighted) shift is a known SANS feature; "Space Anticipation Glasses" are carried
  [SRC_SANS_EYE_NATURE · verified] → EXPECTED if decline ≤ 0.1 logMAR vs pre-flight and corrected with glasses;
  EXPECTED also for a decline of 0.11–0.19 logMAR, with or without glasses [demo]; WATCH if decline ≥ 0.2 [demo].
  (The 0.11–0.19 band was added on 14 Nov 2026 — decision 6 in `docs/DECISIONS.md`; before it those values matched
  no band.)
- **P**: floor 0.05; direction up (higher logMAR = worse).

### 4.12 Face fluid-shift index — `face_fluid_index` (experimental, P2)
- Region: face/head. Hazard: gravity.
- **E**: n/a. **S**: increase vs pre-flight in weightlessness → EXPECTED (fluid shift) [SRC_NASA_RISKS context];
  never WATCH/ACT on its own. **P**: trend display only (enabled: false).
- UI badge: "Experimental — not validated".

### 4.13 Hydration — `hydration` (L/day)
- Region: kidneys. Hazard: environment.
- **S/E**: NASA provisions at least 2.5 L water per crewmember per day [SRC_STD3001_ECLSS · verified] →
  WATCH if 2-day mean < 2.0 L [demo]; context: kidney-stone risk rises with bone calcium loss
  [SRC_KIDNEY_STONE_NASA · partial].
- **P**: floor 0.2 L; direction down.

### 4.14 Exercise minutes — `exercise_minutes`
- Region: skeleton (spine, hips, femurs) + muscles. Hazard: gravity. NASA risks: Bone Changes; Reduced
  Cardiorespiratory and Musculoskeletal Fitness.
- **S**: bone mineral density falls ~1–1.5 %/month in flight [SRC_BONE_NASA · verified]; plan ≈ 2 h/day exercise
  [SRC_EXERCISE_2H · verified] → WATCH if 7-day adherence < 70 % of plan [demo]; ACT < 40 % [demo].
- **E**: n/a.

### 4.15 Hematocrit — `hematocrit` (P1, extended)
- Region: blood vessels. **E**: lab range from OSD-569 file (sex-specific) [SRC_OSD569 · verified].
- **S**: hematocrit reported about 10–12 % (relative) higher in flight, part of it a sample-delay artefact
  [SRC_HCT_FLIGHT · verified] → NOMINAL for no rise; EXPECTED for rises up to +12 % relative to pre-flight; WATCH
  above that [demo].
- **P**: disabled until the expected in-flight shift is source-verified (doc 08 §7).

### 4.16 White blood cells — `wbc` (P1, extended)
- Region: blood/lymph. **E**: OSD-569 lab range 3.8–10.8 ×10³/µL [SRC_OSD569 · verified].
- **S**: immune changes in flight; dormant virus reactivation can cause rashes [SRC_NASA_RISKS] → WATCH if
  > 40 % above or below own pre-flight [demo].

### 4.17 Symptoms — `symptoms` (checklist)
Headache, congestion, nausea/motion sickness, rash, back pain, vision change, insomnia, low mood, fatigue.
No numeric verdict; symptoms raise protocol suggestions and combine with other signals:
- headache + cabin CO₂ 7-day ≥ 2.5 mmHg → "CO₂ headache" protocol.
- rash or fever + HR personal WATCH → "Suspected infection" protocol.
- vision change → schedule Amsler/acuity now.

### 4.18 Cabin CO₂ — `cabin_co2` (crewId = 'cabin')
- Hazard: environment. Sources: [SRC_STD3001_CO2 · verified], [SRC_NASA_CO2_PAGE · verified].
- **S**: 1-h average > 3 mmHg → WATCH ("above NASA-STD-3001 limit"); 7-day average ≥ 2.5 mmHg → WATCH
  ("headache risk above 1 %"); ≥ 6.8 mmHg → ACT [SRC_CO2_ICES_LIMITS · partial — time-limited exposure band].
- **E**: workplace limit 5,000 ppm ≈ 3.8 mmHg (0.5 %) [SRC_NASA_CO2_PAGE for the 0.5 % = 3.8 mmHg conversion;
  SRC_OSHA_CO2 · partial] → WATCH above 3.8 mmHg.
- Showcase: at 3.4 mmHg Earth says NOMINAL, space says WATCH → "missed by Earth".

### 4.19 Cabin temperature & humidity — `cabin_temp`, `cabin_humidity`
- [SRC_STD3001_ECLSS · verified]: performance zone 20–25 °C and 30–60 % RH → NOMINAL; within health limits
  18–27 °C → WATCH outside performance zone; outside 18–27 °C → ACT. Humidity: 30–60 % NOMINAL; 25–29 % or
  61–75 % WATCH; below 25 % or above 75 % ACT (a [demo] simplification of the V2 6012 temperature–humidity zone).

### 4.20 Radiation dose — `radiation_dose` (doc 10)
- [SRC_STD3001_RAD · verified]: career < 600 mSv; SPE < 250 mSv design limit; ALARA.
- **S**: WATCH when projected end-of-mission career dose ≥ 80 % of 600 mSv [demo]; ACT ≥ 95 % [demo];
  SPE-modeled dose for the current event ≥ 50 % of 250 mSv → ACT (shelter) [demo].
- **E**: n/a (Earth occupational limits are different and not used).
- The shelter advisory (doc 10 §6) is an environment-level banner, not a per-crew verdict: it does not change
  `radiation_dose` assessments, crew status rings or readiness.

## 5. Protocols (FR-HELP-3) — content outline

Each protocol: trigger, 4–8 steps, each step tagged `source:<id>` or `demo wording`, timer, "send to surgeon" end step.
Protocol ids, in table order (they are the `ProtocolId` type of doc 06 §1a — use them exactly): `suspected-infection`,
`spe-shelter`, `co2-headache`, `vision-change`, `sleep-debt`. Step wording = the key steps in the table, nothing added.

| Protocol | Trigger | Key steps (demo wording unless sourced) |
|----------|---------|------------------------------------------|
| Suspected infection | HR personal ≥ WATCH + temp WATCH, or rash/fever symptom | rest; re-measure HR & temp in 2 h; hydrate; isolate shared items; log symptoms; notify surgeon |
| SPE shelter | S-scale ≥ S2 or s100Alert (demo policy) | move to shelter location; wear dosimeter; reduce EVA; log time-in-shelter; follow Earth radiation team instructions [SRC_STD3001_RAD ALARA] |
| CO₂ headache | headache + CO₂ 7-day ≥ 2.5 | check CO₂ panel; ventilate sleep station/improve airflow; hydrate; re-check in 1 h [SRC_NASA_CO2_PAGE] |
| Vision change | Amsler new cells / acuity WATCH | repeat test each eye; use anticipation glasses if issued; schedule imaging exam; notify surgeon [SRC_VISION_ISS] |
| Sleep debt | sleep WATCH + reaction WATCH | protect next sleep window; light/schedule hygiene; avoid critical tasks if lapses high; re-test [SRC_SLEEP_BARGER] |

## 6. Body regions (3D hotspots) ↔ signals

| BodyRegionId | Mesh/organ | Signals |
|--------------|-----------|---------|
| brain | brain | sleep_duration, mood, reaction_test |
| eyes | left/right eyeball | amsler, near_acuity |
| face | head surface | face_fluid_index |
| heart | heart | heart_rate_rest, blood_pressure |
| lungs | lungs | spo2 |
| vessels | aorta / major vessels | hematocrit, wbc, blood_pressure |
| pancreas_liver | pancreas or liver | glucose |
| kidneys | kidneys/bladder | hydration |
| skeleton | spine, pelvis, femurs | exercise_minutes |
| muscles | thigh/calf region | body_mass, exercise_minutes |
| skin | body surface | body_temp, symptoms (rash) |
| whole_body | outline glow | radiation_dose |

Each region also has an **organ card**: function (1 sentence), what space does to it (1–2 sentences, sourced),
linked signals with verdicts.
