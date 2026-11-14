---
id: body-temperature
title: Body temperature
category: signals
order: 4
signalIds: [body_temp]
keywords: [temperature, body temperature, fever, hot, cold, chills, thermometer, temp, infection]
sourceIds: [SRC_EARTH_VITALS_GENERAL, SRC_CORE_TEMP_STAHN, SRC_DEMO_RULE_BANDS, SRC_DEMO_BASELINE_ENGINE]
summary: Your body (core) temperature from an oral or ear thermometer; wearable skin temperature is a trend only.
---

## What it is

Your body (core) temperature, taken with an oral or ear thermometer.

## Why it matters in space

Resting core body temperature was reported about 1 °C higher on the ISS, developing over about 2.5 months [SRC_CORE_TEMP_STAHN]. ARGUS shows this as context and does not shift your reference.

## How to measure

- Use the same device and site (mouth or ear) each time. [demo wording]
- Note if you measured after exercise. [demo wording]
- Wearable skin temperature is not body temperature; it is shown as a trend only.

## How ARGUS judges it

- **Earth:** nominal at 36.1–37.4 °C; Watch at 37.5–37.9 °C or 35.0–36.0 °C; Act at 38.0 °C or more, or below 35.0 °C [SRC_EARTH_VITALS_GENERAL] [SRC_DEMO_RULE_BANDS].
- **Space:** the same bands as Earth in this demo [SRC_DEMO_RULE_BANDS]. The reported in-flight rise is shown as context only, because the simulated crew has no such rise [SRC_CORE_TEMP_STAHN].
- **Personal:** your reading is compared with your own usual, for rises; ARGUS never assumes a day-to-day spread smaller than 0.2 °C [SRC_DEMO_BASELINE_ENGINE].
- A raised temperature together with a raised resting heart rate on your personal baseline suggests the Suspected infection protocol.

## What to do

- **Watch:** "Re-measure. If it is still outside your usual range, tell the CMO." [demo wording]
- **Act:** "Tell the CMO now and send a report to the flight surgeon." [demo wording]

## Sources

- [SRC_EARTH_VITALS_GENERAL]
- [SRC_CORE_TEMP_STAHN]
- [SRC_DEMO_RULE_BANDS]
- [SRC_DEMO_BASELINE_ENGINE]
