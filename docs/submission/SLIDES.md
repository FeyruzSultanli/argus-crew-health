# Seven-slide deck — final wording, visuals, speaker notes

Hard limit: **7 slides including the title** (more makes the project ineligible for Global Judging). English only.
No NASA logos, flags or mission patches; the ARGUS mark (`public/icons/icon.svg`) is our own. <!-- SRC_SPACEAPPS_GUIDE -->

Screenshots: sign in as **CMO** (PIN 2026), **Settings → Reset demo**, Mars transit, MD 143, dark theme, window
1440×900, browser zoom 100 %. Keep the header (with the SIMULATED DATA badge) in every screenshot of crew data.
HTML comments name the source of each number; delete them if your slide tool shows them.

---

## Slide 1 — Title

**Title:** ARGUS — Crew Health Autonomy

**Lines:**
- Personal · Space · Earth: health decisions on board, when Earth is minutes away
- Dark Star · İsmail Cem Şahin, Feyruz Sultanli, Fikret Mammadov, Rahil Bagirov
- NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions
- Live demo: feyruzsultanli.github.io/argus-crew-health · Prototype, not a medical device

**Visual:** the 3D body of K. Osei (`/body/c3`, lens Combined, heart lit Act), cropped to the body, on a dark
background, ARGUS mark top-left.

**Speaker notes:** ARGUS lets an astronaut measure, understand and act on their own health without waiting for Earth.
It is a working offline web app; the crew in it is simulated, the space-weather data and the measurements are real.

---

## Slide 2 — The problem

**Title:** Far from Earth, "normal" is not enough

**Lines:**
- The doctor is minutes away: up to about 22 minutes one way between Earth and Mars
  <!-- docs/01 §1, seed/missions.json note; no registry entry -->
- Space changes normal: in-flight hematocrit 10–12 % higher, resting core temperature about 1.0 °C higher, sleep
  about 6.1 h of 8.5 h scheduled <!-- SRC_HCT_FLIGHT, SRC_CORE_TEMP_STAHN, SRC_SLEEP_BARGER -->
- Population ranges miss the individual: a change can be large for one person and still "in range"
- Monitoring is periodic: discrete devices, vital signs mainly during exercise and spacewalks
  <!-- SRC_MIM_TEMPUS, SRC_IEEE_ASTROSKIN -->

**Visual:** three icons in a row (lucide: `Clock`, `Activity`, `CalendarClock`) with one short label each: "Delay",
"Adapting body", "Periodic checks". No screenshot.

**Speaker notes:** On a Mars mission the crew cannot wait for a ground loop. Fixed Earth thresholds raise false alarms
for normal space adaptations and miss changes that matter for one person. And today's checks are periodic, with
separate devices.

---

## Slide 3 — Our idea

**Title:** Every reading judged three ways

**Lines:**
- **Personal:** unusual for this astronaut? (robust baseline, z-score, CuSum)
- **Space:** expected or concerning in this mission? (NASA standards and evidence)
- **Earth:** would a clinic flag it? (clinical reference ranges) · plus **Quality:** can we trust the reading?
- Example, Mars transit day 143: K. Osei's resting pulse 69 bpm, her usual 58 → Personal **Act**, Space Nominal,
  Earth Nominal: **caught only by personal baseline** <!-- day-143 seed; simulated -->

**Visual:** the Body screen `/body/c3` with the Resting heart rate card open and lens = Personal (heart lit), showing
the layer row P Act · S Nominal · E Nominal and the "Caught only by personal baseline" marker. Optional small inset:
the same body with lens = Earth (heart neutral).

**Speaker notes:** This is the one thing fixed-threshold dashboards cannot show. Her pulse is normal on any lab sheet,
but eleven beats above her own normal for three days, with her temperature up too; ARGUS flags it and opens the
suspected-infection protocol. Wearable studies use the same personal-baseline idea. <!-- SRC_MISHRA_2020, SRC_ALAVI_2022 -->

---

## Slide 4 — Measure with what's on board

**Title:** Measure with what's on board

**Lines:**
- **Camera pulse:** 30 s with the laptop webcam, POS method, on-device face tracking, quality score from five checks;
  video never leaves the device <!-- SRC_POS_WANG2017, SRC_MEDIAPIPE_FACE; 30 s SRC_DEMO_QUALITY_SCORES -->
- **Reaction Self-Test:** 3 minutes, modeled on NASA's PVT-B; lapses compared with the astronaut's own pre-flight runs
  <!-- SRC_PVT_B_BASNER2011, SRC_PVT_SPINOFF -->
- **Vision check (screening only):** Amsler grid per eye and near acuity on the card-calibrated laptop screen, modeled
  on the ISS laptop tests; a new marked area since the last test → Watch, near the centre → Act
  <!-- SRC_VISION_ISS, SRC_SANS_CAMBRIDGE -->
- **Guided entry:** blood pressure, SpO₂, temperature, glucose, mass, sleep, mood, symptoms, each with "how to measure"
- **Face fluid-shift scan (experimental, not validated):** 3 s of face geometry vs your own first scan; trend only
  <!-- 3 s: SRC_DEMO_QUALITY_SCORES -->
- Validation line (no paired validation was done): "Camera pulse not yet compared with a reference device: shown with a
  quality score, used for screening and trends."

**Visual:** the Amsler result after Save in test mode (`/lab/vision?visionTest=1&amslerScript=peripheral`: two marked
squares, "new area since last test", Watch) next to the Reaction Self-Test result. Test-mode results keep their TEST
MODE badge in the crop. A camera pulse result taken by hand on a presenter (bpm + quality pill) can replace either.

