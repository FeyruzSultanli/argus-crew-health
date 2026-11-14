---
id: oxygen-saturation
title: Oxygen saturation
category: signals
order: 3
signalIds: [spo2]
keywords: [oxygen, spo2, saturation, oximeter, pulse oximeter, breathing, breath, short of breath, hypoxia, eva]
sourceIds: [SRC_EARTH_VITALS_GENERAL, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: The share of your blood's haemoglobin that carries oxygen, read with a fingertip pulse oximeter.
---

## What it is

The share of your blood's haemoglobin that carries oxygen, read with a fingertip pulse oximeter (SpO₂).

## Why it matters in space

Hypoxia (too little oxygen) is a NASA human-research risk, and EVA (spacewalk) pre-breathe protocols raise mild hypoxia risk [SRC_NASA_RISKS]. Cabin oxygen is shown in the Environment panel.

## How to measure

- Warm your finger; no nail polish. [demo wording]
- Keep still for 30 s. [demo wording]
- Read when the number is stable. [demo wording]

## How ARGUS judges it

- **Earth:** nominal at 95 % or more [SRC_EARTH_VITALS_GENERAL]; Watch at 90–94 %, Act below 90 % [SRC_EARTH_VITALS_GENERAL] [SRC_DEMO_RULE_BANDS].
- **Space:** the same bands as Earth; the space context is EVA pre-breathe [SRC_NASA_RISKS].
- **Personal:** your reading is compared with your own usual, for drops; ARGUS never assumes a day-to-day spread smaller than 1 % [SRC_DEMO_BASELINE_ENGINE].

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_EARTH_VITALS_GENERAL]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
