# Project page — ready to paste into the Space Apps submission form (English)

One block per form field, in the form's order. Copy the text **inside each block** (between the horizontal rules under
"Paste:") into the field. This file has no source comments, so it can be pasted into rich-text fields as is.
Team: **Dark Star** — İsmail Cem Şahin, Feyruz Sultanli, Fikret Mammadov, Rahil Bagirov.

---

## 1. Project Name

Paste:

ARGUS — Crew Health Autonomy

---

## 2. Summary *

Limit 1,500 characters (the form counts characters). This text: **1,011 characters**, 160 words.

Paste:

On a Mars mission a message to the flight surgeon takes many minutes each way, Earth reference ranges do not fit a body adapting to spaceflight, and astronauts are measured only periodically, with separate devices. ARGUS is an offline-first web app that helps a crew measure, understand and act on their own health. Every reading is judged three ways: against the astronaut's own baseline, against space-adapted rules from NASA sources, and against Earth reference ranges, plus a data-quality check. The screen says which layer raised the flag, and counts the concerns caught only by the personal baseline. ARGUS measures with what is on board: webcam pulse, a 3-minute reaction test modeled on NASA's Reaction Self-Test, an on-screen vision check (screening only) and guided vital-sign entry. It tracks NOAA proton flux and a crew dose ledger against NASA-STD-3001 limits, and sends FHIR-style packets over a delayed Earth link. The crew is simulated; the space-weather data and your own measurements are real.

---

## 3. Project Demonstration *

One full https URL: the 7-slide deck. GitHub is allowed; the link opens without a login (the repository is public).

Paste:

https://github.com/FeyruzSultanli/argus-crew-health/blob/main/docs/submission/slides/ARGUS-slides.pdf

---

## 4. Project *

One URL. Recommended — the repository (its README links the live demo and the slides):

https://github.com/FeyruzSultanli/argus-crew-health

Alternative — the live demo: https://feyruzsultanli.github.io/argus-crew-health/

---

## 5. Project Details *

One rich-text field: paste everything from "Live demo" down to the end of section 7.

Paste:

Live demo: https://feyruzsultanli.github.io/argus-crew-health/ (sign in with demo PIN 2026)
Repository: https://github.com/FeyruzSultanli/argus-crew-health
Team Dark Star: İsmail Cem Şahin, Feyruz Sultanli, Fikret Mammadov, Rahil Bagirov

**What is real and what is simulated.** The four crew members, their daily readings, the cabin sensors and the
solar-storm replay are simulated, and the app labels them SIMULATED or REPLAY on every screen. Real: the NOAA proton
flux, the NASA OSDR pre-flight blood values used as anchors, the published limits, and anything you measure yourself
(camera pulse, reaction test, vision check, manual entry). ARGUS is a prototype, not a medical device.

### 1. The problem

Long missions expose crews to five hazards NASA's Human Research Program has mapped: space radiation, isolation and
confinement, distance from Earth, altered gravity, and a hostile closed environment.
Three facts make self-assessment on board an engineering problem, not a dashboard exercise.

- **The doctor is minutes away.** Between Earth and Mars a one-way message takes up to about 22 minutes, depending
  on where the planets are, so a question and its answer can take most of an hour.
  Deep-space missions mean more communication delay and less reliance on Earth.
  In our demo the crew is on day 143 of a Mars transit, with a modeled one-way delay of 11 minutes.
- **Earth "normal" does not fit a body in space, and population ranges do not fit a person.** In long-duration
  ISS crews, hematocrit measured 10–12 % higher (relative) than before flight, part of it a sample-handling
  artefact; resting core body temperature rose about 1.0 °C over about 2.5 months; and measured sleep averaged about 6.1 hours against 8.5 hours scheduled. Fixed thresholds either raise false alarms for these known adaptations or miss a change
  that is large for one person but still "within range".
- **Astronauts are not monitored continuously.** The ISS medical kit is a collection of discrete devices used to
  assess crew health periodically, and vital signs are recorded mainly during exercise and
  spacewalks. A crew needs low-burden ways to measure, ideally with hardware it already
  carries.

### 2. What ARGUS does (four pillars, as built)

**A. Personal · Space · Earth verdict, plus data quality.** Every health signal gets three independent judgements:
is it unusual for this astronaut (personal baseline), is it expected or concerning in this mission environment
(space rules from NASA standards and evidence), and would a clinic on Earth flag it (Earth reference ranges). A
quality layer asks whether the reading can be trusted. The combined verdict is one of Nominal, Expected in space,
Watch, Act or No data, and the screen always says which layer drove it. The headline counter is **"Caught only by
personal baseline"**. In the demo, flight engineer K. Osei's resting pulse is 69 bpm on day 143: normal for the
Earth and space rules, but 11 beats above her own usual 58 bpm, so the personal layer says Act.

