---
id: about-built-on-nasa
title: Built on what NASA uses
category: about
order: 5
signalIds: []
keywords: [nasa, iss, artemis, standards, nasa-std-3001, checs, standard measures, cognition, tempus, bio-monitor, archer, chp-idsp, imm, why, background]
sourceIds: [SRC_CHECS_GUIDE, SRC_BME, SRC_MIM_TEMPUS, SRC_IEEE_ASTROSKIN, SRC_STD_MEASURES, SRC_BHP_SM, SRC_COGNITION, SRC_PVT_SPINOFF, SRC_VISION_ISS, SRC_SANS_CAMBRIDGE, SRC_BIOMONITOR, SRC_TEMPUS, SRC_TEMPUS_USABILITY, SRC_ARCHER_NASA, SRC_ARCHER_GIZMODO, SRC_NASA_HRP_RESEARCH, SRC_MDA, SRC_CHP_IDSP_ASMA, SRC_CHP_IDSP_IWS, SRC_IMM, SRC_IMM_LIST, SRC_DEMO_READINESS, SRC_STD3001_CO2, SRC_STD3001_RAD, SRC_STD3001_ECLSS, SRC_OCHMO_OVERVIEW, SRC_EIMO]
summary: The ISS and Artemis systems and NASA standards that each ARGUS feature is modeled on.
---

## On the ISS today

- **Crew Health Care System:** the ISS medical, environmental and countermeasure hardware, made of the Health Maintenance System, the Environmental Health System and the Countermeasures System [SRC_CHECS_GUIDE]. In Mission Control, biomedical engineer flight controllers watch these data in real time and work with the flight surgeon [SRC_BME]. ARGUS moves a slice of that awareness on board.
- **Periodic exams:** the ISS uses a collection of discrete medical devices to assess crew health from time to time [SRC_MIM_TEMPUS], and vital signs are recorded mainly during exercise and spacewalks [SRC_IEEE_ASTROSKIN]. ARGUS adds frequent, low-effort self-measurement in one view.
- **Standard Measures:** consistent physiological, psychological and biological measurements before, during and after flight [SRC_STD_MEASURES]; the behavioural-health part includes a test battery, actigraphy and mood self-reports [SRC_BHP_SM]. ARGUS organises its signals by the same areas.
- **Cognition and the Reaction Self-Test:** a 10-test battery developed for NASA, with a validated 3-minute PVT-B [SRC_COGNITION], called the Reaction Self-Test on the ISS [SRC_PVT_SPINOFF]. ARGUS has a PVT-B-style test scored against your own baseline.
- **Vision surveillance:** the in-flight exam includes acuity software and an Amsler grid on a laptop [SRC_VISION_ISS]; eye changes are common in long-duration crew [SRC_SANS_CAMBRIDGE]. ARGUS has a calibrated on-screen grid and acuity test.
- **Bio-Monitor:** CSA's smart shirt and tablet app for heart activity, blood pressure, breathing, SpO₂, skin temperature and activity [SRC_BIOMONITOR]. Importing smart-garment style files is planned and not in this build.
- **Tempus Pro:** a commercial integrated medical device under study [SRC_TEMPUS]; with its step-by-step guidance, novice users took vital signs easily [SRC_TEMPUS_USABILITY]. ARGUS's "How to measure" cards follow that pattern.

## On Artemis II

- The ARCHeR wrist device measures motion, sleep patterns and light exposure [SRC_ARCHER_NASA].
- Each crew member carried a Crew Active Dosimeter [SRC_ARCHER_GIZMODO].
- NASA's Artemis II investigations include ARCHeR, Immune Biomarkers and Standard Measures [SRC_NASA_HRP_RESEARCH].

## What NASA is building for exploration

- **Medical Data Architecture:** test beds that collect device data into an electronic medical record for the CMO, designed to run standalone [SRC_MDA].
- **CHP-IDSP:** a platform to acquire, store and share integrated crew health data, because the data are spread across many systems today [SRC_CHP_IDSP_ASMA] [SRC_CHP_IDSP_IWS]. ARGUS mirrors the idea with one local crew health data service and a FHIR-style data model.
- **Integrated Medical Model:** a model of 100 spaceflight medical conditions with a Crew Health Index from 0 to 100 % [SRC_IMM] [SRC_IMM_LIST]. The ARGUS readiness index borrows the idea of a 0–100 score but is a demo index, not a model output [SRC_DEMO_READINESS].
- **Earth-independent medical operations:** NASA's direction toward medical decisions on board for crews with communication delay [SRC_EIMO].

## NASA-STD-3001 items ARGUS uses

- V2 6004: the 1-hour average CO₂ no more than 3 mmHg, used by the cabin CO₂ rule [SRC_STD3001_CO2].
- V1 4030: career effective dose below 600 mSv; V1 4031: solar-event design limit below 250 mSv; V1 4029: as low as reasonably achievable. Used by the dose ledger and the shelter advisory [SRC_STD3001_RAD].
- V2 6012 and 6013: cabin temperature and humidity limits and performance zone [SRC_STD3001_ECLSS].
- V2 6109: at least 2.5 L of water per crewmember per day; V2 7003: an average of 3,035 kcal per day [SRC_STD3001_ECLSS].
- The same career and solar-event limits appear in the NASA standards overview [SRC_OCHMO_OVERVIEW].

## Sources

- [SRC_CHECS_GUIDE]
- [SRC_BME]
- [SRC_MIM_TEMPUS]
- [SRC_IEEE_ASTROSKIN]
- [SRC_STD_MEASURES]
- [SRC_BHP_SM]
- [SRC_COGNITION]
- [SRC_PVT_SPINOFF]
- [SRC_VISION_ISS]
- [SRC_SANS_CAMBRIDGE]
- [SRC_BIOMONITOR]
- [SRC_TEMPUS]
- [SRC_TEMPUS_USABILITY]
- [SRC_ARCHER_NASA]
- [SRC_ARCHER_GIZMODO]
- [SRC_NASA_HRP_RESEARCH]
- [SRC_MDA]
- [SRC_CHP_IDSP_ASMA]
- [SRC_CHP_IDSP_IWS]
- [SRC_IMM]
- [SRC_IMM_LIST]
- [SRC_DEMO_READINESS]
- [SRC_STD3001_CO2]
- [SRC_STD3001_RAD]
- [SRC_STD3001_ECLSS]
- [SRC_OCHMO_OVERVIEW]
- [SRC_EIMO]
