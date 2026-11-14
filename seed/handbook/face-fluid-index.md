---
id: face-fluid-index
title: Face fluid-shift index
category: signals
order: 12
signalIds: [face_fluid_index]
experimental: true
keywords: [face, puffy face, puffy, fluid, fluid shift, swelling, face scan, camera, experimental]
sourceIds: [SRC_NASA_RISKS, SRC_DEMO_QUALITY_SCORES]
summary: Experimental — not validated. Your face width from the camera, compared with your own reference scan. Trend only.
---

## What it is

Experimental — not validated. Your face width from the camera, compared with your own reference scan. On a mission the reference would be your pre-flight scans; no pre-flight scan exists in this demo, so your first scan on this device is the reference and later scans are compared with it. Open it in the Lab: Face fluid-shift scan.

## Why it matters in space

Weightlessness shifts body fluid toward the head (the "puffy face" adaptation) [SRC_NASA_RISKS]. No validated threshold exists, so this index is a trend only and never raises Watch or Act.

## How to measure

- Face the camera straight on, at arm's length, with even light from the front.
- Neutral face: mouth closed, no smile.
- Hold still for 3 s [SRC_DEMO_QUALITY_SCORES]. A frame counts only when the head is turned less than 10° and the face is neutral [SRC_DEMO_QUALITY_SCORES].
- Cheek and jaw width are divided by the distance between your pupils, so the distance to the camera does not matter. The index is the mean of the two width ratios against your reference; eye opening is shown separately.
- Your first scan on this device is the reference; "Reset reference" starts over.
- Only numbers are stored. No image is saved.

## How ARGUS judges it

- **Earth:** no Earth rule is used.
- **Space:** an increase against your reference (pre-flight) scans in weightlessness is Expected in space (fluid shift) [SRC_NASA_RISKS]. This index never gives Watch or Act on its own.
- **Personal:** shown as a trend only.

## What to do

- **Expected in space:** "Known change in space. Keep doing your countermeasures." [demo wording]

## Sources

- [SRC_NASA_RISKS]
- [SRC_DEMO_QUALITY_SCORES]