**B. Measure with what is on board (Measurement Lab).**
- Camera pulse: resting pulse from the laptop webcam in 30 seconds with the published POS remote-photoplethysmography
  method, on-device face tracking (MediaPipe Face Landmarker, self-hosted), and a quality score from five checks
  with plain-word reasons and an honest "retake" path. Video stays on the device; only the number is saved.
- Reaction Self-Test: a 3-minute psychomotor vigilance test modeled on NASA's PVT-B "Reaction Self-Test"
  (stimulus every 1–4 s, lapse at 355 ms or more), scored against the astronaut's own pre-flight lapses.
- Manual vitals with "how to measure" cards: blood pressure, heart rate, SpO₂, temperature, glucose (mg/dL or
  mmol/L), body mass, sleep, mood and a symptom checklist; plus a two-tap quick check-in (mood, sleep, symptoms).
- Vision check, screening only (not a diagnosis), modeled on the ISS laptop vision tests: the screen is calibrated
  with a bank card; an Amsler grid per eye (20 × 20 squares of 5 mm) where the astronaut marks wavy, blurred or missing
  areas, compared with the previous test ("new area since last test"); and near acuity with a tumbling E at 60 cm.
  A new marked area gives Watch and a new square near the centre gives Act, through the existing vision rules and the
  in-flight exam schedule. The calibration is set by the user with a card and has not yet been checked independently
  with a ruler.
- Face fluid-shift scan, experimental and not validated: a 3-second scan measures cheek width, jaw width and eye
  opening relative to the distance between the pupils, from on-device face landmarks. No pre-flight scan exists in
  this demo, so the first scan on a device is the reference. Trend only: it never raises Watch or Act on its own, and
  no image is saved. It has not yet been tried on real faces.
- Coming next (not in this build): device import from wearables and dosimeters.

**C. Radiation and environment awareness.**
- NOAA GOES proton flux (live, else the last cached copy, else a bundled snapshot, always with its age), converted
  to the NOAA S-scale (S1 at 10 pfu at ≥ 10 MeV).
- A crew dose ledger against the NASA-STD-3001 limits: career effective dose below 600 mSv, and below 250 mSv for the
  design solar particle event. Mars-cruise cosmic-ray dose uses the 1.8 mSv/day measured by
  Curiosity's RAD instrument on the way to Mars. Solar-event dose is modeled and labeled
  "Modeled — illustrative".
- A shelter advisory, labeled as a demo policy; real shelter calls come from the mission's radiation specialists.
- A solar-storm replay for the demo: a synthetic S2-class profile, always badged "REPLAY — synthetic, not a
  recorded event". No real event (≥ 10 pfu) occurred in the 7 days before the build, so nothing recorded was
  available to replay.
- Cabin CO₂ against the NASA-STD-3001 1-hour limit of 3 mmHg and the 2.5 mmHg 7-day line that keeps headache risk
  below 1 %; cabin temperature and humidity against the standard's limits (simulated cabin sensors).

**D. Built to plug into NASA.**
- Rules trace to NASA-STD-3001 items: V2 6004 (CO₂), V1 4029 (ALARA), V1 4030 (career dose), V1 4031 (solar-event
  dose), V2 6012 / 6013 (temperature and humidity), V2 6109 (water).
- Export as a FHIR-style R4 Bundle (Patient + Observation, LOINC and UCUM codes, provenance, quality and verdict
  extensions) and as CSV.
- A delay-aware Earth link: the crew sends a compact packet to the flight surgeon, who sees it in a separate view
  only after the modeled delay ("arrives in 11 min (demo: 11 s)"), and can reply over the same delay.
- Architecture after NASA's Crew Health and Performance Integrated Data System Platform idea: one local crew health
  data service with source adapters and sinks.

Also on board: a clickable 3D body (HRA reference anatomy, male and female, with a 2D fallback), a mission-day
scrubber that replays the timeline, trends with personal bands, a CMO crew overview, today's measurement plan with
streaks, points, badges and a readiness index (demo), five protocols, and an offline handbook of 40 entries with a
rule-based Ask box.

### 3. How it works

**Three-layer verdict.** Each signal is defined once (21 signals) with its personal-baseline settings, a space rule
and an Earth rule. A pure TypeScript domain core evaluates the three layers and a quality layer, then combines them:
a known spaceflight adaptation is downgraded to "Expected in space"; a poor-quality reading cannot raise Act; the
result names the driving layer, the action and the source of every threshold.

