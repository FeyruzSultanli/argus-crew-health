---
id: amsler-grid
title: Amsler grid
category: signals
order: 10
signalIds: [amsler]
keywords: [amsler, grid, vision, eye, eyes, sight, wavy, wavy lines, blurred, blurry, missing, distortion, sans]
sourceIds: [SRC_VISION_ISS, SRC_SANS_CAMBRIDGE, SRC_OCULAR_CADENCE, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_QUALITY_SCORES]
summary: A grid you look at with one eye at a time, marking lines that look wavy, blurred or missing. Screening only.
---

## What it is

A grid you look at with one eye at a time, marking any lines that look wavy, blurred or missing.

## Why it matters in space

Eye changes (SANS, spaceflight-associated neuro-ocular syndrome) are a NASA human-research risk for long missions [SRC_NASA_RISKS]. The ISS in-flight vision exam includes an Amsler grid on a laptop [SRC_VISION_ISS]. Screening only.

## How to measure

- Calibrate the screen once per device.
- Sit 30–35 cm from the screen and wear your usual near glasses [SRC_DEMO_QUALITY_SCORES].
- Cover one eye and look at the centre dot.
- Mark cells that look wavy, blurred or missing.
- Repeat with the other eye.

## How ARGUS judges it

- **When:** on mission days 10, 30, 60, 90 and 120, then every 30 days, modeled on a NASA research cadence [SRC_OCULAR_CADENCE].
- **What is counted:** the number of cells you marked, and which cells are new against your previous map of the same eye.
- **Earth:** any marked cell is Watch ("see an eye professional"); a new marked cell near the centre is Act [SRC_VISION_ISS]. "Near the centre" means within 2 cells of the centre dot [SRC_DEMO_RULE_BANDS].
- **Space:** any new cell against your previous map is Watch, with an imaging or remote eye exam to schedule; a new cell near the centre is Act, with the flight surgeon notified [SRC_VISION_ISS] [SRC_SANS_CAMBRIDGE].
- **Personal:** not used; the comparison with your previous map does that job.
- New cells or an acuity at Watch suggest the Vision change protocol.

## What to do

- **Watch:** "Schedule imaging/remote eye exam." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_VISION_ISS]
- [SRC_SANS_CAMBRIDGE]
- [SRC_OCULAR_CADENCE]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_QUALITY_SCORES]
