# 02 — NASA baseline: the systems we take as reference

ARGUS is designed as a *next step* for systems NASA and partner agencies already use. Every feature below
maps to one of them. Source IDs refer to `seed/sources.json`.

## 1. What runs on the ISS today

### 1.1 Crew Health Care System (CHeCS) — `SRC_CHECS_GUIDE`, `SRC_BME`
The ISS medical, environmental and countermeasure hardware suite. Three subsystems:

| Subsystem | Role | ARGUS counterpart |
|-----------|------|-------------------|
| Health Maintenance System (HMS) | Preventive, diagnostic and therapeutic care; medical kits; defibrillator | Measurement Lab, protocols, CMO view |
| Environmental Health System (EHS) | Air contaminants, microbes, water quality, acoustics, radiation | Environment & Radiation screen |
| Countermeasures System (CMS) | Exercise hardware and periodic fitness evaluation | Exercise/bone signals, routine plan |

On the ground, **Biomedical Engineer (BME)** flight controllers are the Mission Control representatives
for CHeCS. They monitor bioenvironmental data (CO₂, O₂), environmental health data (air, water, acoustics),
remotely operate CHeCS hardware, and work with the flight surgeon. **ARGUS moves a slice of the BME +
flight-surgeon situational awareness on board**, because on Mars missions that ground loop is too slow.

### 1.2 Periodic exams with discrete devices — `SRC_MIM_TEMPUS`, `SRC_IEEE_ASTROSKIN`
NASA describes the ISS medical kit as "a collection of discrete medical devices used to periodically
assess crew health status", and is evaluating a single integrated vital-sign monitor for exploration.
CSA's chief medical officer notes the misconception that astronauts are continuously monitored: vital
signs are recorded mostly during exercise and spacewalks.
→ ARGUS principle: **low-burden, frequent, self-administered measurements** and **one integrated view**.

### 1.3 Spaceflight Standard Measures — `SRC_STD_MEASURES`, `SRC_BHP_SM`
A consistent set of physiological, psychological and biological measurements taken from ISS crews before,
during and after flight. Areas include behavioural health, biochemistry, bone, cardiovascular, immunology,
muscle, ocular, sensorimotor. The behavioural-health part includes a neurocognitive test battery
(Cognition), actigraphy, proximity sensors, cardiovascular monitors and mood self-reports.
→ ARGUS signal catalog is organised by these same domains; our Reaction Self-Test and mood/sleep check-ins
mirror the BHP measures.

### 1.4 Cognition battery and the Reaction Self-Test (PVT-B) — `SRC_COGNITION`, `SRC_PVT_SPINOFF`
Cognition is a 10-test battery developed for NASA (Basner, Dinges, Gur et al.); it includes a validated
3-minute Psychomotor Vigilance Test (PVT-B), sensitive to sleep deprivation. On the ISS the PVT-B self test
was renamed the **Reaction Self-Test**, and it tells astronauts when their alertness drops below optimal.
→ ARGUS implements a PVT-B-style 3-minute test with personal-baseline scoring (doc 09 §4).

### 1.5 Vision surveillance for SANS — `SRC_VISION_ISS`, `SRC_SANS_CAMBRIDGE`
In flight, the ISS vision exam includes distance acuity (Acuity Pro software on a laptop), near acuity
(handheld card) and the **Amsler grid on a laptop**, plus imaging (fundoscopy, ultrasound, OCT).
Peer-reviewed work notes 69% of US ISS crew had at least one eye with > 20 µm peripapillary retinal nerve
fibre layer thickening on OCT.
→ ARGUS implements a calibrated on-screen Amsler grid and near-acuity screen, trended per eye (doc 09 §3).

### 1.6 CSA Bio-Monitor (Astroskin) — `SRC_BIOMONITOR`
A smart shirt plus tablet app that continuously records ECG/heart rate, blood pressure, breathing rate and
volume, SpO₂, skin temperature and activity; data are downlinked for analysis.
→ ARGUS supports importing smart-garment style streams (CSV/JSON) and displays them with provenance.

### 1.7 Tempus Pro (ESA/NASA) — `SRC_TEMPUS`, `SRC_TEMPUS_USABILITY`
A commercial multi-function integrated medical device: vital signs, built-in step-by-step procedure support
(iAssist), patient record, telemedicine, imaging. In NASA chamber tests, novice users connected sensors and
took vital signs easily thanks to iAssist guidance.
→ ARGUS "How to measure" guided flows follow the same pattern: short steps, pictures, live feedback.

