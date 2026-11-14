---
id: measure-vision-check
title: Vision check
category: measurements
order: 4
signalIds: [amsler, near_acuity]
keywords: [vision, vision check, eye, eyes, amsler, acuity, grid, glasses, calibration, screen, distance, sans]
sourceIds: [SRC_VISION_ISS, SRC_SANS_CAMBRIDGE, SRC_SANS_EYE_NATURE, SRC_OCULAR_CADENCE, SRC_IPD_DODGSON, SRC_DEMO_QUALITY_SCORES]
summary: A calibrated on-screen Amsler grid and tumbling-E near-acuity test, one eye at a time, modeled on the ISS laptop vision tests. Screening only.
---

## What it is

A calibrated on-screen Amsler grid and a tumbling-E near-acuity test. They are modeled on the ISS in-flight vision exam, which includes acuity software and an Amsler grid on a laptop [SRC_VISION_ISS]. Eye changes of long missions are common: 69 % of US ISS crew had more than 20 µm of retinal nerve fibre layer thickening in at least one eye on OCT imaging [SRC_SANS_CAMBRIDGE]. Screening only.

## How to measure

- **Calibrate once per device:** drag the slider until the card on screen matches a real bank or ID card.
- **Distance:** measure it with a ruler, or let the camera estimate how far you sit, using an assumed camera field of view of 65° that you can adjust [SRC_DEMO_QUALITY_SCORES] and an assumed adult eye spacing of about 63 mm [SRC_IPD_DODGSON].
- **Amsler grid:** sit 30–35 cm away with your usual near glasses, one eye at a time [SRC_DEMO_QUALITY_SCORES].
- **Near acuity:** sit 60 cm away, one eye at a time, and give each E's direction with the arrow keys or the large buttons [SRC_DEMO_QUALITY_SCORES].

## How ARGUS uses it

- Tests are scheduled on mission days 10, 30, 60, 90 and 120, then every 30 days, modeled on a NASA research cadence [SRC_OCULAR_CADENCE].
- The Amsler map is compared with your previous map of the same eye; new cells are highlighted.
- Acuity is compared with your pre-flight score for that eye, with the known far-sighted shift and the Space Anticipation Glasses carried for it as context [SRC_SANS_EYE_NATURE].
- New cells or an acuity at Watch suggest the Vision change protocol.

## Honest limits

- Screening only. The real ISS exam also uses imaging such as ultrasound, fundoscopy and OCT [SRC_VISION_ISS].
- The distance from the camera is an estimate; a distance measured with a ruler is saved as lower quality ("fair").
- The screen size is calibrated by you with a card and is not checked independently.
- An earlier test saved without a map (such as the simulated crew history) gives only a count; marked squares beyond that count count as new.
- On screens that are not high-density the acuity test may reach the screen's resolution limit and says so.

## Sources

- [SRC_VISION_ISS]
- [SRC_SANS_CAMBRIDGE]
- [SRC_SANS_EYE_NATURE]
- [SRC_OCULAR_CADENCE]
- [SRC_IPD_DODGSON]
- [SRC_DEMO_QUALITY_SCORES]