**Personal baseline statistics.** For each astronaut and signal: a robust pre-flight reference (median and median
absolute deviation with a spread floor), an adaptive in-flight reference over the last 14 days of normal readings,
a robust z-score, a CuSum that accumulates smaller shifts over several days, and a small state machine with hysteresis so a single reading
never raises Act. The same idea is published for wearables: resting heart rate compared with a personal baseline
flagged infections before symptoms. No machine learning: there is no public in-flight vital-sign data to train on, and these
statistics can be checked line by line.

**Camera pulse pipeline.** Webcam frames (640×480) → MediaPipe face landmarks → forehead and cheek regions → mean
red, green and blue per frame → resampling to 30 Hz → POS projection → 0.7–3.0 Hz band-pass → Welch spectrum → pulse
at the spectral peak, with five quality checks: signal-to-noise, consistency between the two halves of the 30-s
window, head motion, lighting (including clipped pixels) and face presence. Processing runs in a web worker in memory; frames are never
stored or sent.

**Architecture.**

```
NOAA GOES proton flux --(live / cached / bundled snapshot)--> Crew health data service
NASA OSDR pre-flight blood values (bundled) --> Simulator (seeded, labeled SIMULATED) --> Crew health data service
Measurement Lab (camera pulse in a worker, Reaction Self-Test, vision check, face scan (experimental), manual entry)
  --> Crew health data service
Crew health data service <--> IndexedDB (local, offline)
Crew health data service --> Domain core (signals, rules, personal baseline, verdict, readiness)
Crew health data service --> Crew and CMO screens
Crew health data service --(FHIR-style packet, after the modeled delay)--> Flight surgeon view
```

Everything runs in the browser as an installable PWA. The network is needed only for live NOAA data; rules, baseline,
measurements, 3D body and handbook work offline.

### 4. Benefits and impact

- **Earth-independent operations.** The crew sees in seconds who needs attention, why, and the next step, without
  waiting for a ground loop that can take most of an hour on a Mars mission.
- **Fewer false alarms, fewer misses.** The space layer explains known adaptations (for example short in-flight sleep
  is "Expected in space"), and the personal layer catches changes that are large for one person but inside every
  population range.
- **Hardware the crew already has.** A laptop camera and screen replace extra devices for frequent, low-burden checks.
- **On Earth too.** The same personal-baseline approach applies to remote, rural or isolated care where a clinician is
  far away. Findings from space research already help with osteoporosis, cardiovascular disorders and type-2 diabetes
  on Earth.
- **Standards-ready.** NASA-STD-3001 traceability and a FHIR-style export make the output readable by a flight surgeon
  and by a future crew health data platform.

### 5. Validity

- **Sources registry.** Every threshold, rate and limit on screen links to an entry in `seed/sources.json` with a
  status: verified (opened and checked at the source), partial (to be re-checked) or demo (our own parameter). Demo
  values show a "Demo parameter" tag. A test fails the build if the code cites a source id that is not in the
  registry.
- **Independent verification.** Every module is covered by automated tests. The personal baseline engine
  reproduces the ten test vectors of its specification exactly and agreed with an independent reference
  implementation on 600 random series (about 53,000 reading-days) with no disagreements. Radiation numbers (S-scale
  edges, dose ledgers, modeled solar-event dose, shelter table) were recomputed independently.
- **Real data where it matters.** Pre-flight blood values of the fictional crew are anchored on real, anonymised
  Inspiration4 measurements from NASA OSDR (OSD-569 blood counts, OSD-575 metabolic panel: 4 subjects × 3 pre-flight
  time points), with the dataset's own lab reference ranges.
- **Camera pulse validation.** The camera pulse has not yet been compared with a reference device; ARGUS shows a
  quality score and treats the result as a screening and trend value, not a clinical measurement.
- **Honest limits, on screen.** A Limits page lists what is real, measured, simulated, modeled, demo or experimental.
  The crew and their daily readings are simulated. The solar-storm replay is synthetic. The Mars-transit delay is a
  modeled demo profile, not derived from a trajectory. Readiness, demo band edges and baseline tuning constants are
  demo parameters. The vision check is screening only, and its screen calibration is set by the user with a bank card, not yet checked
  with a ruler. The face fluid-shift scan is experimental, not validated and trend only. The NASA DONKI event list is
  not connected (the service was unreachable on build day). ARGUS is a
  prototype, not a medical device: it never diagnoses or gives drug doses; its actions are re-measure, tell the Crew
  Medical Officer, send to the flight surgeon, or follow a listed protocol.

