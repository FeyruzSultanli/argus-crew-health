---
id: blood-glucose
title: Blood glucose
category: signals
order: 5
signalIds: [glucose]
keywords: [glucose, blood sugar, sugar, fingerstick, mg/dl, fasting, nutrition, food, diet]
sourceIds: [SRC_EARTH_GLUCOSE_ADA, SRC_CSA_WHY_SCIENCE, SRC_NASA_RISKS, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: The sugar level in your blood from a fingerstick, in mg/dL, noted as fasting, random or after a meal.
---

## What it is

The sugar level in your blood from a fingerstick, in mg/dL, noted as fasting, random or after a meal.

## Why it matters in space

Diet and activity change in flight, and inadequate food and nutrition is a NASA human-research risk [SRC_NASA_RISKS]. Space findings also help Earth research on diabetes [SRC_CSA_WHY_SCIENCE].

## How to measure

- Wash and dry your hands. [demo wording]
- Use the lancet on the side of a fingertip. [demo wording]
- Put the first drop on the strip. [demo wording]
- Note whether you are fasting or not. [demo wording]

## How ARGUS judges it

- **Earth, fasting:** nominal at 70–99 mg/dL; Watch at 100–125 or 54–69 mg/dL; Act at 126 mg/dL or more (repeat to confirm) or below 54 mg/dL [SRC_EARTH_GLUCOSE_ADA].
- **Earth, random or after a meal:** nominal at 70–139 mg/dL; Watch at 140–199 or 54–69 mg/dL; Act at 200 mg/dL or more or below 54 mg/dL [SRC_EARTH_GLUCOSE_ADA]. The 140–199 mg/dL band is the source's 2-hour tolerance-test range, reused here as a demo choice [SRC_DEMO_RULE_BANDS].
- **Space:** the same bands as Earth [SRC_DEMO_RULE_BANDS]; the space context is the change in diet and activity [SRC_CSA_WHY_SCIENCE].
- **Personal:** fasting readings only, in both directions; ARGUS never assumes a day-to-day spread smaller than 5 mg/dL [SRC_DEMO_BASELINE_ENGINE].

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_EARTH_GLUCOSE_ADA]
- [SRC_CSA_WHY_SCIENCE]
- [SRC_NASA_RISKS]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
