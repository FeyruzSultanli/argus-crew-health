---
id: heart-rate
title: Resting heart rate
category: signals
order: 1
signalIds: [heart_rate_rest]
keywords: [pulse, heart, heart rate, resting heart rate, hr, bpm, beats, heartbeat, racing, infection, fever]
sourceIds: [SRC_NASA_RISKS, SRC_EARTH_VITALS_GENERAL, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE, SRC_DEMO_QUALITY_SCORES, SRC_DEMO_SIMULATION]
summary: How fast your heart beats at rest, judged against your own usual rate as well as space and Earth rules.
---

## What it is

How many times your heart beats per minute while you sit quietly at rest.

## Why it matters in space

Weightlessness alters circulation; cardiovascular adaptation is a NASA human-research risk [SRC_NASA_RISKS]. A rise against your own usual rate can matter even when it stays inside the normal Earth range.

## How to measure

- Rest seated (restrained) and quiet before you measure.
- Use the camera pulse in the Lab, a wearable or a pulse oximeter.
- Measure at the same time of day, before exercise.
- Enter the reading in beats per minute.

## How ARGUS judges it

- **Earth:** a general reference range is 60–100 bpm [SRC_EARTH_VITALS_GENERAL]. ARGUS widens it and counts 50–100 bpm as nominal, 40–49 or 101–130 bpm as Watch, and below 40 or above 130 bpm as Act [SRC_DEMO_RULE_BANDS].
- **Space:** the same bands as Earth. No published in-flight resting heart-rate rule is used [SRC_DEMO_RULE_BANDS].
- **Personal:** your reading is compared with your own usual rate, in both directions; ARGUS never assumes a day-to-day spread smaller than 2 bpm [SRC_DEMO_BASELINE_ENGINE].
- **Why the personal layer matters:** in the demo story a resting rate that climbs from 58 to 69 bpm stays inside the Earth range, yet it is far above that crew member's usual [SRC_DEMO_SIMULATION]. ARGUS marks such a reading "caught only by personal baseline".
- **Quality:** a camera reading of poor quality can raise the verdict no higher than Watch; its thresholds are demo parameters [SRC_DEMO_QUALITY_SCORES].
- A raised resting heart rate on your personal baseline together with a raised body temperature, or a ticked rash, suggests the Suspected infection protocol.

## What to do

- **Watch:** "Re-measure after 20 min seated rest (camera or wearable)." [demo wording]
- **Act:** "Tell the CMO. Check temperature and symptoms. Open protocol: Suspected infection / overreaching." [demo wording]
- **Poor reading quality:** "Reading quality is poor. Re-measure." [demo wording]

## Sources

- [SRC_NASA_RISKS]
- [SRC_EARTH_VITALS_GENERAL]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
- [SRC_DEMO_QUALITY_SCORES]
- [SRC_DEMO_SIMULATION]