### 6. Tools and languages

TypeScript (strict), React 19, Vite 7, Tailwind CSS 4, React Router 7, Zustand, Dexie (IndexedDB), three.js with
React Three Fiber and drei, Recharts, Motion, MediaPipe Tasks Vision (Face Landmarker, self-hosted WASM and model),
vite-plugin-pwa (Workbox), Vitest, Testing Library, Playwright with axe-core, GitHub Actions and GitHub Pages. Fonts
IBM Plex (OFL), icons Lucide (ISC).

### 7. What's next

- Paired validation of the camera pulse against a reference device, in several lighting conditions and skin tones.
- A ruler check of the vision-check calibration, and trials of the face fluid-shift scan on real faces.
- Device adapters for smart-garment and actigraphy files (Bio-Monitor- and ARCHeR-style) and dosimeter readings.
- Clinical review of every demo threshold and baseline constant with flight surgeons.
- Encryption at rest, real identity and access, and a connection to a CHP-IDSP-style data platform.

---

## 6. Use of Super Intelligence (SI) *

A multi-select list ("select all that apply"); the exact option labels are only visible in the form.

Paste:

- Claude Code was used to write the code quickly and without errors.
- It was used to create the texts in the project.
- It was used for the presentation.

---

## 7. NASA Data *

Repeated rows of "Link Text" + "Link Url". All URLs come from `seed/sources.json` and are used by the build. Rows
1–8 are the most important; enter those first if time is short. The NASA DONKI event list is **not** listed: it is
not connected in this build.

| # | Link Text | Link Url |
|---|-----------|----------|
| 1 | NASA OSDR OSD-569: Inspiration4 complete blood count (pre-flight anchors, lab ranges) | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 |
| 2 | NASA OSDR OSD-575: Inspiration4 blood serum metabolic panel (glucose anchors) | https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 |
| 3 | NASA-STD-3001 technical brief OCHMO-TB-020: Ionizing Radiation Protection (dose limits) | https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf |
| 4 | NASA-STD-3001 technical brief OCHMO-TB-004: Carbon Dioxide (PDF) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf |
| 5 | NASA Human Research Program: 5 Hazards of Human Spaceflight | https://www.nasa.gov/hrp/hazards/ |
| 6 | NASA Spinoff 2013: Reaction Self-Test / behavioral alertness tools (PVT) | https://spinoff.nasa.gov/Spinoff2013/hm_1.html |
| 7 | NASA NTRS: Ocular surveillance in astronauts (basis of the vision check) | https://ntrs.nasa.gov/api/citations/20170009173/downloads/20170009173.pdf |
| 8 | NASA NTRS: Crew Health and Performance Integrated Data System Platform (AsMA 2025) | https://ntrs.nasa.gov/api/citations/20250004859/downloads/CHP-IDSP_AsMA%202025.pdf |
| 9 | NASA-STD-3001 technical brief OCHMO-TB-004: Carbon Dioxide (web page) | https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/ |
| 10 | NASA-STD-3001 technical brief OCHMO-TB-002: ECLSS, human-centered approach | https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf |
| 11 | NASA Human Research Program: Risks of Human Spaceflight | https://www.nasa.gov/hrp/risks/ |
| 12 | NASA NTRS: Ocular Health in ISS Crews (vision exam cadence) | https://ntrs.nasa.gov/api/citations/20150003006/downloads/20150003006.pdf |
| 13 | NASA NTRS: Medical Data Architecture capabilities and design | https://ntrs.nasa.gov/citations/20170009788 |
| 14 | NASA Integrated Medical Model (IMM) overview | https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/ |
| 15 | NASA NTRS: Earth Independent Medical Operations (AsMA 2023) | https://ntrs.nasa.gov/api/citations/20230007863/downloads/EIMO.AsMA2023.Lemery.final.pdf |
| 16 | NASA: Risk of Spaceflight-Induced Bone Changes | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ |
| 17 | NASA ISS research: Astronaut Exercise | https://www.nasa.gov/missions/station/iss-research/astronaut-exercise |
| 18 | NASA HRP Evidence Report: Risk of Renal Stone Formation | https://ntrs.nasa.gov/api/citations/20170004709/downloads/20170004709.pdf |
| 19 | NASA JPL: Curiosity RAD radiation data from the voyage to Mars (cruise dose rate) | https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/ |

---

## 8. Space Agency Partner & Other Data

Same row format. Rows 1–6 are the most important (partner data, the 3D body, the face landmark model); enter those
first if time is short. Partner agency data, other datasets and assets, the papers and Earth references the rules and
methods rest on, then the main open-source libraries. URLs from `seed/sources.json` (rows 1–27) and the
libraries' own homepages (rows 28–37).

