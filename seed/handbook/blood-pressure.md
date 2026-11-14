---
id: blood-pressure
title: Blood pressure
category: signals
order: 2
signalIds: [blood_pressure]
keywords: [blood pressure, bp, pressure, systolic, diastolic, mmhg, cuff, dizzy, dizziness, fluid shift]
sourceIds: [SRC_EARTH_BP_ACC_AHA, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: The pressure in your arteries during and between heartbeats, with space context on fluid shift and standing up.
---

## What it is

The pressure in your arteries when the heart beats (systolic) and between beats (diastolic), in mmHg (millimetres of mercury).

## Why it matters in space

In weightlessness body fluid shifts toward the head [SRC_NASA_RISKS]. On return to gravity, keeping blood pressure up when standing can be hard (orthostatic intolerance) [SRC_NASA_RISKS].

## How to measure

- Rest 5 min seated (restrained in microgravity). [demo wording]
- Support the arm at heart level and use the correct cuff size. [demo wording]
- Do not talk during the reading. [demo wording]
- Take 2 readings 1 min apart and enter the average. [demo wording]

## How ARGUS judges it

- **Earth:** Act if systolic is above 180 or diastolic above 120 mmHg [SRC_EARTH_BP_ACC_AHA]. Otherwise Watch if systolic is 130–180 or diastolic 80–120 mmHg [SRC_EARTH_BP_ACC_AHA], or if systolic is below 90 or diastolic below 60 mmHg (low readings) [SRC_DEMO_RULE_BANDS]. Everything else is nominal: ARGUS merges the guideline's "normal" and "elevated" categories into nominal.
- **Space:** the same bands as Earth [SRC_DEMO_RULE_BANDS]. The space context is the fluid shift toward the head and the difficulty standing on return to gravity [SRC_NASA_RISKS].
- **Personal:** systolic and diastolic are each compared with your own usual, for rises; ARGUS never assumes a day-to-day spread smaller than 5 mmHg systolic or 4 mmHg diastolic [SRC_DEMO_BASELINE_ENGINE].

## What to do

- **Watch:** "Re-measure twice, 1 min apart, seated, arm at heart level." [demo wording]
- **Act:** "Re-measure now; if still above 180/120 tell the CMO immediately and notify the flight surgeon." [demo wording] [SRC_EARTH_BP_ACC_AHA]

## Sources

- [SRC_EARTH_BP_ACC_AHA]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