## 2. What NASA flew on Artemis II (2026)

- **ARCHeR** (Artemis Research for Crew Health and Readiness) — wrist actigraphy measuring motion, sleep
  patterns and light exposure; data supported real-time health monitoring by crew and mission control.
  `SRC_ARCHER_NASA`, `SRC_ARCHER_GIZMODO`
- **Crew Active Dosimeter** carried by each crew member; thousands of radiation sensors in Orion.
  `SRC_ARCHER_GIZMODO`
- **Immune Biomarkers** and **Artemis II Standard Measures** (from the challenge resource list).
→ ARGUS ingests actigraphy-style sleep data and per-person dosimeter readings, and shows them next to
the vehicle environment.

## 3. What NASA is building for exploration (our architectural north star)

### 3.1 Medical Data Architecture (MDA) — `SRC_MDA`
Test beds that automatically collect data from devices (Astroskin vest, ECG, a medication Dose Tracker
app) into an electronic medical record and report it to the CMO and clinicians, designed to run standalone
because of delayed communications and no resupply.

### 3.2 CHP-IDSP — `SRC_CHP_IDSP_ASMA`, `SRC_CHP_IDSP_IWS`
The Crew Health and Performance Integrated Data System Platform: a back-end that acquires, processes,
stores and distributes integrated crew-health data from disparate sources to crew and ground users. NASA's
stated pain point: data spread across many systems. Example scenarios: periodic health status exam, chest pain.
→ ARGUS architecture (doc 05) mirrors this: **a local Crew Health Data Service** with source adapters
(manual, camera, wearable import, environment, space weather) and consumers (crew UI, CMO UI, Earth packet).
Our FHIR-style model makes the integration story concrete.

### 3.3 Integrated Medical Model (IMM) — `SRC_IMM`, `SRC_IMM_LIST`
A probabilistic model over **100 medical conditions** that have occurred or could occur in spaceflight,
outputting expected medical events, a Crew Health Index (CHI, 0–100 %), evacuation/LOCL probabilities and
resource use.
→ ARGUS "Crew readiness" (gamified, transparent) borrows the CHI idea of a 0–100 functional score but is
computed only from open flags and routine adherence — it is labeled a demo index, not an IMM output.

### 3.4 NASA-STD-3001 — `SRC_STD3001_CO2`, `SRC_STD3001_RAD`, `SRC_STD3001_ECLSS`, `SRC_OCHMO_OVERVIEW`
NASA's human-system standard (Vol 1 Crew Health, Vol 2 Human Factors/Habitability/Environment). Items we use:

| Item | Requirement (paraphrased) | ARGUS use |
|------|---------------------------|-----------|
| V2 6004 | 1-hour average ppCO₂ ≤ 3 mmHg in habitable volume | Cabin CO₂ rule |
| V1 4030 | Career effective dose < 600 mSv | Dose ledger |
| V1 4031 | Protect crew from design-reference SPE to < 250 mSv | SPE ledger / shelter logic |
| V1 4029 | ALARA principle | Radiation copy & shelter advice |
| V2 6012/6013 | Temperature/humidity operating limits and performance zone | Cabin comfort rule |
| V2 6109 | Water ≥ 2.5 L/day per crewmember | Hydration prompt |
| V2 7003 | Average 3,035 kcal/day per crewmember | Nutrition context |
| V2 6001 / 6020–6022 | Trend analysis, recording and display of environmental data | Environment trends |
| V1 3003 / 3004 | In-mission preventive and medical care | Whole product framing |

## 4. Mapping summary — "NASA has X, ARGUS adds Y"

| NASA today | Gap for deep space | ARGUS adds |
|-----------|---------------------|-----------|
| Periodic exams with discrete devices | Low frequency, high crew time | Frequent, low-burden self-measurement incl. webcam vitals |
| Ground BME + flight surgeon watch the data | 4–22 min one-way delay | On-board 3-layer verdict + delayed, compact Earth packet |
| Population/Earth thresholds | Miss individual change; false alarms from normal adaptation | Personal baseline + space-adapted layer |
| Data spread across systems (CHP-IDSP problem statement) | Hard to see the whole picture | One integrated body/timeline view with provenance |
| Radiation handled by specialists on the ground | Crew needs immediate situational awareness | Live S-scale, dose ledger, shelter advisory, cached offline |
| Reaction Self-Test, Amsler on laptop | Separate tools | Integrated into the same health record and trends |
