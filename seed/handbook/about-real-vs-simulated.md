---
id: about-real-vs-simulated
title: What is real and what is simulated
category: about
order: 4
signalIds: []
keywords: [real, simulated, simulation, synthetic, demo, honest, honesty, limits, modeled, experimental, live, measured, medical device, data]
sourceIds: [SRC_NOAA_SWPC_PROTONS, SRC_DONKI, SRC_OSD569, SRC_OSD575, SRC_DEMO_SIMULATION, SRC_DEMO_RADIATION_MODEL, SRC_DEMO_READINESS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE, SRC_DEMO_QUALITY_SCORES]
summary: Which data in ARGUS is real, measured by you, simulated, modeled, a demo parameter or experimental.
---

## Real

- Live proton flux from NOAA [SRC_NOAA_SWPC_PROTONS]. The NASA DONKI event list is currently unavailable in this build [SRC_DONKI].
- Anonymised pre-flight blood values of commercial astronauts from NASA OSDR [SRC_OSD569] [SRC_OSD575], used as pre-flight anchors for the fictional crew.
- Published limits and evidence. Every number has a source badge with its status.

## Measured by you

- Camera pulse, the Reaction Self-Test, manual entries and imports are labeled MEASURED. They are compared with the selected crew member's simulated baseline.

## Simulated

- The four crew members, their daily readings and the scenarios are synthetic [SRC_DEMO_SIMULATION]. Every screen that shows them carries the SIMULATED DATA badge.
- Cabin sensors and each crew member's career dose before the mission are simulated [SRC_DEMO_SIMULATION].
- The solar event replay is a synthetic profile, badged REPLAY [SRC_DEMO_RADIATION_MODEL].

## Modeled

- Cosmic-ray dose rates are published measurements applied to the mission profiles as assumptions.
- The solar-event dose is an illustrative model [SRC_DEMO_RADIATION_MODEL].
- The Mars-transit comms delay is a modeled delay (demo) [SRC_DEMO_SIMULATION].

## Demo parameters

- The shelter advisory policy [SRC_DEMO_RADIATION_MODEL] and the readiness index, points and streaks [SRC_DEMO_READINESS].
- Rule band edges marked Demo parameter [SRC_DEMO_RULE_BANDS], the personal baseline constants [SRC_DEMO_BASELINE_ENGINE] and the measurement quality settings [SRC_DEMO_QUALITY_SCORES].

## Experimental

- The face fluid-shift index: experimental — not validated.
- Respiration rate from the camera: experimental and not built in this version.

## Not a medical device

ARGUS is a hackathon prototype for decision support. It is not a diagnostic or certified medical device and gives no drug doses. Its actions are limited to re-measuring, telling the Crew Medical Officer, sending a report to the flight surgeon and following a listed protocol.

## Sources

- [SRC_NOAA_SWPC_PROTONS]
- [SRC_DONKI]
- [SRC_OSD569]
- [SRC_OSD575]
- [SRC_DEMO_SIMULATION]
- [SRC_DEMO_RADIATION_MODEL]
- [SRC_DEMO_READINESS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
- [SRC_DEMO_QUALITY_SCORES]
