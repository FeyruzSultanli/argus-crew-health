---
id: near-acuity
title: Near visual acuity
category: signals
order: 11
signalIds: [near_acuity]
keywords: [acuity, vision, eye, eyes, sight, reading, letters, tumbling e, glasses, far-sighted, hyperopic, blurry, logmar, sans]
sourceIds: [SRC_EARTH_ACUITY, SRC_SANS_EYE_NATURE, SRC_OCULAR_CADENCE, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE, SRC_DEMO_QUALITY_SCORES]
summary: The smallest tumbling-E letters you can read on screen, in logMAR (lower is better). Screening only.
---

## What it is

The smallest tumbling-E letters you can read on screen at 60 cm [SRC_DEMO_QUALITY_SCORES], in logMAR (a log scale of letter size: lower is better).

## Why it matters in space

A far-sighted (hyperopic) shift is a known feature of SANS; Space Anticipation Glasses are kept aboard the ISS to correct it [SRC_SANS_EYE_NATURE]. Screening only.

## How to measure

- Calibrate the screen once per device.
- Sit 60 cm from the screen (an intermediate-distance test, not a 40-cm near card) [SRC_DEMO_QUALITY_SCORES].
- Test one eye at a time.
- Give the direction of each E with the arrow keys or the large buttons.
- Note whether you wore glasses.

## How ARGUS judges it

- **When:** on the same days as the Amsler grid, modeled on a NASA research cadence [SRC_OCULAR_CADENCE].
- **Earth:** Watch when worse than 0.3 logMAR (about 20/40) [SRC_EARTH_ACUITY] [SRC_DEMO_RULE_BANDS].
- **Space:** compared with your pre-flight score for that eye. A decline of up to 0.1 logMAR, corrected with glasses, is Expected in space; a decline of 0.11–0.19 logMAR is Expected in space with or without glasses; a decline of 0.2 logMAR or more is Watch [SRC_DEMO_RULE_BANDS]. The basis is the known hyperopic shift and the glasses carried for it [SRC_SANS_EYE_NATURE].
- **Personal:** your score is compared with your own usual, for worsening (higher logMAR); ARGUS never assumes a day-to-day spread smaller than 0.05 logMAR [SRC_DEMO_BASELINE_ENGINE].
- An acuity at Watch or new Amsler cells suggest the Vision change protocol.

## What to do

- **Expected in space:** "Known change in space. Keep doing your countermeasures." [demo wording]
- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_EARTH_ACUITY]
- [SRC_SANS_EYE_NATURE]
- [SRC_OCULAR_CADENCE]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
- [SRC_DEMO_QUALITY_SCORES]