**Speaker notes:** ARGUS measures with hardware the crew already carries. The camera result always comes with a quality
score and a retake path; we do not claim clinical accuracy. The vision check is a screening test on a screen the crew
calibrates with a bank card; we have not yet checked that calibration with a ruler. The face scan is experimental: a
trend against your own first scan, never an alarm, and not yet tried on real faces.

---

## Slide 5 — Radiation and environment

**Title:** Space weather, dose and cabin air

**Lines:**
- NOAA GOES proton flux: live, else cached, else bundled snapshot, always with its age → NOAA S-scale
  <!-- SRC_NOAA_SWPC_PROTONS -->
- Crew dose ledger vs NASA-STD-3001: career < 600 mSv, solar-event design limit < 250 mSv; Mars cruise 1.8 mSv/day
  measured by Curiosity RAD <!-- SRC_STD3001_RAD, SRC_RAD_CURIOSITY -->
- Storm **replay (synthetic)** S2-class profile → shelter advisory (demo policy), modeled event dose labeled
  illustrative <!-- SRC_DEMO_RADIATION_MODEL; docs/DECISIONS.md decision 4 -->
- Cabin CO₂ vs the 3 mmHg 1-hour limit and the 2.5 mmHg 7-day headache line <!-- SRC_STD3001_CO2, SRC_NASA_CO2_PAGE -->
- NASA DONKI event list: not connected in this build (service unreachable on build day)

**Visual:** Environment screen `/environment?replaySpeed=3600` during the replay at S2: shelter banner "Shelter
advised.", S tile with REPLAY + "synthetic S2-class profile (demo), not a recorded event", dose ledger with "Modeled —
illustrative". Small inset: the data-mode bar with LIVE (or CACHED / SNAPSHOT — write what it shows).

**Speaker notes:** The radiation panel reads real NOAA data and works offline from a cached copy. For the demo we replay
a synthetic storm because no real event happened in the seven days before the build; it is labeled on every card. Real crew dose
comes from dosimeters and real shelter calls from radiation specialists.

---

## Slide 6 — Built to plug into NASA

**Title:** Standards-traced, FHIR-ready, offline

**Lines:**
- NASA-STD-3001 items traced in the rules: V2 6004 CO₂ · V1 4029 ALARA · V1 4030 career dose · V1 4031 solar-event dose
  · V2 6012/6013 temperature and humidity · V2 6109 water <!-- SRC_STD3001_CO2, SRC_STD3001_RAD, SRC_STD3001_ECLSS -->
- FHIR-style R4 Bundle export (LOINC, UCUM, provenance, quality, verdict) and CSV <!-- src/domain/fhir -->
- Delay-aware Earth link: packet "arrives in 11 min (demo: 11 s)", separate flight-surgeon view
  <!-- SRC_DEMO_SIMULATION -->
- One local crew health data service with adapters, after NASA's CHP-IDSP idea; offline-first PWA
  <!-- SRC_CHP_IDSP_ASMA -->
- **Real vs simulated:** real = NOAA flux, NASA OSDR pre-flight blood anchors, published limits, your own
  measurements · simulated = crew and daily readings, cabin sensors, storm replay · modeled = Mars-transit delay,
  event dose · demo = readiness, demo band edges

**Visual:** split screen: Earth link `/earth?crew=c3&flags=1` after Send (packet card with the arrival line and
countdown, FHIR JSON preview opened) and the Limits page `/limits` (the real / simulated / modeled / demo table).

**Speaker notes:** Every threshold on screen links to its source with a verified, partial or demo label. The export
uses the shape a crew health data platform can read, and the flight surgeon only sees what has arrived over the delayed
link. The honesty table is in the app itself, on the Limits page.

---

## Slide 7 — Impact and next steps

**Title:** Decisions on board, when Earth is minutes away

**Lines:**
- Impact: Earth-independent crew care; the same personal-baseline approach for remote and rural care on Earth
  <!-- SRC_CSA_WHY_SCIENCE -->
- **New:** most entries we reviewed check readings against fixed thresholds; ARGUS asks "is this unusual for this
  astronaut?" and shows which layer raised the flag
  <!-- docs/03_COMPETITIVE_ANALYSIS.md §1.2 and §3: public repositories for this challenge, snapshot of 14 Nov 2026 -->
- **Also:** measures with on-board hardware · radiation tied to each crew member's dose ledger · every number
  sourced or labeled demo · offline and FHIR-ready for the delay
- Covers the challenge: indicators, camera and keyboard input, guidance, clickable body, charts, colour coding,
  gamification, prompts, six environments (full table: CHALLENGE_COVERAGE.md)
- Next: camera-pulse validation against a reference device, clinical review of demo thresholds, device adapters,
  encryption at rest (also open: a ruler check of the vision calibration and face-scan trials, see slide 4)
- Try it: scan the QR code (PIN 2026)

**Visual:** QR code of `https://feyruzsultanli.github.io/argus-crew-health/` (generate it in the slide tool or any
offline QR generator; no third-party logo inside the QR) next to a small Bridge screenshot (`/` as CMO: Crew at a
glance with K. Osei Act and the "Caught only by personal baseline" counter).

**Speaker notes:** Most entries check readings against fixed thresholds. ARGUS asks a better question: is this unusual for
this astronaut, in this environment, and can we trust the measurement? And it measures with hardware already on
board. Do not claim it is clinically more accurate: the crew data is simulated, some thresholds are demo parameters,
the camera pulse has not been compared with a reference device and the face scan is experimental. The claim is a
better question and honest labels, not a better diagnosis. What it needs next is validation against reference
devices and a clinical review. Scan the code to try it; the demo PIN is 2026.
