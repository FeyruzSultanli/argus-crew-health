---
id: radiation-dose
title: Radiation dose
category: signals
order: 20
signalIds: [radiation_dose]
keywords: [radiation, dose, msv, dosimeter, cosmic rays, solar, storm, spe, exposure, alara, career dose, shelter]
sourceIds: [SRC_STD3001_RAD, SRC_NASA_HAZARDS, SRC_NASA_RISKS, SRC_DEMO_RADIATION_MODEL, SRC_DEMO_SIMULATION]
summary: Your radiation dose in mSv, career before this mission plus this mission so far, against NASA-STD-3001 limits.
---

## What it is

Your effective radiation dose in mSv (millisieverts): career dose before this mission plus this mission so far.

## Why it matters in space

Space radiation is one of NASA's five hazards [SRC_NASA_HAZARDS], and radiation-induced cancer is a NASA human-research risk [SRC_NASA_RISKS]. NASA-STD-3001 limits career dose to below 600 mSv and asks for exposure as low as reasonably achievable [SRC_STD3001_RAD].

## How to measure

- Wear your personal dosimeter.
- ARGUS adds the daily cosmic-ray dose and any modeled solar-event dose to your ledger.

## How ARGUS judges it

- **Limits:** career dose below 600 mSv; a design limit below 250 mSv for a solar particle event (SPE); keep exposure as low as reasonably achievable [SRC_STD3001_RAD].
- **Space:** Watch when your projected end-of-mission career dose reaches 80 % of 600 mSv; Act at 95 % [SRC_DEMO_RADIATION_MODEL]. Act also when the modeled dose of the current solar event reaches 50 % of 250 mSv [SRC_DEMO_RADIATION_MODEL].
- **Earth:** not used; Earth occupational limits are different.
- **Your ledger:** the career dose before this mission is simulated [SRC_DEMO_SIMULATION]. The solar-event part is modeled and illustrative [SRC_DEMO_RADIATION_MODEL]. Real crew dose comes from personal dosimeters.
- The shelter advisory is a cabin-wide banner, not part of your verdict.

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_STD3001_RAD]
- [SRC_NASA_HAZARDS]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RADIATION_MODEL]
- [SRC_DEMO_SIMULATION]