| # | Link Text | Link Url |
|---|-----------|----------|
| 1 | NOAA SWPC: GOES proton flux (live S-scale, flux chart, offline snapshot) | https://www.swpc.noaa.gov/products/goes-proton-flux |
| 2 | Canadian Space Agency: Bio-Monitor smart shirt (device-import design reference) | https://asc-csa.gc.ca/eng/sciences/astroskin.asp |
| 3 | Canadian Space Agency: Monitoring radiation for astronaut health | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp |
| 4 | Canadian Space Agency: Why do we conduct science experiments in space? | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp |
| 5 | HRA 3D Reference Library (HuBMAP / NIH 3D, CC BY 4.0): the 3D body | https://humanatlas.io/3d-reference-library |
| 6 | MediaPipe Face Landmarker (Google, Apache-2.0): on-device face landmarks | https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js |
| 7 | Wang et al. 2017, Algorithmic principles of remote PPG (POS method) | https://doi.org/10.1109/TBME.2016.2609282 |
| 8 | Kossack et al. 2021, Region-based heart rate with remote PPG | https://openaccess.thecvf.com/content/ICCV2021W/V4V/papers/Kossack_Automatic_Region-Based_Heart_Rate_Measurement_Using_Remote_Photoplethysmography_ICCVW_2021_paper.pdf |
| 9 | Basner et al. 2011, Brief psychomotor vigilance test (PVT-B) | https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786 |
| 10 | Cognition Test Battery (University of Pennsylvania) | https://www.med.upenn.edu/uep/cognition.html |
| 11 | Alavi et al. 2022, Real-time alerting from wearable data (Nature Medicine) | https://www.nature.com/articles/s41591-021-01593-2 |
| 12 | Mishra et al. 2020, Pre-symptomatic detection of COVID-19 from smartwatch data | https://doi.org/10.1038/s41551-020-00640-6 |
| 13 | Barger et al. 2014, Sleep deficiency in astronauts (ScienceDaily report) | https://www.sciencedaily.com/releases/2014/08/140807215803.htm |
| 14 | Kunz et al. 2017, Hematologic indices during long-duration spaceflight | https://pmc.ncbi.nlm.nih.gov/articles/PMC5590186 |
| 15 | Stahn et al. 2017, Increased core body temperature in astronauts | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5701078/ |
| 16 | Zhang et al. 2020, First radiation dose measurements on the lunar surface (Chang'E-4) | https://doi.org/10.1126/sciadv.aaz1334 |
| 17 | Hassler et al., Mars surface radiation environment (MSL Curiosity RAD) | https://www.swsc-journal.org/articles/swsc/full_html/2016/01/swsc150074/F11.html |
| 18 | ISS dose-equivalent rate reported with the lunar-surface measurement | https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html |
| 19 | The case for expanding visual assessments during spaceflight (SANS) | https://www.cambridge.org/core/product/EC1625C4BE6DCD3511152AC711E4EB09/core-reader |
| 20 | SANS and vision (Eye, 2024) | https://www.nature.com/articles/s41433-024-03124-y.pdf |
| 21 | Dodgson 2004, Variation of human interpupillary distance | https://doi.org/10.1117/12.529999 |
| 22 | American Heart Association: blood pressure categories | https://www.heart.org/BPlevels |
| 23 | American Diabetes Association Standards of Care: glucose categories | https://pmc.ncbi.nlm.nih.gov/articles/PMC8865785 |
| 24 | AASM/SRS consensus: recommended amount of sleep for adults (Watson et al. 2015) | https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/ |
| 25 | OSHA occupational chemical database: carbon dioxide | https://www.osha.gov/chemicaldata/183 |
| 26 | MedlinePlus: vital signs | https://medlineplus.gov/ency/article/002341.htm |
| 27 | LogMAR chart (near-acuity Earth reference; marked partial in our registry) | https://en.wikipedia.org/wiki/LogMAR_chart |
| 28 | React | https://react.dev |
| 29 | Vite | https://vite.dev |
| 30 | three.js | https://threejs.org |
| 31 | Dexie.js | https://dexie.org |
| 32 | Recharts | https://recharts.org |
| 33 | Tailwind CSS | https://tailwindcss.com |
| 34 | Playwright | https://playwright.dev |
| 35 | Vitest | https://vitest.dev |
| 36 | Lucide icons (ISC) | https://lucide.dev |
| 37 | IBM Plex fonts (OFL) | https://github.com/IBM/plex |
